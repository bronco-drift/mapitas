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

export function applyIndicatorToAdm1(
  geo: AdmGeoJSON<Adm1Props>,
  indicator: Indicator,
  palette: PaletteId,
  custom?: CustomStops,
  customRange?: { min: number | null; mid: number | null; max: number | null },
): { geo: AdmGeoJSON<Adm1Props>; stats: IndicatorStats } {
  const values = valuesForRange(indicator, 'adm1')
  const autoMin = values.length > 0 ? Math.min(...values) : 0
  const autoMax = values.length > 0 ? Math.max(...values) : 0
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
): { geo: AdmGeoJSON<Adm2Props>; stats: IndicatorStats } {
  const values = valuesForRange(indicator, 'adm2')
  const autoMin = values.length > 0 ? Math.min(...values) : 0
  const autoMax = values.length > 0 ? Math.max(...values) : 0
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
      // 2) fallback al agregado estatal (para munis con nombre placeholder en CSV)
      if (value == null && parentISO) value = stateAgg[parentISO]
    } else {
      // Estado-nivel → heredar al muni vía parentISO
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
