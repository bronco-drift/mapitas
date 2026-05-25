import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export type AdmLevel = 'adm0' | 'adm1' | 'adm2'

// Vista del producto: Venezuela (mapa interno con Leaflet + tiles) vs
// Global (mapa mundial con d3-geo + proyecciones elegibles). La vista
// Global cubre tanto la diáspora venezolana como cualquier futuro indicador
// comparativo entre países (IDH, esperanza de vida, etc.).
export type ViewMode = 'venezuela' | 'global'

export type Adm0Props = {
  name: string
  nombreOficial?: string
  iso: string
  nameKey: string
  sourceID: string
  _value?: number | null
  _color?: string | null
  _matched?: boolean
}

export type Adm1Props = {
  name: string
  nombreOficial?: string
  iso: string
  nameKey: string
  isDisputed: boolean
  sourceID: string
  capital?: string
  region?: string
  note?: string
  sourceFeatures?: number
  _value?: number | null
  _color?: string | null
  _matched?: boolean
}

export type Adm2Props = {
  name: string
  nombreOficial?: string
  nameKey: string
  parentState: string | null
  parentISO: string | null
  parentStateKey: string | null
  compoundKey: string | null
  sourceID: string
  sourceFeatures?: number
  _value?: number | null
  _color?: string | null
  _matched?: boolean
}

export type AdmGeoJSON<P> = FeatureCollection<Polygon | MultiPolygon, P>

// Features de la vista Global: países UN-reconocidos con su cifra de
// migrantes venezolanos recibidos + indicadores comparativos (población,
// PIB pc, IDH). iso_a3 es el código ISO 3166-1 alpha-3 (Natural Earth lo
// usa como identidad estable).
//
// Los campos `pib_per_capita_usd` e `idh` NO viven en el geojson en disco:
// se mergean at runtime desde world-indicators.json en loadDiasporaData,
// para mantener el geojson liviano y poder actualizar los indicadores sin
// regenerar la geometría.
export type DiasporaProps = {
  iso_a3: string
  name: string
  migrantes_ve: number | null
  // Población total del país (UN 2024, redondeada). Cobertura completa
  // para los países con migrantes_ve, parcial para el resto. Usada en
  // los modos 'porcentaje' (vs migrantes) y 'poblacion' (vista absoluta).
  poblacion_total?: number | null
  // PIB per cápita en USD nominal (Banco Mundial 2023). null cuando la
  // fuente oficial no publica (Venezuela: BM cortó en 2014, usamos FMI).
  pib_per_capita_usd?: number | null
  // Índice de Desarrollo Humano (PNUD HDR 2023/24, datos 2022). null para
  // territorios no incluidos en el reporte (Taiwán, Kosovo, etc.).
  idh?: number | null
  as_of?: string | null
  source?: string | null
  // true para el país origen (Venezuela). En modo 'migrantes' la excluye
  // del cálculo del rango y la pinta granate. En el resto de los modos
  // entra al gradiente normalmente (su valor SÍ es comparable).
  is_origin?: boolean
  _value?: number | null
  _color?: string | null
  _matched?: boolean
}

export type UserRow = {
  [key: string]: string | number | null
}

export type UploadedDataset = {
  filename: string
  rows: UserRow[]
  columns: string[]
  geoColumn: string | null
  valueColumn: string | null
  parentColumn: string | null
}

export type PaletteId =
  | 'blues' | 'reds' | 'greens' | 'oranges' | 'purples' | 'teals' | 'pinks' | 'grays'
  | 'sky' | 'emerald' | 'slate'
  | 'viridis' | 'rdbu' | 'brbg' | 'piyg' | 'spectral'
  | 'custom'
