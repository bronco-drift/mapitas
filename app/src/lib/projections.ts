// Catálogo de proyecciones disponibles para la vista Global.
// Las funciones d3 viven dentro de WorldMapView.tsx (lazy load); este archivo
// liviano solo expone los IDs y nombres para que el sidebar pueda armar el
// selector sin arrastrar d3 al bundle principal.

export type ProjectionId =
  | 'equalEarth'
  | 'orthographic'
  | 'naturalEarth'
  | 'mercator'
  | 'equirectangular'

export const PROJECTION_OPTIONS: { id: ProjectionId; name: string; isGlobe: boolean }[] = [
  { id: 'equalEarth', name: 'Equal Earth', isGlobe: false },
  { id: 'orthographic', name: 'Orthographic (globo)', isGlobe: true },
  { id: 'naturalEarth', name: 'Natural Earth', isGlobe: false },
  { id: 'mercator', name: 'Mercator', isGlobe: false },
  { id: 'equirectangular', name: 'Equirectangular', isGlobe: false },
]
