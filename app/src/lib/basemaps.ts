// Tile providers gratuitos sin API key.
// Si agregás Mapbox, Maptiler o similar más adelante, necesitan token.

export type BasemapId =
  | 'solid'
  | 'carto-light'
  | 'carto-light-nolabels'
  | 'carto-dark'
  | 'osm'
  | 'satellite'
  | 'topo'

export type Basemap = {
  id: BasemapId
  label: string
  short: string
  url: string
  attribution: string
  maxZoom: number
  preview: string // gradiente/color de fondo del swatch
}

export const BASEMAPS: Basemap[] = [
  {
    id: 'solid',
    label: 'Color sólido',
    short: 'Sólido',
    url: '',
    attribution: '',
    maxZoom: 19,
    preview: 'linear-gradient(135deg, #1f2937, #0f172a)',
  },
  {
    id: 'carto-light',
    label: 'Claro',
    short: 'Carto',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    preview: 'linear-gradient(135deg, #f6f6f4, #e2e2dd)',
  },
  {
    id: 'carto-light-nolabels',
    label: 'Minimalista',
    short: 'Sin nombres',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    preview: 'linear-gradient(135deg, #fafaf7, #ececec)',
  },
  {
    id: 'carto-dark',
    label: 'Oscuro',
    short: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    preview: 'linear-gradient(135deg, #2a2a2f, #14141a)',
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    short: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    preview: 'linear-gradient(135deg, #f2efe9, #d9ddc4)',
  },
  {
    id: 'satellite',
    label: 'Satélite',
    short: 'Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    preview: 'linear-gradient(135deg, #2d5a3d, #1e3a2f, #4a6741)',
  },
  {
    id: 'topo',
    label: 'Relieve',
    short: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
    preview: 'linear-gradient(135deg, #e8d8b8, #c9a875, #8b6f3d)',
  },
]

export function getBasemap(id: BasemapId): Basemap {
  return BASEMAPS.find(b => b.id === id) ?? BASEMAPS[0]
}
