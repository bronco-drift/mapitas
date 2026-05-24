// Catálogo de indicadores que la app muestra como opciones de mapeo.
//
// La data viene del master consolidado en data/master/, exportado en versión
// flat a app/src/data/master-municipalities.json y master-states.json.
//
// Regenerar: `node scripts/build-master.mjs` (consolida 4 fuentes con
// precedencia explícita por campo). El master tiene los valores ya elegidos
// por calidad — INE para serie 2010-2050, Excel/Wiki para 2021, sintético
// solo donde es la única fuente (IDH, PIB).
//
// Los 2 indicadores `aggregation: 'state'` (Población 2024 legacy y Homicidios
// OVV) no viven en el master porque son data hardcoded a nivel estado.

import masterMunisRaw from './master-municipalities.json'
import masterStatesRaw from './master-states.json'

type MasterMuniRecord = {
  id: string
  external_id: string
  name: string
  parent_iso: string
  parent_state: string
  poblacion_2010?: number
  poblacion_2020?: number
  poblacion_2026?: number
  poblacion_2050?: number
  poblacion_2021?: number
  poblacion_capital_2021?: number
  porcentaje_urbano_2021?: number
  area_km2?: number
  densidad?: number
  capital?: string
  idh?: number
  pib_total_mm_usd?: number
  pib_per_capita_usd?: number
}
type MasterStateRecord = {
  iso: string
  name: string
  muni_count: number
  poblacion_2010?: number
  poblacion_2020?: number
  poblacion_2026?: number
  poblacion_2050?: number
  poblacion_2021?: number
  poblacion_capital_2021?: number
  porcentaje_urbano_2021?: number
  area_km2?: number
  densidad?: number
  idh?: number
  pib_total_mm_usd?: number
  pib_per_capita_usd?: number
  // State-only (no se agregan desde munis): IDH histórico oficial
  idh_1990?: number
  idh_2000?: number
  idh_2010?: number
  idh_2020?: number
  idh_cambio_2010_2020?: number
}

const munis = masterMunisRaw as Record<string, MasterMuniRecord>
const states = masterStatesRaw as Record<string, MasterStateRecord>

type NumericMuniField = keyof Omit<MasterMuniRecord, 'id' | 'external_id' | 'name' | 'parent_iso' | 'parent_state' | 'capital'>
type NumericStateField = keyof Omit<MasterStateRecord, 'iso' | 'name' | 'muni_count'>

function muniField(field: NumericMuniField): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [sid, m] of Object.entries(munis)) {
    const v = m[field]
    if (typeof v === 'number') out[sid] = v
  }
  return out
}

function stateField(field: NumericStateField): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [iso, s] of Object.entries(states)) {
    const v = s[field]
    if (typeof v === 'number') out[iso] = v
  }
  return out
}

// ─── Tipo público ─────────────────────────────────────────────────────────

export type IndicatorAggregation = 'state' | 'municipality'

// Categoría temática para agrupar indicadores en el panel. Hoy son 5:
//   demografia  → población, densidad, área, % urbano
//   desarrollo  → IDH y derivados
//   economia    → PIB total / per cápita
//   seguridad   → homicidios, otros delitos a futuro
//   identidad   → banderas, escudos, vista política (categóricos/simbólicos)
// Si el campo es undefined el indicador cae en "Otros" al final de la lista.
export type IndicatorCategory =
  | 'demografia'
  | 'desarrollo'
  | 'economia'
  | 'seguridad'
  | 'identidad'

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  demografia: 'Demografía',
  desarrollo: 'Desarrollo humano',
  economia: 'Economía',
  seguridad: 'Seguridad',
  identidad: 'Identidad y cultura',
}

// Orden visible en el panel (primero los más usados).
export const CATEGORY_ORDER: IndicatorCategory[] = [
  'demografia',
  'desarrollo',
  'economia',
  'seguridad',
  'identidad',
]

export type Indicator = {
  id: string
  label: string
  description: string
  unit: string
  format: 'number' | 'decimal' | 'rate' | 'currency'
  category?: IndicatorCategory
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
  // Si true, los munis sin data específica heredan el stateAggregate del
  // estado padre. Sin esta flag, quedan gris (honestidad de datos).
  inheritFromState?: boolean
  // Restringe el indicador a un único nivel administrativo. Útil para
  // indicadores simbólicos (banderas/escudos) cuya imagen solo tiene
  // sentido en su nivel propio (ej. "Banderas munis" no aplica en vista
  // estados aunque tenga data muni). En otros niveles queda archivado y
  // disabled. Sin restricción, el indicador se puede ver en otros niveles
  // vía agregación natural (sum/mean).
  restrictedTo?: import('../lib/types').AdmLevel
  // Grupo de indicadores intercambiables al cambiar de nivel. Ej. los 3
  // "Banderas" (país/estados/munis) comparten group='banderas': cuando el
  // user cambia de nivel, el store autoswitchea al variant del nivel nuevo.
  // Permite UX de "navego por niveles viendo las banderas" sin tener que
  // re-seleccionar el indicador cada vez.
  // 'politico' es el mapa categórico de identidad: cada estado/muni con su
  // propio color, sin codificar valor numérico. Es el default al primer load.
  group?: 'banderas' | 'escudos' | 'politico'
}

// ─── Paleta categórica para vista política ────────────────────────────────
//
// 26 colores curados (1 por entidad federal venezolana) en tonos medios,
// saturación media, evitando vecinos confundibles. Pensado para legibilidad
// inmediata: el usuario ve los estados como bloques distintos sin sobrecarga
// visual. No es accesible color-blind perfecto, pero los iso adyacentes
// alfabéticamente tienen hues bien separados (anti-clustering).

const STATE_ISOS_ORDERED = [
  'VE-A', 'VE-B', 'VE-C', 'VE-D', 'VE-E', 'VE-F', 'VE-G', 'VE-H',
  'VE-I', 'VE-J', 'VE-K', 'VE-L', 'VE-M', 'VE-N', 'VE-O', 'VE-P',
  'VE-R', 'VE-S', 'VE-T', 'VE-U', 'VE-V', 'VE-W', 'VE-X', 'VE-Y',
  'VE-Z', 'VE-GE',
]

const CATEGORICAL_26 = [
  '#5b8def', '#f4a261', '#e76f51', '#2a9d8f', '#8ab17d',
  '#e9c46a', '#a663cc', '#f08080', '#9c6b50', '#9eb1b8',
  '#5fa8b4', '#d4a5d4', '#b5b85a', '#e89b5c', '#7d99ad',
  '#c08866', '#86b89a', '#dd7878', '#9b9b7a', '#6c8ead',
  '#d4a373', '#7c9070', '#b88173', '#779ecb', '#c4946d',
  '#8a90b8',
]

export function colorForState(iso: string): string {
  const idx = STATE_ISOS_ORDERED.indexOf(iso)
  return idx >= 0 ? CATEGORICAL_26[idx] : '#cbd5e1'
}

// ─── Paleta para vista política a nivel municipal ─────────────────────────
//
// 6 colores para colorear los ~335 munis sin que dos vecinos compartan tono.
// La asignación de muni → índice viene del script compute-muni-coloring.mjs
// (greedy graph coloring sobre el grafo de adyacencias del TopoJSON). Los
// vecinos directos siempre tienen distinto índice; con 5 colores alcanza
// para Venezuela. Es el patrón clásico de los mapas políticos en papel.

import muniColoringRaw from './muni-coloring.json'
const MUNI_COLORING = muniColoringRaw as Record<string, number>

const MUNI_PALETTE_6 = [
  '#5b8def', // azul
  '#f4a261', // naranja cálido
  '#2a9d8f', // teal
  '#e76f51', // coral
  '#a663cc', // púrpura
  '#e9c46a', // amarillo cálido
]

export function colorForMuni(sourceID: string): string {
  const idx = MUNI_COLORING[sourceID]
  return idx != null ? MUNI_PALETTE_6[idx % MUNI_PALETTE_6.length] : '#cbd5e1'
}

// ─── Indicadores del master (data trazada) ────────────────────────────────

const POBLACION_INE_2026: Indicator = {
  id: 'poblacion_ine_2026',
  category: 'demografia',
  label: 'Población 2026 · INE',
  description: 'Proyección oficial INE basada en censo 2011',
  unit: 'habitantes',
  format: 'number',
  year: 2026,
  source: 'INE Venezuela (proyecciones)',
  note: 'Faltan los municipios de Lara, Nueva Esparta y Dep. Federales',
  aggregation: 'municipality',
  data: muniField('poblacion_2026'),
  stateAggregate: stateField('poblacion_2026'),
}

const POBLACION_INE_2050: Indicator = {
  id: 'poblacion_ine_2050',
  category: 'demografia',
  label: 'Población 2050 · INE',
  description: 'Proyección poblacional al año 2050 del INE',
  unit: 'habitantes',
  format: 'number',
  year: 2050,
  source: 'INE Venezuela (proyecciones)',
  note: 'Proyección de largo plazo, base censo 2011',
  aggregation: 'municipality',
  data: muniField('poblacion_2050'),
  stateAggregate: stateField('poblacion_2050'),
}

const POBLACION_2021: Indicator = {
  id: 'poblacion_wiki_2021',
  category: 'demografia',
  label: 'Población 2021 · Excel/INE',
  description: 'Población municipal según INE 2021',
  unit: 'habitantes',
  format: 'number',
  year: 2021,
  source: 'Excel del proyecto + INE 2021 (Wiki como respaldo)',
  aggregation: 'municipality',
  data: muniField('poblacion_2021'),
  stateAggregate: stateField('poblacion_2021'),
}

const AREA: Indicator = {
  id: 'area_wiki',
  category: 'demografia',
  label: 'Área · Excel/INE',
  description: 'Superficie territorial en km²',
  unit: 'km²',
  format: 'number',
  year: 2021,
  source: 'Excel del proyecto + INE/IGVSB (Wiki como respaldo)',
  aggregation: 'municipality',
  data: muniField('area_km2'),
  stateAggregate: stateField('area_km2'),
}

const DENSIDAD: Indicator = {
  id: 'densidad_wiki',
  category: 'demografia',
  label: 'Densidad · Excel/INE',
  description: 'Habitantes por km²',
  unit: 'hab/km²',
  format: 'rate',
  year: 2021,
  source: 'Excel del proyecto + INE 2021 (calculado pob/área)',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muniField('densidad'),
  stateAggregate: stateField('densidad'),
}

// Los siguientes vienen del CSV sintético original — eran la única fuente
// disponible para PIB/IDH municipal en Venezuela. Marcamos honestamente que
// son estimaciones, y la cobertura es parcial (~46% de los munis).

const IDH: Indicator = {
  id: 'idh_2026',
  category: 'desarrollo',
  label: 'IDH 2026 · estimado',
  description: 'Índice de Desarrollo Humano municipal',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 2026,
  source: 'Estimaciones del proyecto',
  note: 'No hay fuente oficial pública de IDH municipal en Venezuela. Para data oficial estatal usá IDH 2020 · CV',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muniField('idh'),
  stateAggregate: stateField('idh'),
}

const PIB_TOTAL: Indicator = {
  id: 'pib_total',
  category: 'economia',
  label: 'PIB total · estimado',
  description: 'Producto Interno Bruto total',
  unit: 'MM USD',
  format: 'number',
  year: 2026,
  source: 'Estimaciones del proyecto',
  note: 'El BCV no publica cuentas regionales municipales. Usar como referencia, no como dato oficial',
  aggregation: 'municipality',
  data: muniField('pib_total_mm_usd'),
  stateAggregate: stateField('pib_total_mm_usd'),
}

const PIB_PER_CAPITA: Indicator = {
  id: 'pib_per_capita',
  category: 'economia',
  label: 'PIB per cápita · estimado',
  description: 'PIB por habitante',
  unit: 'USD',
  format: 'currency',
  year: 2026,
  source: 'Estimaciones del proyecto',
  note: 'El BCV no publica PIB municipal. Usar como referencia, no como dato oficial',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muniField('pib_per_capita_usd'),
  stateAggregate: stateField('pib_per_capita_usd'),
}

// ─── Source CV: indicadores municipales y estatales del Excel del user ──

const PCT_URBANO: Indicator = {
  id: 'porcentaje_urbano_2021',
  category: 'demografia',
  label: '% en cabecera · CV',
  description: 'Población viviendo en la capital del municipio (sobre el total municipal)',
  unit: '%',
  format: 'rate',
  year: 2021,
  source: 'Source CV (INE 2021 · capital del muni / población total)',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muniField('porcentaje_urbano_2021'),
  stateAggregate: stateField('porcentaje_urbano_2021'),
}

const IDH_1990_CV: Indicator = {
  id: 'idh_1990_cv',
  category: 'desarrollo',
  label: 'IDH 1990 · CV',
  description: 'Índice de Desarrollo Humano por entidad federal en 1990',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 1990,
  source: 'Source CV (PNUD / recopilación histórica)',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('idh_1990'),
}

const IDH_2000_CV: Indicator = {
  id: 'idh_2000_cv',
  category: 'desarrollo',
  label: 'IDH 2000 · CV',
  description: 'Índice de Desarrollo Humano por entidad federal en 2000',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 2000,
  source: 'Source CV (PNUD / recopilación histórica)',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('idh_2000'),
}

const IDH_2010_CV: Indicator = {
  id: 'idh_2010_cv',
  category: 'desarrollo',
  label: 'IDH 2010 · CV',
  description: 'Índice de Desarrollo Humano por entidad federal en 2010',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 2010,
  source: 'Source CV (PNUD / recopilación histórica)',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('idh_2010'),
}

const IDH_2020_CV: Indicator = {
  id: 'idh_2020_cv',
  category: 'desarrollo',
  label: 'IDH 2020 · CV',
  description: 'Índice de Desarrollo Humano oficial por entidad federal en 2020',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 2020,
  source: 'Source CV (PNUD / recopilación histórica)',
  note: 'Data oficial 2020. Para versión municipal usá IDH 2026 · estimado',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('idh_2020'),
}

const IDH_CAMBIO: Indicator = {
  id: 'idh_cambio_2010_2020_cv',
  category: 'desarrollo',
  label: 'Cambio IDH 2010–2020 · CV',
  description: 'Variación del IDH entre 2010 y 2020 (negativo = retroceso)',
  unit: 'Δ índice',
  format: 'decimal',
  year: 2020,
  source: 'Source CV (calculado IDH 2020 - IDH 2010)',
  note: 'Todos los estados muestran retroceso entre 2010 y 2020',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('idh_cambio_2010_2020'),
}

// ─── Indicadores estatales (hardcoded, no viven en el master) ─────────────

const POBLACION_2024: Indicator = {
  id: 'poblacion_2024',
  category: 'demografia',
  label: 'Población 2024 · aprox. estatal',
  description: 'Aproximación estatal preexistente, números redondeados',
  unit: 'habitantes',
  format: 'number',
  year: 2024,
  source: 'Aproximación del proyecto (no oficial)',
  note: 'Para data oficial usá Población 2026 · INE',
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

// Indicadores especiales simbólicos: en lugar de un dato cuantitativo,
// muestran la bandera o escudo oficial de cada entidad recortado al
// polígono geográfico. Cosechados desde Wikidata + Wikimedia Commons.
// La cobertura está en wiki-info.json; los que no tienen símbolo
// disponible aparecen en gris claro.

// data ficticio (1 por entidad) para que getIndicatorCoverage cuente
// correctamente las entidades disponibles a cada nivel.
function _buildSymbolData(level: 'state' | 'muni', kind: 'flag' | 'shield'): Record<string, number> {
  const key = kind === 'flag' ? 'hasFlag' : 'hasShield'
  // Lectura lazy para evitar circular import. wiki-info.json es JSON puro.
  const wiki = wikiInfoRaw as { states: Record<string, Record<string, unknown>>; munis: Record<string, Record<string, unknown>> }
  const source = level === 'state' ? wiki.states : wiki.munis
  const out: Record<string, number> = {}
  for (const [id, info] of Object.entries(source)) {
    if (info[key]) out[id] = 1
  }
  return out
}

import wikiInfoRaw from './wiki-info.json'

// Los 6 indicadores simbólicos comparten 2 grupos: 'banderas' y 'escudos'.
// El store autoswitch entre variants al cambiar de nivel — el user navega
// "viendo banderas" sin re-seleccionar.

// ─── Vista política (mapa categórico, default al primer load) ─────────────
//
// No codifica un valor numérico: cada entidad recibe un color de la paleta
// categórica. Sirve como mapa orientador cuando el usuario todavía no eligió
// un indicador concreto. La paleta es estable (el mismo estado siempre tiene
// el mismo color), no depende de la paleta global del style.
// `_value: 1` por entidad para que el merge la cuente como "matched".

const POLITICO_PAIS: Indicator = {
  id: 'politico_pais',
  category: 'identidad',
  label: 'Vista política · País',
  description: 'Venezuela como bloque institucional',
  unit: 'sin unidad',
  format: 'number',
  year: 0,
  source: 'División político-administrativa oficial',
  aggregation: 'state',
  restrictedTo: 'adm0',
  group: 'politico',
  data: { VE: 1 },
}

const POLITICO_ESTADOS: Indicator = {
  id: 'politico_estados',
  category: 'identidad',
  label: 'Vista política · Estados',
  description: 'Cada estado con su color de identidad',
  unit: 'sin unidad',
  format: 'number',
  year: 0,
  source: 'División político-administrativa oficial',
  aggregation: 'state',
  restrictedTo: 'adm1',
  group: 'politico',
  data: Object.fromEntries(STATE_ISOS_ORDERED.map(iso => [iso, 1])),
}

const POLITICO_MUNIS: Indicator = {
  id: 'politico_munis',
  category: 'identidad',
  label: 'Vista política · Municipios',
  description: 'Municipios coloreados por estado padre',
  unit: 'sin unidad',
  format: 'number',
  year: 0,
  source: 'División político-administrativa oficial',
  aggregation: 'municipality',
  restrictedTo: 'adm2',
  group: 'politico',
  data: Object.fromEntries(Object.keys(munis).map(sid => [sid, 1])),
}

const BANDERAS_PAIS: Indicator = {
  id: 'banderas_pais',
  category: 'identidad',
  label: 'Bandera nacional · Cultural',
  description: 'Bandera oficial de la República Bolivariana de Venezuela',
  unit: 'simbólico',
  format: 'number',
  year: 0,
  source: 'Wikimedia Commons',
  aggregation: 'state',
  restrictedTo: 'adm0',
  group: 'banderas',
  data: { VE: 1 },
}

const ESCUDOS_PAIS: Indicator = {
  id: 'escudos_pais',
  category: 'identidad',
  label: 'Escudo nacional · Cultural',
  description: 'Escudo de armas oficial de Venezuela',
  unit: 'simbólico',
  format: 'number',
  year: 0,
  source: 'Wikimedia Commons',
  aggregation: 'state',
  restrictedTo: 'adm0',
  group: 'escudos',
  data: { VE: 1 },
}

const BANDERAS_ESTADOS: Indicator = {
  id: 'banderas_estados',
  category: 'identidad',
  label: 'Banderas estados · Cultural',
  description: 'Bandera oficial de cada entidad federal venezolana',
  unit: 'simbólico',
  format: 'number',
  year: 0,
  source: 'Wikidata + Wikimedia Commons',
  note: 'Entidades sin bandera oficial documentada aparecen en gris.',
  aggregation: 'state',
  restrictedTo: 'adm1',
  group: 'banderas',
  data: _buildSymbolData('state', 'flag'),
}

const ESCUDOS_ESTADOS: Indicator = {
  id: 'escudos_estados',
  category: 'identidad',
  label: 'Escudos estados · Cultural',
  description: 'Escudo oficial de cada entidad federal venezolana',
  unit: 'simbólico',
  format: 'number',
  year: 0,
  source: 'Wikidata + Wikimedia Commons',
  note: 'Entidades sin escudo oficial documentado aparecen en gris.',
  aggregation: 'state',
  restrictedTo: 'adm1',
  group: 'escudos',
  data: _buildSymbolData('state', 'shield'),
}

const BANDERAS_MUNIS: Indicator = {
  id: 'banderas_munis',
  category: 'identidad',
  label: 'Banderas munis · Cultural',
  description: 'Bandera oficial de cada municipio venezolano',
  unit: 'simbólico',
  format: 'number',
  year: 0,
  source: 'Wikidata + Wikimedia Commons',
  note: 'Cobertura aproximada 57%. Municipios sin bandera oficial documentada aparecen en gris.',
  aggregation: 'municipality',
  restrictedTo: 'adm2',
  group: 'banderas',
  data: _buildSymbolData('muni', 'flag'),
}

const ESCUDOS_MUNIS: Indicator = {
  id: 'escudos_munis',
  category: 'identidad',
  label: 'Escudos munis · Cultural',
  description: 'Escudo oficial de cada municipio venezolano',
  unit: 'simbólico',
  format: 'number',
  year: 0,
  source: 'Wikidata + Wikimedia Commons',
  note: 'Cobertura aproximada 72%. Municipios sin escudo oficial documentado aparecen en gris.',
  aggregation: 'municipality',
  restrictedTo: 'adm2',
  group: 'escudos',
  data: _buildSymbolData('muni', 'shield'),
}

const HOMICIDIOS: Indicator = {
  id: 'homicidios',
  category: 'seguridad',
  label: 'Tasa homicidios · OVV',
  description: 'Homicidios por cada 100.000 habitantes',
  unit: 'por 100k',
  format: 'rate',
  year: 2023,
  source: 'OVV (Observatorio Venezolano de Violencia)',
  note: 'Cifras ilustrativas con referencia OVV 2023',
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

// ─── Catálogo público ─────────────────────────────────────────────────────

export const INDICATORS: Indicator[] = [
  // Vista política primero: es el default al primer load y el "mapa neutral"
  // de orientación. El user puede saltar a cualquier otro desde la lista.
  POLITICO_PAIS,
  POLITICO_ESTADOS,
  POLITICO_MUNIS,
  POBLACION_INE_2026,
  POBLACION_INE_2050,
  POBLACION_2021,
  AREA,
  DENSIDAD,
  PCT_URBANO,
  IDH_2020_CV,
  IDH_2010_CV,
  IDH_2000_CV,
  IDH_1990_CV,
  IDH_CAMBIO,
  IDH,
  PIB_PER_CAPITA,
  PIB_TOTAL,
  POBLACION_2024,
  HOMICIDIOS,
  BANDERAS_PAIS,
  BANDERAS_ESTADOS,
  BANDERAS_MUNIS,
  ESCUDOS_PAIS,
  ESCUDOS_ESTADOS,
  ESCUDOS_MUNIS,
]

// Lookup para auto-switch: dado un grupo + nivel, devuelve el indicador
// que aplica. Usado por el store cuando setLevel cambia mientras hay un
// indicador simbólico activo, para mantener el "concepto" del user.
export function getIndicatorByGroupAndLevel(
  group: 'banderas' | 'escudos' | 'politico',
  level: 'adm0' | 'adm1' | 'adm2',
): Indicator | undefined {
  return INDICATORS.find(i => i.group === group && i.restrictedTo === level)
}

// Mapeo de IDs deprecados → IDs canónicos. Mantiene retro-compatibilidad
// con la persistencia (localStorage) de users que tenían seleccionados
// indicadores que ya no existen como separados.
//   poblacion_2026 era el sintético → ahora apunta a la versión INE
//   area_km2 era el sintético       → ahora apunta a Área (Excel/Wiki)
const LEGACY_ID_ALIAS: Record<string, string> = {
  poblacion_2026: 'poblacion_ine_2026',
  area_km2: 'area_wiki',
}

export function getIndicator(id: string): Indicator | undefined {
  const canonical = LEGACY_ID_ALIAS[id] ?? id
  return INDICATORS.find(i => i.id === canonical)
}

// ─── Cobertura del indicador a un nivel dado ──────────────────────────────
// Sirve para mostrar en la UI si el indicador aplica al nivel actual y
// cuántas entidades quedan sin data. Se calcula en O(N) sobre las keys del
// indicator.data — barato porque son al sumo ~340 entradas.

export type IndicatorCoverage = {
  covered: number       // entidades con valor numérico
  total: number         // total de entidades a ese nivel (estados=26 o munis=336)
  missing: number       // total - covered
  applies: boolean      // si el indicador es informativo al nivel actual
  reason?: string       // si no aplica, explicación corta
}

export function getIndicatorCoverage(
  indicator: Indicator,
  level: 'adm0' | 'adm1' | 'adm2',
  totals: { adm1Count: number; adm2Count: number },
): IndicatorCoverage {
  // Restricción explícita por nivel (banderas/escudos solo en su nivel).
  // Si el indicador declara restrictedTo, en cualquier otro nivel queda
  // marcado como no-aplica (se archiva en la UI).
  if (indicator.restrictedTo && indicator.restrictedTo !== level) {
    const friendly =
      indicator.restrictedTo === 'adm1' ? 'Solo a nivel estado'
      : indicator.restrictedTo === 'adm2' ? 'Solo a nivel municipal'
      : 'Solo a nivel país'
    const total = level === 'adm0' ? 1 : level === 'adm1' ? totals.adm1Count : totals.adm2Count
    return { covered: 0, total, missing: total, applies: false, reason: friendly }
  }

  // País: siempre 1 valor (un agregado nacional), no tiene sentido medir
  // cobertura. Aplica.
  if (level === 'adm0') {
    return { covered: 1, total: 1, missing: 0, applies: true }
  }

  if (level === 'adm1') {
    // En vista estados, contamos contra los 26 estados.
    // state aggregation -> usa indicator.data directo
    // municipality aggregation -> usa stateAggregate precomputado
    const data =
      indicator.aggregation === 'state'
        ? indicator.data
        : (indicator.stateAggregate ?? {})
    const covered = Object.values(data).filter(v => typeof v === 'number').length
    return {
      covered,
      total: totals.adm1Count,
      missing: totals.adm1Count - covered,
      applies: true,
    }
  }

  // level === 'adm2' (municipios)
  if (indicator.aggregation === 'state') {
    // Un indicador estatal puede heredarse a sus munis (todos del mismo
    // estado quedan del mismo color), pero eso no es informativo a nivel muni.
    // Lo marcamos como "no aplica" para que la UI lo deshabilite.
    return {
      covered: 0,
      total: totals.adm2Count,
      missing: totals.adm2Count,
      applies: false,
      reason: 'Solo a nivel estado',
    }
  }
  const covered = Object.values(indicator.data).filter(v => typeof v === 'number').length
  return {
    covered,
    total: totals.adm2Count,
    missing: totals.adm2Count - covered,
    applies: true,
  }
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
