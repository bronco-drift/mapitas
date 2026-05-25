// Regiones de la vista Global. Cada región es un subconjunto de países
// (por ISO 3166-1 alpha-3) sobre el que se filtra `world-countries.geojson`.
// La proyección se auto-ajusta (fitExtent) al subset filtrado para que
// la región elegida ocupe todo el viewport.
//
// Útil para 2 casos:
//   1. Contexto: el user que solo quiere mirar Latinoamérica no necesita
//      ver Australia ni Asia en el viewport.
//   2. Painter: pintar "Iberoamérica" sin el ruido del resto del mundo.
//
// Datos por nivel de subdivisión (estados/munis de cada país) están
// FUERA del scope de este módulo — la región acá define qué países se
// muestran a nivel ADM0. Vistas con ADM1/ADM2 (Gran Colombia, USA con
// estados) requieren geojsons aparte y viven en otro flujo.

export type RegionId =
  | 'world'
  | 'latam'
  | 'south_america'
  | 'iberoamerica'
  | 'europe'
  | 'usa'

export type Region = {
  id: RegionId
  label: string
  short: string
  flag: string // emoji para el selector — coherente con el TopBar actual
  // ISO_A3 codes de los países incluidos. Vacío = "todos los del geojson".
  isos: string[]
}

// ─── Listas de países por región ──────────────────────────────────────────

// Latinoamérica: México + Centroamérica + Caribe hispano-francés + Sudamérica
// hispano-portuguesa. No incluye Belice, Jamaica, T&T (anglo) ni Surinam,
// Guyana (no hispano/portuguesa). El criterio es lingüístico-cultural,
// el más usado coloquialmente.
const LATAM = [
  // Norteamérica
  'MEX',
  // Centroamérica
  'GTM', 'HND', 'SLV', 'NIC', 'CRI', 'PAN',
  // Caribe
  'CUB', 'DOM', 'HTI',
  // Sudamérica
  'COL', 'VEN', 'ECU', 'PER', 'BOL', 'BRA', 'CHL', 'ARG', 'URY', 'PRY',
]

// Suramérica geográfica: los 12 países del continente. Incluye Guyanas
// (Surinam y Guyana ex-británica) más Brasil que LATAM omite por idioma.
const SOUTH_AMERICA = [
  'COL', 'VEN', 'ECU', 'PER', 'BOL', 'BRA', 'CHL', 'ARG', 'URY', 'PRY',
  'GUY', 'SUR',
]

// Iberoamérica: Latam + las dos naciones ibéricas. Es la definición de
// "Comunidad Iberoamericana de Naciones" (Cumbre Iberoamericana).
const IBEROAMERICA = [...LATAM, 'ESP', 'PRT']

// Europa: definición geográfica + UK y los micro-estados que tenga el geojson.
// Excluimos Rusia (geográficamente transcontinental, distorsiona el fit
// del viewport). Incluimos Reino Unido aunque post-Brexit no esté en UE
// — la vista es geográfica, no política.
const EUROPE = [
  // Norte
  'ISL', 'NOR', 'SWE', 'FIN', 'DNK', 'EST', 'LVA', 'LTU',
  // Occidental
  'IRL', 'GBR', 'NLD', 'BEL', 'LUX', 'FRA', 'DEU', 'CHE', 'AUT', 'LIE',
  // Sur
  'PRT', 'ESP', 'ITA', 'GRC', 'MLT', 'CYP', 'AND', 'MCO', 'SMR', 'VAT',
  // Centro/Este
  'POL', 'CZE', 'SVK', 'HUN', 'ROU', 'BGR', 'SVN', 'HRV', 'BIH', 'SRB',
  'MNE', 'MKD', 'ALB', 'KOS', 'MDA', 'UKR', 'BLR',
]

export const REGIONS: Region[] = [
  { id: 'world',         label: 'Mundo',          short: 'Mundo',  flag: '🌍', isos: [] },
  { id: 'latam',         label: 'Latinoamérica',  short: 'Latam',  flag: '🌎', isos: LATAM },
  { id: 'south_america', label: 'Suramérica',     short: 'Sur.',   flag: '🌎', isos: SOUTH_AMERICA },
  { id: 'iberoamerica',  label: 'Iberoamérica',   short: 'Iber.',  flag: '🌍', isos: IBEROAMERICA },
  { id: 'europe',        label: 'Europa',         short: 'Europa', flag: '🇪🇺', isos: EUROPE },
  { id: 'usa',           label: 'Estados Unidos', short: 'USA',    flag: '🇺🇸', isos: ['USA'] },
]

export function getRegion(id: RegionId): Region {
  return REGIONS.find(r => r.id === id) ?? REGIONS[0]
}

// Helper: ¿pertenece este iso_a3 a la región activa? Si la región no tiene
// filtro (isos vacío = "todos"), siempre true.
export function isInRegion(iso: string | undefined, region: Region): boolean {
  if (!iso) return false
  if (region.isos.length === 0) return true
  return region.isos.includes(iso)
}
