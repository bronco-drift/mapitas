import type { AdmGeoJSON, Adm0Props, Adm1Props, Adm2Props, PaletteId } from './types'
import type { Indicator } from '../data/indicators'
import { colorScale, type CustomStops } from './color-scale'

export type IndicatorStats = {
  matched: number
  unmatched: number
  totalFeatures: number
  totalRows: number
  unmatchedRows: string[]
  min: number
  max: number
}

function valuesForRange(indicator: Indicator, level: 'adm1' | 'adm2'): number[] {
  if (level === 'adm1') {
    // En vista estatal, el rango sale del aggregate (municipios) o del data directo (estatal)
    const src = indicator.aggregation === 'municipality'
      ? indicator.stateAggregate ?? {}
      : indicator.data
    return Object.values(src).filter(v => typeof v === 'number')
  }
  // En vista municipal: rango usa el data municipal completo si existe;
  // para indicadores estatales heredados, usa data (estatal) directamente.
  return Object.values(indicator.data).filter(v => typeof v === 'number')
}

// Percentil q (0..1) sobre un array ya ordenado ascendentemente, con
// interpolación lineal entre los dos elementos más cercanos.
function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]
  const pos = (sortedValues.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sortedValues[lo]
  return sortedValues[lo] * (hi - pos) + sortedValues[hi] * (pos - lo)
}

// Rango automático del dominio para colorear el mapa.
// - clipExtremes=true (default): usa percentiles 2/98 para que outliers
//   queden saturados y el resto recupere contraste.
// - clipExtremes=false: usa raw min/max (los outliers definen el rango).
// Si hay <10 valores no aplica clipping porque los percentiles dejan de
// ser estadísticamente útiles.
function autoRange(values: number[], clipExtremes: boolean): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 }
  if (!clipExtremes || values.length < 10) {
    return { min: Math.min(...values), max: Math.max(...values) }
  }
  const sorted = [...values].sort((a, b) => a - b)
  return { min: quantile(sorted, 0.02), max: quantile(sorted, 0.98) }
}

export function applyIndicatorToAdm1(
  geo: AdmGeoJSON<Adm1Props>,
  indicator: Indicator,
  palette: PaletteId,
  custom?: CustomStops,
  customRange?: { min: number | null; mid: number | null; max: number | null },
  opts: { clipExtremes?: boolean } = {},
): { geo: AdmGeoJSON<Adm1Props>; stats: IndicatorStats } {
  const values = valuesForRange(indicator, 'adm1')
  const { min: autoMin, max: autoMax } = autoRange(values, opts.clipExtremes ?? true)
  const min = customRange?.min ?? autoMin
  const max = customRange?.max ?? autoMax
  // mid se interpreta como un valor absoluto del dominio. Lo convertimos al %
  // que espera colorScale para reshape la curva del gradiente.
  const midRatio = customRange?.mid != null && max > min
    ? Math.max(0.05, Math.min(0.95, (customRange.mid - min) / (max - min)))
    : 0.5

  const lookup = indicator.aggregation === 'municipality'
    ? indicator.stateAggregate ?? {}
    : indicator.data

  let matched = 0
  const features = geo.features.map(f => {
    const value = lookup[f.properties.iso]
    if (value != null) matched++
    return {
      ...f,
      properties: {
        ...f.properties,
        _value: value ?? null,
        _color: value != null ? colorScale(value, min, max, palette, custom, midRatio) : null,
        _matched: value != null,
      },
    }
  })

  return {
    geo: { ...geo, features },
    stats: {
      matched,
      unmatched: geo.features.length - matched,
      totalFeatures: geo.features.length,
      totalRows: values.length,
      unmatchedRows: [],
      min,
      max,
    },
  }
}

export function applyIndicatorToAdm2(
  geo: AdmGeoJSON<Adm2Props>,
  indicator: Indicator,
  palette: PaletteId,
  custom?: CustomStops,
  customRange?: { min: number | null; mid: number | null; max: number | null },
  opts: { clipExtremes?: boolean } = {},
): { geo: AdmGeoJSON<Adm2Props>; stats: IndicatorStats } {
  const values = valuesForRange(indicator, 'adm2')
  const { min: autoMin, max: autoMax } = autoRange(values, opts.clipExtremes ?? true)
  const min = customRange?.min ?? autoMin
  const max = customRange?.max ?? autoMax
  const midRatio = customRange?.mid != null && max > min
    ? Math.max(0.05, Math.min(0.95, (customRange.mid - min) / (max - min)))
    : 0.5

  const stateAgg = indicator.stateAggregate ?? {}

  let matched = 0
  const features = geo.features.map(f => {
    const sourceID = f.properties.sourceID
    const parentISO = f.properties.parentISO
    let value: number | undefined

    if (indicator.aggregation === 'municipality') {
      // 1) data específica del municipio
      value = indicator.data[sourceID]
      // 2) fallback opt-in al agregado estatal. Sin el flag, el muni queda
      // sin data (gris) — más honesto que pintar todo el estado del mismo
      // color cuando la fuente original tiene cobertura parcial.
      if (value == null && parentISO && indicator.inheritFromState) {
        value = stateAgg[parentISO]
      }
    } else {
      // Estado-nivel → heredar al muni vía parentISO (es la naturaleza del
      // indicador, no un fallback de cobertura)
      if (parentISO) value = indicator.data[parentISO]
    }

    if (value != null) matched++
    return {
      ...f,
      properties: {
        ...f.properties,
        _value: value ?? null,
        _color: value != null ? colorScale(value, min, max, palette, custom, midRatio) : null,
        _matched: value != null,
      },
    }
  })

  return {
    geo: { ...geo, features },
    stats: {
      matched,
      unmatched: geo.features.length - matched,
      totalFeatures: geo.features.length,
      totalRows: values.length,
      unmatchedRows: [],
      min,
      max,
    },
  }
}

export function clearIndicatorData<P extends Adm0Props | Adm1Props | Adm2Props>(
  geo: AdmGeoJSON<P>,
): AdmGeoJSON<P> {
  return {
    ...geo,
    features: geo.features.map(f => ({
      ...f,
      properties: { ...f.properties, _value: null, _color: null, _matched: false } as P,
    })),
  }
}

// Agregado nacional: combina los valores de los estados/agregados en uno solo.
export function nationalAggregate(indicator: Indicator): number | null {
  const source = indicator.aggregation === 'municipality'
    ? indicator.stateAggregate ?? {}
    : indicator.data
  const values = Object.values(source).filter(v => typeof v === 'number') as number[]
  if (values.length === 0) return null
  const mode = indicator.nationalAggregation ?? 'sum'
  if (mode === 'mean') return values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((a, b) => a + b, 0)
}

export function applyIndicatorToAdm0(
  geo: AdmGeoJSON<Adm0Props>,
  indicator: Indicator,
  palette: PaletteId,
  custom?: CustomStops,
): { geo: AdmGeoJSON<Adm0Props>; stats: IndicatorStats } {
  const value = nationalAggregate(indicator)
  const features = geo.features.map(f => ({
    ...f,
    properties: {
      ...f.properties,
      _value: value,
      // Para 1 sola feature, el color sale del extremo de la paleta (valor "máximo")
      _color: value != null ? colorScale(1, 0, 1, palette, custom) : null,
      _matched: value != null,
    },
  }))
  return {
    geo: { ...geo, features },
    stats: {
      matched: value != null ? 1 : 0,
      unmatched: value != null ? 0 : 1,
      totalFeatures: 1,
      totalRows: 1,
      unmatchedRows: [],
      min: value ?? 0,
      max: value ?? 0,
    },
  }
}
