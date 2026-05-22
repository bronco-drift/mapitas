import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'

export type AdmLevel = 'adm0' | 'adm1' | 'adm2'

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

export type PaletteId = 'reds' | 'blues' | 'greens' | 'viridis' | 'rdbu' | 'custom'
