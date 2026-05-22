import type { AdmGeoJSON, Adm1Props, Adm2Props, AdmLevel, PaletteId, UploadedDataset } from './types'
import { normalize, fuzzyMatchKey } from './normalize'
import { colorScale, type CustomStops } from './color-scale'

export type MergeStats = {
  matched: number
  unmatched: number
  totalFeatures: number
  totalRows: number
  unmatchedRows: string[]
  min: number
  max: number
}

export function clearAdmData<P extends Adm1Props | Adm2Props>(
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

export function mergeUserDataIntoGeo<P extends Adm1Props | Adm2Props>(
  geo: AdmGeoJSON<P>,
  level: AdmLevel,
  dataset: UploadedDataset,
  palette: PaletteId,
  custom?: CustomStops,
): { geo: AdmGeoJSON<P>; stats: MergeStats } {
  const { rows, geoColumn, valueColumn, parentColumn } = dataset

  if (!geoColumn || !valueColumn || rows.length === 0) {
    return {
      geo: clearAdmData(geo),
      stats: {
        matched: 0,
        unmatched: 0,
        totalFeatures: geo.features.length,
        totalRows: rows.length,
        unmatchedRows: [],
        min: 0,
        max: 0,
      },
    }
  }

  // Build lookup indexes
  const adm1ByKey: Record<string, P> = {}
  const adm2ByCompound: Record<string, P> = {}
  const adm2ByName: Record<string, P[]> = {}

  for (const f of geo.features) {
    const p = f.properties
    if (level === 'adm1') {
      const key = (p as Adm1Props).nameKey
      if (key) adm1ByKey[key] = p
    } else {
      const a2 = p as Adm2Props
      if (a2.compoundKey) adm2ByCompound[a2.compoundKey] = p
      if (a2.nameKey) {
        adm2ByName[a2.nameKey] = adm2ByName[a2.nameKey] ?? []
        adm2ByName[a2.nameKey].push(p)
      }
    }
  }

  // Build per-row value
  const values: number[] = []
  const matches: Array<{ feature: P; value: number }> = []
  const unmatchedRows: string[] = []

  for (const row of rows) {
    const rawGeo = row[geoColumn]
    const rawValue = row[valueColumn]
    const rawParent = parentColumn ? row[parentColumn] : null
    if (rawGeo == null || rawValue == null) continue

    const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(',', '.'))
    if (Number.isNaN(num)) continue

    const geoKey = normalize(String(rawGeo))
    let matched: P | null = null

    if (level === 'adm1') {
      matched = adm1ByKey[geoKey] ?? null
      if (!matched) {
        const fuzzy = fuzzyMatchKey(geoKey, Object.keys(adm1ByKey))
        if (fuzzy) matched = adm1ByKey[fuzzy]
      }
    } else {
      const parentKey = rawParent ? normalize(String(rawParent)) : null
      if (parentKey) {
        const compound = `${parentKey}__${geoKey}`
        matched = adm2ByCompound[compound] ?? null
      }
      if (!matched) {
        const candidates = adm2ByName[geoKey]
        if (candidates && candidates.length === 1) matched = candidates[0]
      }
      if (!matched) {
        const fuzzy = fuzzyMatchKey(geoKey, Object.keys(adm2ByCompound))
        if (fuzzy) matched = adm2ByCompound[fuzzy]
      }
    }

    if (matched) {
      matches.push({ feature: matched, value: num })
      values.push(num)
    } else {
      unmatchedRows.push(String(rawGeo))
    }
  }

  const min = values.length > 0 ? Math.min(...values) : 0
  const max = values.length > 0 ? Math.max(...values) : 0

  // Reset all features first
  const cleared = clearAdmData(geo)
  const featureMap = new Map(cleared.features.map(f => [f.properties.sourceID, f]))

  for (const { feature, value } of matches) {
    const target = featureMap.get(feature.sourceID)
    if (!target) continue
    target.properties._value = value
    target.properties._color = colorScale(value, min, max, palette, custom)
    target.properties._matched = true
  }

  return {
    geo: cleared,
    stats: {
      matched: matches.length,
      unmatched: unmatchedRows.length,
      totalFeatures: geo.features.length,
      totalRows: rows.length,
      unmatchedRows,
      min,
      max,
    },
  }
}

export function recolorWithPalette<P extends Adm1Props | Adm2Props>(
  geo: AdmGeoJSON<P>,
  palette: PaletteId,
  custom?: CustomStops,
): AdmGeoJSON<P> {
  const values: number[] = []
  for (const f of geo.features) {
    if (typeof f.properties._value === 'number') values.push(f.properties._value)
  }
  if (values.length === 0) return geo
  const min = Math.min(...values)
  const max = Math.max(...values)
  return {
    ...geo,
    features: geo.features.map(f => {
      if (typeof f.properties._value !== 'number') return f
      return {
        ...f,
        properties: {
          ...f.properties,
          _color: colorScale(f.properties._value, min, max, palette, custom),
        },
      }
    }),
  }
}
