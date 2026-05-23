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

// Features de la vista diáspora: países LATAM + ESP + USA con su cifra de
// migrantes venezolanos recibidos. iso_a3 es el código ISO 3166-1 alpha-3
// (Natural Earth lo usa como identidad estable).
export type DiasporaProps = {
  iso_a3: string
  name: string
  migrantes_ve: number | null
  as_of?: string | null
  source?: string | null
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
  | 'viridis' | 'rdbu' | 'brbg' | 'piyg' | 'spectral'
  | 'custom'
