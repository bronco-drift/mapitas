import type { AdmGeoJSON, Adm0Props, Adm1Props, Adm2Props, DiasporaProps, PaletteId } from './types'
import type { Indicator } from '../data/indicators'
import { colorForState, colorForMuni } from '../data/indicators'
import { colorScale, type CustomStops } from './color-scale'

// Color institucional para el bloque país en vista política.
const VE_COUNTRY_COLOR = '#5b8def'

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

// Indicadores simbólicos = banderas o escudos. En lugar de aplicar la
// escala de color, asignan _color neutro para que MapView monte las
// imágenes encima del polígono recortadas al contorno geográfico.
function isSymbolIndicator(indicator: Indicator): boolean {
  return indicator.group === 'banderas' || indicator.group === 'escudos'
}

// Vista política: mapa categórico (sin valor numérico). Cada entidad
// recibe un color de la paleta categórica estable. Es el default al
// primer load y sirve como mapa orientador.
function isPoliticoIndicator(indicator: Indicator): boolean {
  return indicator.group === 'politico'
}

// wiki-info.json indica qué entidades tienen bandera/escudo disponible
// (cosechado desde Wikidata). Import eager: el JSON pesa ~100KB y se usa
// en el camino sincrónico de applyIndicatorTo* + en hover/tooltip.
import wikiInfo from '../data/wiki-info.json'

function hasFlag(level: 'state' | 'muni', id: string): boolean {
  if (level === 'state') {
    return !!(wikiInfo as never as { states: Record<string, { hasFlag?: boolean }> }).states[id]?.hasFlag
  }
  return !!(wikiInfo as never as { munis: Record<string, { hasFlag?: boolean }> }).munis[id]?.hasFlag
}

function hasShield(level: 'state' | 'muni', id: string): boolean {
  if (level === 'state') {
    return !!(wikiInfo as never as { states: Record<string, { hasShield?: boolean }> }).states[id]?.hasShield
  }
  return !!(wikiInfo as never as { munis: Record<string, { hasShield?: boolean }> }).munis[id]?.hasShield
}

export function applyIndicatorToAdm1(
  geo: AdmGeoJSON<Adm1Props>,
  indicator: Indicator,
  palette: PaletteId,
  custom?: CustomStops,
  customRange?: { min: number | null; mid: number | null; max: number | null },
  opts: { clipExtremes?: boolean } = {},
): { geo: AdmGeoJSON<Adm1Props>; stats: IndicatorStats } {
  // Camino especial: indicadores simbólicos (banderas/escudos estados).
  // Cada entidad recibe un gris claro de base. SymbolClippedLayer en MapView
  // superpone la imagen del símbolo recortada al polígono. Entidades sin
  // símbolo disponible (según wiki-info.json) quedan en gris sin imagen.
  if (isSymbolIndicator(indicator)) {
    const checkFn = indicator.id.startsWith('banderas') ? hasFlag : hasShield
    let matched = 0
    const features = geo.features.map(f => {
      const iso = f.properties.iso
      const has = checkFn('state', iso)
      if (has) matched++
      return {
        ...f,
        properties: {
          ...f.properties,
          _value: has ? 1 : null,
          // Gris claro como base. Si por anti-aliasing quedan gaps mínimos
          // en la imagen, se ve el gris (no el basemap blanco que era confuso).
          _color: '#cbd5e1',
          _matched: has,
        },
      }
    })
    return {
      geo: { ...geo, features },
      stats: {
        matched,
        unmatched: geo.features.length - matched,
        totalFeatures: geo.features.length,
        totalRows: matched,
        unmatchedRows: [],
        min: 0,
        max: 1,
      },
    }
  }

  // Vista política: cada estado con su color categórico estable. No usa
  // colorScale ni domain numérico; el color sale del lookup por iso.
  if (isPoliticoIndicator(indicator)) {
    const features = geo.features.map(f => {
      const iso = f.properties.iso
      return {
        ...f,
        properties: {
          ...f.properties,
          _value: 1,
          _color: colorForState(iso),
          _matched: true,
        },
      }
    })
    return {
      geo: { ...geo, features },
      stats: {
        matched: features.length,
        unmatched: 0,
        totalFeatures: features.length,
        totalRows: features.length,
        unmatchedRows: [],
        min: 0,
        max: 1,
      },
    }
  }

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
  // Indicadores simbólicos a nivel muni (banderas/escudos municipales).
  // SymbolClippedLayer en MapView monta la imagen recortada al polígono.
  if (isSymbolIndicator(indicator)) {
    const checkFn = indicator.id.startsWith('banderas') ? hasFlag : hasShield
    let matched = 0
    const features = geo.features.map(f => {
      const sid = f.properties.sourceID
      const has = checkFn('muni', sid)
      if (has) matched++
      return {
        ...f,
        properties: {
          ...f.properties,
          _value: has ? 1 : null,
          _color: '#cbd5e1',
          _matched: has,
        },
      }
    })
    return {
      geo: { ...geo, features },
      stats: {
        matched,
        unmatched: geo.features.length - matched,
        totalFeatures: geo.features.length,
        totalRows: matched,
        unmatchedRows: [],
        min: 0,
        max: 1,
      },
    }
  }

  // Vista política munis: cada muni con un color de una paleta de 6,
  // asignados por graph coloring para que NINGÚN par de munis vecinos
  // comparta tono. Es el patrón clásico de mapas políticos en papel.
  // La asignación viene precomputada de scripts/compute-muni-coloring.mjs.
  if (isPoliticoIndicator(indicator)) {
    const features = geo.features.map(f => {
      const sourceID = f.properties.sourceID
      return {
        ...f,
        properties: {
          ...f.properties,
          _value: 1,
          _color: colorForMuni(sourceID),
          _matched: true,
        },
      }
    })
    return {
      geo: { ...geo, features },
      stats: {
        matched: features.length,
        unmatched: 0,
        totalFeatures: features.length,
        totalRows: features.length,
        unmatchedRows: [],
        min: 0,
        max: 1,
      },
    }
  }

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

// Vista diáspora: pinta el GeoJSON LATAM con uno de 3 modos.
//   - 'migrantes': cuántos migrantes venezolanos recibió cada país. VE queda
//     fuera del rango (no recibió migrantes, es el origen) y se pinta con
//     un color granate fijo distinto del gradiente.
//   - 'venezolanos': total de venezolanos viviendo en ese país (= migrantes_ve,
//     y para VE = población residente). Todos en el mismo gradiente; VE
//     entra como el valor máximo natural.
//   - 'porcentaje': venezolanos sobre población total del país. VE = 100%.
//     Útil para ver dónde la presencia venezolana es MÁS densa relativa al
//     tamaño del país receptor (ej. Panamá tiene 144k = 3.1%, más densa
//     proporcionalmente que Brasil con 388k = 0.18%).
export type DiasporaMode = 'migrantes' | 'venezolanos' | 'porcentaje'

export function applyDiaspora(
  geo: AdmGeoJSON<DiasporaProps>,
  palette: PaletteId,
  mode: DiasporaMode = 'migrantes',
  custom?: CustomStops,
  customRange?: { min: number | null; mid: number | null; max: number | null },
  opts: { clipExtremes?: boolean } = {},
): { geo: AdmGeoJSON<DiasporaProps>; stats: IndicatorStats } {
  // valueFor: extrae el valor del feature según el modo activo.
  const valueFor = (f: { properties: DiasporaProps }): number | null => {
    const props = f.properties
    if (mode === 'migrantes') {
      // VE no es receptor — sólo cuenta para receptores reales.
      return props.is_origin ? null : props.migrantes_ve
    }
    if (mode === 'venezolanos') {
      return props.migrantes_ve
    }
    // mode === 'porcentaje'
    if (props.migrantes_ve == null || props.poblacion_total == null) return null
    return (props.migrantes_ve / props.poblacion_total) * 100
  }

  const values = geo.features
    .map(valueFor)
    .filter((v): v is number => typeof v === 'number')
  const { min: autoMin, max: autoMax } = autoRange(values, opts.clipExtremes ?? true)
  const min = customRange?.min ?? autoMin
  const max = customRange?.max ?? autoMax
  const midRatio =
    customRange?.mid != null && max > min
      ? Math.max(0.05, Math.min(0.95, (customRange.mid - min) / (max - min)))
      : 0.5

  // Color fijo para el país origen en modo 'migrantes': granate oscuro,
  // indica "este es de donde sale la migración" y queda visualmente
  // separado del gradiente de receptores. En los otros modos VE entra
  // en el gradiente normal porque su valor SÍ es comparable.
  const ORIGIN_COLOR = '#6b1f2b'

  let matched = 0
  const features = geo.features.map(f => {
    const v = valueFor(f)
    const isOrigin = f.properties.is_origin === true
    if (v != null) matched++
    return {
      ...f,
      properties: {
        ...f.properties,
        _value: v,
        _color:
          mode === 'migrantes' && isOrigin
            ? ORIGIN_COLOR
            : v != null
              ? colorScale(v, min, max, palette, custom, midRatio)
              : null,
        _matched: v != null,
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

export function clearIndicatorData<P extends Adm0Props | Adm1Props | Adm2Props | DiasporaProps>(
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
  // Indicadores simbólicos a nivel país (bandera/escudo nacional).
  // SymbolClippedLayer monta la imagen recortada al polígono de Venezuela.
  if (isSymbolIndicator(indicator)) {
    const features = geo.features.map(f => ({
      ...f,
      properties: {
        ...f.properties,
        _value: 1,
        _color: '#cbd5e1',
        _matched: true,
      },
    }))
    return {
      geo: { ...geo, features },
      stats: {
        matched: 1,
        unmatched: 0,
        totalFeatures: 1,
        totalRows: 1,
        unmatchedRows: [],
        min: 0,
        max: 1,
      },
    }
  }

  // Vista política país: Venezuela como bloque institucional con un único
  // color sólido. No tiene meaning estadístico, sólo orientador.
  if (isPoliticoIndicator(indicator)) {
    const features = geo.features.map(f => ({
      ...f,
      properties: {
        ...f.properties,
        _value: 1,
        _color: VE_COUNTRY_COLOR,
        _matched: true,
      },
    }))
    return {
      geo: { ...geo, features },
      stats: {
        matched: 1,
        unmatched: 0,
        totalFeatures: 1,
        totalRows: 1,
        unmatchedRows: [],
        min: 0,
        max: 1,
      },
    }
  }

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
