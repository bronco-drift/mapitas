import type { AdmGeoJSON, Adm1Props, Adm2Props, PaletteId } from './types'
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
): { geo: AdmGeoJSON<Adm1Props>; stats: IndicatorStats } {
  const values = valuesForRange(indicator, 'adm1')
  const min = values.length > 0 ? Math.min(...values) : 0
  const max = values.length > 0 ? Math.max(...values) : 0

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
        _color: value != null ? colorScale(value, min, max, palette, custom) : null,
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
): { geo: AdmGeoJSON<Adm2Props>; stats: IndicatorStats } {
  const values = valuesForRange(indicator, 'adm2')
  const min = values.length > 0 ? Math.min(...values) : 0
  const max = values.length > 0 ? Math.max(...values) : 0

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
        _color: value != null ? colorScale(value, min, max, palette, custom) : null,
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

export function clearIndicatorData<P extends Adm1Props | Adm2Props>(
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
