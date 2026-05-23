import municipalData from './municipal-indicators.json'
import ineStatesRaw from './ine-population-states.json'
import ineMunisRaw from './ine-population-municipalities.json'
import wikiData from './wiki-municipios.json'

// JSONs INE — proyecciones poblacionales 2000-2050. Estructura:
//   states:    { iso → { name, byYear: { '2026': number, ... } } }
//   municipios: { sourceID → { name, parentISO, ineName, byYear: { '2026': ..., ... } } }
type IneStateRecord = { name: string; byYear: Record<string, number> }
type IneMuniRecord = {
  name: string
  parentISO: string
  ineName: string
  byYear: Record<string, number>
}
const ineStates = ineStatesRaw as Record<string, IneStateRecord>
const ineMunis = ineMunisRaw as Record<string, IneMuniRecord>

// Extrae { iso → valor } para un año específico del JSON estatal del INE
function ineStateForYear(year: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [iso, rec] of Object.entries(ineStates)) {
    const v = rec.byYear[String(year)]
    if (typeof v === 'number') out[iso] = v
  }
  return out
}

// Extrae { sourceID → valor } para un año específico del JSON municipal
function ineMuniForYear(year: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [sid, rec] of Object.entries(ineMunis)) {
    const v = rec.byYear[String(year)]
    if (typeof v === 'number') out[sid] = v
  }
  return out
}

// Indicadores pre-cargados. Pueden ser:
//   - 'state': data keyed por código ISO 3166-2. Estado-nivel; al ver municipios
//     se hereda al parentISO.
//   - 'municipality': data keyed por sourceID del muni. Trae también
//     stateAggregate por ISO (sum / promedio ponderado) para la vista estatal.

export type IndicatorAggregation = 'state' | 'municipality'

export type Indicator = {
  id: string
  label: string
  description: string
  unit: string
  format: 'number' | 'decimal' | 'rate' | 'currency'
  year: number
  source: string
  note?: string
  aggregation: IndicatorAggregation
  // Cuando aggregation='state': keyed por ISO (ej. VE-V).
  // Cuando aggregation='municipality': keyed por sourceID del muni.
  data: Record<string, number>
  // Solo para aggregation='municipality': agregado por ISO, precomputado.
  stateAggregate?: Record<string, number>
  // Para nivel país: cómo agregar los valores estatales.
  // 'sum' (default): suma — sirve para Población, Área, PIB total
  // 'mean': promedio — sirve para IDH, tasas, ratios
  nationalAggregation?: 'sum' | 'mean'
}

// ---- Indicadores INE oficiales (proyecciones censo 2011, datos 2000-2050) ----

const POBLACION_INE_2026: Indicator = {
  id: 'poblacion_ine_2026',
  label: 'Población 2026 · INE',
  description: 'Proyección oficial INE basada en censo 2011',
  unit: 'habitantes',
  format: 'number',
  year: 2026,
  source: 'INE Venezuela (proyecciones poblacionales)',
  note: 'Lara, Nueva Esparta y Dep. Federales sin desglose municipal en la publicación INE',
  aggregation: 'municipality',
  data: ineMuniForYear(2026),
  stateAggregate: ineStateForYear(2026),
}

const POBLACION_INE_2050: Indicator = {
  id: 'poblacion_ine_2050',
  label: 'Proyección 2050 · INE',
  description: 'Proyección poblacional al año 2050 del INE',
  unit: 'habitantes',
  format: 'number',
  year: 2050,
  source: 'INE Venezuela (proyecciones poblacionales)',
  note: 'Proyección de largo plazo · referencia censo 2011',
  aggregation: 'municipality',
  data: ineMuniForYear(2050),
  stateAggregate: ineStateForYear(2050),
}

// ---- Indicadores Wikipedia (proyecciones INE 2021 recopiladas) ----
// Fuente: Anexo:Municipios de Venezuela por población y área en Wikipedia es.
// Cobertura: 324 de 335 municipios (11 son gaps reales del adm2: Páez de Apure,
// Ocumare Aragua, Angostura Bolívar, Guajira Zulia, etc.).
type WikiData = {
  municipios: Record<
    string,
    {
      name: string
      parentISO: string
      wikiName: string
      poblacion2021: number | null
      areaKm2: number | null
      densidad: number | null
    }
  >
  stateAggregates: {
    poblacion2021: Record<string, number>
    areaKm2: Record<string, number>
    densidad: Record<string, number>
  }
}
const wiki = wikiData as WikiData

function wikiMuniField(field: 'poblacion2021' | 'areaKm2' | 'densidad'): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [sid, m] of Object.entries(wiki.municipios)) {
    const v = m[field]
    if (typeof v === 'number') out[sid] = v
  }
  return out
}

const POBLACION_WIKI_2021: Indicator = {
  id: 'poblacion_wiki_2021',
  label: 'Población 2021 · Wiki',
  description: 'Población municipal según anexo de Wikipedia',
  unit: 'habitantes',
  format: 'number',
  year: 2021,
  source: 'Wikipedia (recopilación INE 2021)',
  note: '324/335 municipios · gaps del adm2 en Páez Apure, Ocumare, Angostura, etc.',
  aggregation: 'municipality',
  data: wikiMuniField('poblacion2021'),
  stateAggregate: wiki.stateAggregates.poblacion2021,
}

const AREA_WIKI: Indicator = {
  id: 'area_wiki',
  label: 'Área · Wiki',
  description: 'Superficie territorial según anexo de Wikipedia',
  unit: 'km²',
  format: 'number',
  year: 2021,
  source: 'Wikipedia (INE)',
  aggregation: 'municipality',
  data: wikiMuniField('areaKm2'),
  stateAggregate: wiki.stateAggregates.areaKm2,
}

const DENSIDAD_WIKI: Indicator = {
  id: 'densidad_wiki',
  label: 'Densidad · Wiki',
  description: 'Habitantes por km² según anexo de Wikipedia',
  unit: 'hab/km²',
  format: 'rate',
  year: 2021,
  source: 'Wikipedia (INE)',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: wikiMuniField('densidad'),
  stateAggregate: wiki.stateAggregates.densidad,
}

// ---- Indicadores estatales (legacy, aproximaciones hardcoded) ----
// Mantenido para no perder data anterior — diferenciado por etiqueta "est. estatal".
// Para data oficial 2024 ver POBLACION_INE_* (acceso a la serie completa 2000-2050).

const POBLACION_2024: Indicator = {
  id: 'poblacion_2024',
  label: 'Población 2024 · est. estatal',
  description: 'Aproximación estatal preexistente — números redondos',
  unit: 'habitantes',
  format: 'number',
  year: 2024,
  source: 'Estimaciones preexistentes (aproximación estatal)',
  note: 'Aproximaciones redondas · ver Población 2026 INE para data oficial',
  aggregation: 'state',
  data: {
    'VE-A': 1_900_000, 'VE-B': 1_500_000, 'VE-C': 550_000, 'VE-D': 1_500_000,
    'VE-E': 850_000, 'VE-F': 1_400_000, 'VE-G': 2_300_000, 'VE-H': 350_000,
    'VE-Y': 180_000, 'VE-W': 3_000, 'VE-I': 950_000, 'VE-J': 750_000,
    'VE-X': 350_000, 'VE-K': 1_800_000, 'VE-L': 900_000, 'VE-M': 2_700_000,
    'VE-N': 950_000, 'VE-O': 500_000, 'VE-P': 900_000, 'VE-R': 850_000,
    'VE-S': 1_200_000, 'VE-T': 700_000, 'VE-U': 600_000, 'VE-V': 3_700_000,
    'VE-Z': 180_000, 'VE-GE': 130_000,
  },
}

const HOMICIDIOS: Indicator = {
  id: 'homicidios',
  label: 'Tasa de homicidios',
  description: 'Homicidios por cada 100.000 habitantes',
  unit: 'por 100k',
  format: 'rate',
  year: 2023,
  source: 'OVV (Observatorio Venezolano de Violencia)',
  note: 'Datos ilustrativos · referencia OVV 2023',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: {
    'VE-A': 36, 'VE-B': 27, 'VE-C': 25, 'VE-D': 41, 'VE-E': 18, 'VE-F': 49,
    'VE-G': 32, 'VE-H': 16, 'VE-Y': 23, 'VE-W': 5, 'VE-I': 20, 'VE-J': 28,
    'VE-X': 18, 'VE-K': 23, 'VE-L': 14, 'VE-M': 30, 'VE-N': 27, 'VE-O': 17,
    'VE-P': 17, 'VE-R': 38, 'VE-S': 17, 'VE-T': 16, 'VE-U': 16, 'VE-V': 25,
    'VE-Z': 22, 'VE-GE': 22,
  },
}

// ---- Indicadores municipales (CSV 2026) ----

type MunicipalJson = {
  indicators: Record<string, Record<string, number>>
  stateAggregates: Record<string, Record<string, number>>
}
const muni = municipalData as MunicipalJson

const POBLACION_2026: Indicator = {
  id: 'poblacion_2026',
  label: 'Población 2026 · est. municipal',
  description: 'Población estimada por municipio',
  unit: 'habitantes',
  format: 'number',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  data: muni.indicators.poblacion_2026,
  stateAggregate: muni.stateAggregates.poblacion_2026,
}

const AREA: Indicator = {
  id: 'area_km2',
  label: 'Área · est. municipal',
  description: 'Superficie territorial',
  unit: 'km²',
  format: 'number',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  aggregation: 'municipality',
  data: muni.indicators.area_km2,
  stateAggregate: muni.stateAggregates.area_km2,
}

const PIB_TOTAL: Indicator = {
  id: 'pib_total',
  label: 'PIB total',
  description: 'Producto Interno Bruto total estimado',
  unit: 'MM USD',
  format: 'number',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  data: muni.indicators.pib_total_mm_usd,
  stateAggregate: muni.stateAggregates.pib_total_mm_usd,
}

const PIB_PER_CAPITA: Indicator = {
  id: 'pib_per_capita',
  label: 'PIB per cápita',
  description: 'PIB por habitante estimado',
  unit: 'USD',
  format: 'currency',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muni.indicators.pib_per_capita_usd,
  stateAggregate: muni.stateAggregates.pib_per_capita_usd,
}

const IDH_2026: Indicator = {
  id: 'idh_2026',
  label: 'IDH 2026',
  description: 'Índice de Desarrollo Humano municipal estimado',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muni.indicators.idh_2026,
  stateAggregate: muni.stateAggregates.idh_2026,
}

export const INDICATORS: Indicator[] = [
  POBLACION_INE_2026,
  POBLACION_INE_2050,
  POBLACION_WIKI_2021,
  POBLACION_2026,
  POBLACION_2024,
  IDH_2026,
  PIB_PER_CAPITA,
  PIB_TOTAL,
  AREA_WIKI,
  AREA,
  DENSIDAD_WIKI,
  HOMICIDIOS,
]

export function getIndicator(id: string): Indicator | undefined {
  return INDICATORS.find(i => i.id === id)
}

export function formatIndicatorValue(value: number, indicator: Indicator): string {
  if (indicator.format === 'decimal') return value.toFixed(3)
  if (indicator.format === 'rate') return value.toFixed(1)
  if (indicator.format === 'currency') {
    return value.toLocaleString('es-VE', { maximumFractionDigits: 0 })
  }
  // number
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + ' M'
  if (value >= 1_000) return value.toLocaleString('es-VE', { maximumFractionDigits: 0 })
  return value.toLocaleString('es-VE', { maximumFractionDigits: 1 })
}
