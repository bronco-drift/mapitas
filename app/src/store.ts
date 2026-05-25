import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { feature as topoFeature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type {
  Adm0Props,
  Adm1Props,
  Adm2Props,
  AdmGeoJSON,
  AdmLevel,
  DiasporaProps,
  PaletteId,
  UploadedDataset,
  ViewMode,
} from './lib/types'
import {
  mergeUserDataIntoGeo,
  type MergeStats,
} from './lib/merge-data'
import {
  applyDiaspora,
  applyIndicatorToAdm0,
  applyIndicatorToAdm1,
  applyIndicatorToAdm2,
  type IndicatorStats,
} from './lib/apply-indicator'
import { getIndicator, getIndicatorByGroupAndLevel, type Indicator } from './data/indicators'

export type DataSource =
  | { kind: 'indicator'; indicator: Indicator }
  | { kind: 'upload'; dataset: UploadedDataset }
  | null

export type AnyStats = MergeStats | IndicatorStats

export type MapStyle = {
  lineWidth: number
  borderColor: string
  bgColor: string
  isolateCountry: boolean
  stateOverlayInMuni: boolean
  customStart: string
  customEnd: string
  // 0..1 — posición del centro del gradiente. 0.5 = lineal estándar.
  // Mover hacia 0 = el lado izq del gradiente se comprime, el der se estira.
  paletteMidpoint: number
  basemap: import('./lib/basemaps').BasemapId
  fillOpacity: number
  borderOpacity: number
  transparentBg: boolean
  noBorders: boolean
  countryBorder: boolean
  // Si true (default), el rango automático del color recorta outliers
  // usando percentiles 2/98. Si false, usa el min/max raw.
  autoClipExtremes: boolean
  // Tema visual de la vista Global (d3-geo). No aplica a vista VE.
  // Mantenemos el type literal acá (no import) para que el bundler no
  // arrastre globe-themes al chunk del store.
  globeTheme: 'day' | 'night' | 'editorial' | 'cosmos'
  // Toggle "Etiquetas": muestra overlay de labels (Carto only_labels) encima
  // del basemap. Permite tener el mapa limpio por default y nombres a demanda.
  showLabels: boolean
}

export type ThematicMeta = {
  id: string
  label: string
  color: string
  file: string
  featureCount: number
  sizeKB: number
  geometryType: string
  // Si true (capa de puntos), muestra el label permanente al lado de cada
  // punto en lugar de solo en hover. Útil para capitales con pocos features.
  permanentLabels?: boolean
  // Key del feature.properties que se usa como label visible.
  // Si no se especifica, usa la primera property encontrada.
  labelKey?: string
  // Si true, la línea se dibuja punteada (dashArray). Sólo aplica a
  // LineString/MultiLineString. Sirve para distinguir versiones (oficial
  // vs reclamada, por ejemplo) de la misma capa.
  dashed?: boolean
  // Weight override (px). Si no se especifica, usa el default por tipo de
  // geometría en thematicStyleFor.
  weight?: number
}

export type ThematicState = {
  meta: ThematicMeta
  enabled: boolean
  loading: boolean
  data: unknown | null
  error?: string | null
}

// Overrides editables por el user sobre los defaults de cada capa temática
// (definidos en manifest.json → ThematicMeta). Todos los campos son opcionales;
// los que no se setean usan el default del meta. Persistido en localStorage
// por id de capa para que el user no pierda sus customizaciones.
//
// `label*` aplican sólo a capas de puntos con labels (permanentLabels=true).
// El estilo se inyecta como HTML inline en el tooltip de Leaflet, así que
// soporta más libertad que el className fijo viejo (`thematic-label-permanent`).
export type ThematicOverride = {
  // Estilo del shape (polígono / línea / punto)
  color?: string
  fillOpacity?: number // 0..1
  opacity?: number // 0..1 (línea/borde)
  weight?: number // px
  dashed?: boolean
  // Estilo del label permanente (solo capas con permanentLabels)
  labelBold?: boolean
  labelItalic?: boolean
  labelFontSize?: number // px (default 11)
  labelFontFamily?: 'sans' | 'serif' | 'mono'
  labelAlign?: 'left' | 'center' | 'right'
  labelColor?: string
  labelBg?: string // background del label, '' para transparente
  labelBgOpacity?: number // 0..1
}

// Tweaks editables del tema/basemap Cosmos. Defaults preservan la estética
// "mapamundi atlas escolar" del preset. El user puede:
//   - cambiar los 3 colores base (fondo del Global, océano, países sin data)
//   - ajustar densidad de estrellas (vista Global)
//   - ajustar intensidad del halo atmosférico del globo
// Estas mods aplican tanto al tema 'cosmos' del globo (vista Global) como
// al basemap 'cosmos' (vista VE), porque comparten paleta conceptualmente.
export type CosmosTweaks = {
  space: string
  globe: string
  missing: string
  starsDensity: number // 0..3 (1 = density default; 0 = sin estrellas)
  haloIntensity: number // 0..1 (floodOpacity del drop shadow)
  // Highlight 3D del globo (radial gradient):
  //   - highlightX / highlightY: posición del centro del gradient en % del
  //     bounding box del sphere. (35, 30) = upper-left, simulando luz desde
  //     arriba a la izquierda. Mover hacia 50/50 lo centra (look más plano);
  //     hacia 80/80 lo lleva al opuesto.
  //   - highlightIntensity: multiplicador del lighten/darken aplicado a los
  //     stops del gradient. 0 = sin efecto (color plano), 1 = default
  //     (lighten 35% / darken 30%), 2 = exagerado.
  highlightX: number // 0..100 %
  highlightY: number // 0..100 %
  highlightIntensity: number // 0..2
}

// ─── Painter (Hacer tu propio mapa) ───────────────────────────────────────
// Feature estilo mapchart.net: el user pinta features (estados VE o países)
// con el color activo. No vive en ruta aparte — es un tab más del
// ControlPanel ("Dibujar") que comparte TopBar, mapa y panel Estilo
// (basemap, fondo, bordes). Cuando el tab activo es 'dibujar', el click
// en un feature lo pinta en lugar de seleccionarlo.
//
// Modelo simple inspirado en mapchart: el user elige un color de la paleta
// y pinta. La "leyenda" se construye al runtime agrupando features por
// color. No hay grupos pre-creados — los colores aparecen en la leyenda
// recién cuando se usan al menos una vez.

// Contexto = combinación (view + level) donde el painter aplica. Cada
// contexto tiene su set propio de asignaciones para que pintar países no
// pise pintar estados VE, etc.
export type PaintContext = 've_states' | 've_munis' | 'countries'

export type PaintState = {
  // Título del mapa. Mostrado en el header del tab Dibujar y usado como
  // nombre del archivo PNG al exportar.
  title: string
  // Color activo (hex). Si null, los clicks en el mapa NO pintan aunque el
  // tab Dibujar esté activo — el user puede ver su pintura sin riesgo de
  // tocarla por accidente.
  activeColor: string | null
  // Asignaciones por contexto: featureId → colorHex. Identificadores:
  //   ve_states:  iso (ej 'VE-A')
  //   ve_munis:   sourceID (ej 'amazonas-atabapo')
  //   countries:  iso_a3 (ej 'COL')
  assignments: {
    ve_states: Record<string, string>
    ve_munis: Record<string, string>
    countries: Record<string, string>
  }
  // Labels custom por color (compartido entre contextos). Si el user pone
  // verde como "Visitados" en estados, sigue siendo "Visitados" si lo usa
  // en países también. Coherencia conceptual de la leyenda.
  labels: Record<string, string>
}

export const PAINT_STATE_DEFAULT: PaintState = {
  title: 'Mi mapa',
  activeColor: null,
  assignments: { ve_states: {}, ve_munis: {}, countries: {} },
  labels: {},
}

// Slot para guardar el estado del painter con un nombre custom. El user
// puede tener N slots y cargarlos cuando quiera (snapshot completo del
// paint en ese momento). NO incluimos `activeColor` (es una preferencia
// momentánea, no parte del mapa).
export type SavedMap = {
  id: string
  name: string
  savedAt: number // timestamp en ms (Date.now)
  title: string
  assignments: PaintState['assignments']
  labels: PaintState['labels']
}

// Helper: resuelve el contexto del painter para una vista + nivel dados.
// adm0 (país solo) no tiene contexto porque pintar 1 sólo polígono no
// aporta — el painter aplica a niveles con varias entidades.
export function getPaintContext(
  view: ViewMode,
  level: AdmLevel,
): PaintContext | null {
  if (view === 'global') return 'countries'
  if (level === 'adm1') return 've_states'
  if (level === 'adm2') return 've_munis'
  return null
}

export const COSMOS_TWEAKS_DEFAULT: CosmosTweaks = {
  space: '#0f172a',
  globe: '#89c8f5', // sky-medio: más luminoso que el #bedaee histórico
  missing: '#e2e8f0',
  starsDensity: 1,
  haloIntensity: 1, // halo full → atmósfera bien visible
  highlightX: 73, // luz desde la derecha
  highlightY: 34,
  highlightIntensity: 1.6, // brillo 3D más marcado
}

// Valores históricos del default (anteriores a la promoción de Cosmos como
// default global). Sirven para detectar si el user nunca tocó los tweaks:
// si su cosmosTweaks coincide exactamente con esto, es default → lo
// migramos al nuevo default; si difiere, respetamos su customización.
const COSMOS_TWEAKS_LEGACY_DEFAULT = {
  space: '#0f172a',
  globe: '#bedaee',
  missing: '#e2e8f0',
  starsDensity: 1,
  haloIntensity: 0.4,
  highlightX: 35,
  highlightY: 30,
  highlightIntensity: 1,
}

// Tabs visibles dependen de paintModeActive:
//   modo normal:  'datos' | 'capas' | 'estilo'
//   modo pintar:  'presets' | 'estilo' | 'pintar'
// 'presets' fusiona Datos+Capas en una sola tab para que mientras pintás
// puedas activar capas o cambiar indicador de fondo sin perder el contexto.
// 'pintar' tiene la paleta de colores + leyenda + acciones del painter.
export type PanelTab = 'datos' | 'capas' | 'estilo' | 'presets' | 'pintar'

// Modo de color del UI. 'system' lee prefers-color-scheme del browser
// (default razonable); 'light' y 'dark' son overrides explícitos del user.
// El estado efectivo se calcula en App.tsx: 'system' → resolve a 'light'
// o 'dark' según el media query, los otros pasan literal.
export type ColorScheme = 'light' | 'dark' | 'system'

type State = {
  view: ViewMode
  level: AdmLevel
  country: 'VE'
  tab: PanelTab
  adm0: AdmGeoJSON<Adm0Props> | null
  adm1: AdmGeoJSON<Adm1Props> | null
  adm2: AdmGeoJSON<Adm2Props> | null
  diaspora: AdmGeoJSON<DiasporaProps> | null
  diasporaLoading: boolean
  // Métrica activa en vista Global (3 reportes intercambiables).
  //   'migrantes'   = migrantes VE recibidos por país (default histórico)
  //   'venezolanos' = total venezolanos viviendo en ese país (incluye VE)
  //   'porcentaje'  = % venezolanos sobre población total del país
  globalMetric: import('./lib/apply-indicator').DiasporaMode
  // Región activa en vista Global (filtro de países visibles + auto-fit
  // de la proyección al subset). 'world' = mundo entero (sin filtro).
  // Ver app/src/lib/regions.ts para la definición de cada región.
  globalRegion: import('./lib/regions').RegionId
  // Vista Global: proyección d3-geo activa + rotación [lambda, phi, gamma]
  // que solo aplica a proyecciones tipo globo (Orthographic).
  projection: 'equalEarth' | 'orthographic' | 'naturalEarth' | 'mercator' | 'equirectangular'
  rotation: [number, number, number]
  // Altura del drawer mobile (0 = cerrado, 0.5 = mitad, 0.88 = expandido).
  // El WorldMapView lo lee para anclar el globo en el espacio visible.
  mobilePanelHeight: number
  loading: boolean
  loadError: string | null
  source: DataSource
  palette: PaletteId
  stats: AnyStats | null
  selected: {
    name: string
    nombreOficial?: string | null
    parentState?: string | null
    iso?: string | null
    value?: number | null
  } | null
  mapStyle: MapStyle
  cosmosTweaks: CosmosTweaks
  thematic: Record<string, ThematicState>
  // Overrides por capa, indexados por id. Vacío inicialmente; cada capa
  // que el user toca acumula sus tweaks. Persistido en localStorage.
  thematicOverrides: Record<string, ThematicOverride>
  // Painter (Hacer tu propio mapa). Vive en su propio slice porque es un
  // producto separado dentro de Mapitas.
  paint: PaintState
  // Modo Pintar global, independiente del tab activo. Cuando está ON:
  //   - el click en una región del mapa pinta (no selecciona)
  //   - el set de tabs visibles cambia: 'presets' | 'estilo' | 'pintar'
  //   - el render del mapa ignora el color del indicador (lienzo limpio)
  // Cuando está OFF: experiencia normal. Se togglea desde el botón
  // "Hacer tu propio mapa" del TopBar.
  paintModeActive: boolean
  // Slots de mapas guardados (local, localStorage). El user puede tener
  // N mapas con nombre custom y cargarlos cuando quiera.
  savedMaps: SavedMap[]
  // Modo de color del UI ('light' | 'dark' | 'system'). El default es
  // 'system' (lee prefers-color-scheme del browser). Aplicación de la
  // clase `.dark` al <html> vive en App.tsx.
  colorScheme: ColorScheme
  // Rango custom para clasificación visual (null = usa min/max natural)
  customRange: { min: number | null; mid: number | null; max: number | null }
  // IDs de indicadores que el usuario quiere ocultar de la lista principal.
  // Aparecen plegados en la sección "Archivados" al fondo de Datos.
  // Default: los 3 "estimado" (idh_2026, pib_total, pib_per_capita) porque
  // no son fuente sólida. Persistido en localStorage.
  archivedIndicators: string[]
  // Restaurar después de cargar data — guarda el id del source persistido
  _persistedSourceId: string | null
  _persistedThematicIds: string[]
}

type Actions = {
  loadGeoData: () => Promise<void>
  loadDiasporaData: () => Promise<void>
  setView: (view: ViewMode) => void
  setProjection: (p: State['projection']) => void
  setRotation: (r: [number, number, number]) => void
  setGlobalMetric: (m: import('./lib/apply-indicator').DiasporaMode) => void
  setGlobalRegion: (r: import('./lib/regions').RegionId) => void
  setMobilePanelHeight: (h: number) => void
  setLevel: (level: AdmLevel) => void
  setPalette: (palette: PaletteId) => void
  selectIndicator: (id: string | null) => void
  setDataset: (dataset: UploadedDataset | null) => void
  updateDatasetMapping: (
    mapping: Partial<Pick<UploadedDataset, 'geoColumn' | 'valueColumn' | 'parentColumn'>>,
  ) => void
  applyMerge: () => void
  setSelected: (sel: State['selected']) => void
  clearSource: () => void
  setMapStyle: (patch: Partial<MapStyle>) => void
  setCosmosTweaks: (patch: Partial<CosmosTweaks>) => void
  resetCosmosTweaks: () => void
  setThematicOverride: (id: string, patch: Partial<ThematicOverride>) => void
  resetThematicOverride: (id: string) => void
  // Painter actions
  setPaintMode: (active: boolean) => void
  setPaintTitle: (title: string) => void
  setPaintActiveColor: (color: string | null) => void
  paintFeature: (ctx: PaintContext, featureId: string) => void
  // Variante "force": pinta SIEMPRE con el color activo, sin toggle.
  // Necesaria para el brush con Ctrl+hover — si fuera toggle, pasar el
  // mouse sobre regiones ya pintadas las despintaría en lugar de seguir
  // pintando. Si el feature ya tiene el color activo, no hace nada
  // (idempotente, evita re-renders en cada pixel del movimiento).
  paintFeatureForce: (ctx: PaintContext, featureId: string) => void
  setPaintColorLabel: (color: string, label: string) => void
  // Despinta TODOS los features asignados a este color en el contexto actual
  removePaintColor: (ctx: PaintContext, color: string) => void
  clearPaintContext: (ctx: PaintContext) => void
  resetPaint: () => void
  // Slots de mapas guardados
  saveMapAs: (name: string) => void
  loadSavedMap: (id: string) => void
  deleteSavedMap: (id: string) => void
  renameSavedMap: (id: string, name: string) => void
  setColorScheme: (s: ColorScheme) => void
  setCountry: (code: 'VE') => void
  setTab: (tab: PanelTab) => void
  loadThematicManifest: () => Promise<void>
  toggleThematic: (id: string) => Promise<void>
  resetSettings: () => void
  setCustomRange: (patch: Partial<{ min: number | null; mid: number | null; max: number | null }>) => void
  resetCustomRange: () => void
  archiveIndicator: (id: string) => void
  unarchiveIndicator: (id: string) => void
}

// Indicadores archivados por default — son los 3 estimados (sin fuente
// oficial sólida). El usuario puede desarchivar si los necesita.
// idh_2026 sigue archivado: es un IDH estimado para 2026 con cobertura
// parcial y metodología propia (no oficial). Los PIB son estimados también
// pero el user los pidió como reportes visibles de la sección Economía.
const DEFAULT_ARCHIVED_INDICATORS = ['idh_2026']

// Capas temáticas activadas por default al primer load (sólo cuando no hay
// persistencia previa de localStorage). Los usuarios que ya configuraron
// sus capas en sesiones anteriores conservan su elección.
const DEFAULT_ENABLED_THEMATIC = ['internacionales-maritimos']

export const DEFAULT_MAP_STYLE: MapStyle = {
  lineWidth: 0.6,
  borderColor: '#475569',
  bgColor: '#f1f5f9',
  isolateCountry: false,
  stateOverlayInMuni: false,
  customStart: '#f7fbff',
  customEnd: '#08306b',
  paletteMidpoint: 0.5,
  basemap: 'world-outlines',
  fillOpacity: 0.95,
  borderOpacity: 1,
  transparentBg: false,
  noBorders: true,
  countryBorder: true,
  autoClipExtremes: true,
  globeTheme: 'cosmos',
  showLabels: false,
}

function clearAll<P extends Adm0Props | Adm1Props | Adm2Props | DiasporaProps>(
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

const STORAGE_KEY = 'mapitas-v1'

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
  level: 'adm1',
  country: 'VE',
  tab: 'datos',
  adm0: null,
  adm1: null,
  adm2: null,
  view: 'venezuela',
  diaspora: null,
  diasporaLoading: false,
  globalMetric: 'migrantes',
  globalRegion: 'world',
  // Default: Orthographic centrado en Venezuela (Caracas: -66, 7).
  // En d3-geo, rotate([λ, φ, γ]) pone el punto (-λ, -φ) en el centro.
  // Para centrar en VE → λ=66 (lng=-66), φ=-7 (lat=+7), γ=0.
  projection: 'orthographic',
  rotation: [66, -7, 0],
  mobilePanelHeight: 0.5, // default cerrado: drawer ocupa 50% inferior
  loading: false,
  loadError: null,
  source: null,
  palette: 'viridis',
  stats: null,
  selected: null,
  mapStyle: DEFAULT_MAP_STYLE,
  cosmosTweaks: COSMOS_TWEAKS_DEFAULT,
  thematic: {},
  thematicOverrides: {},
  paint: PAINT_STATE_DEFAULT,
  paintModeActive: false,
  savedMaps: [],
  colorScheme: 'system',
  customRange: { min: null, mid: null, max: null },
  archivedIndicators: DEFAULT_ARCHIVED_INDICATORS,
  _persistedSourceId: null,
  _persistedThematicIds: [],

  async loadGeoData() {
    set({ loading: true, loadError: null })
    try {
      const base = import.meta.env.BASE_URL
      // Cargamos TopoJSON (5x más chico) y lo decodificamos a GeoJSON.
      // La clave: en TopoJSON las fronteras compartidas son arcs únicos;
      // al decodificar, polígonos vecinos comparten exactamente las mismas
      // coordenadas → cero gaps visuales.
      const [r0, r1, r2] = await Promise.all([
        fetch(`${base}data/venezuela-adm0.topojson`),
        fetch(`${base}data/venezuela-adm1.topojson`),
        fetch(`${base}data/venezuela-adm2.topojson`),
      ])
      if (!r1.ok || !r2.ok) throw new Error('No se pudo cargar el mapa base')
      const topo0 = r0.ok ? ((await r0.json()) as Topology) : null
      const topo1 = (await r1.json()) as Topology
      const topo2 = (await r2.json()) as Topology

      // El nombre del object dentro del topology es el del archivo input
      // que mapshaper usó. Buscamos el primer GeometryCollection.
      const firstObj = (topo: Topology) => {
        const key = Object.keys(topo.objects)[0]
        return topo.objects[key] as GeometryCollection
      }
      const adm0 = topo0
        ? (topoFeature(topo0, firstObj(topo0)) as unknown as AdmGeoJSON<Adm0Props>)
        : null
      const adm1 = topoFeature(topo1, firstObj(topo1)) as unknown as AdmGeoJSON<Adm1Props>
      const adm2 = topoFeature(topo2, firstObj(topo2)) as unknown as AdmGeoJSON<Adm2Props>

      set({ adm0, adm1, adm2, loading: false })
      // Restaurar indicador persistido o auto-seleccionar la vista política
      // del nivel actual. La vista política es un mapa categórico (cada
      // estado/muni con su color) que sirve como mapa orientador al primer
      // load. El user puede saltar a cualquier indicador desde Datos.
      const sourceId = get()._persistedSourceId
      const lvl = get().level
      const defaultId =
        lvl === 'adm0' ? 'politico_pais'
        : lvl === 'adm2' ? 'politico_munis'
        : 'politico_estados'
      if (sourceId) {
        get().selectIndicator(sourceId)
        set({ _persistedSourceId: null })
      }
      // Fallback al default si: no había persistencia, o el id persistido
      // no resolvió (ej. indicador eliminado del catálogo). Verifica el
      // source DESPUÉS del intento de restauración.
      if (!get().source) {
        get().selectIndicator(defaultId)
      }
      // Si la persistencia trae view='global', traer ese geo también.
      // No bloqueamos el load principal — es lazy.
      if (get().view === 'global') {
        get().loadDiasporaData()
      }
    } catch (err) {
      set({ loading: false, loadError: String(err) })
    }
  },

  async loadDiasporaData() {
    if (get().diaspora || get().diasporaLoading) return
    set({ diasporaLoading: true })
    try {
      const base = import.meta.env.BASE_URL
      // Cargamos geojson + indicadores comparativos en paralelo. El JSON de
      // indicadores se mergea como propiedades extra del feature (PIB pc, IDH)
      // para que applyDiaspora pueda leerlos uniformemente. Mantener separados
      // permite actualizar los datos sin regenerar la geometría (WB publica
      // anualmente en julio, UNDP en marzo).
      const [geoRes, indicatorsRes] = await Promise.all([
        fetch(`${base}data/world-countries.geojson`),
        fetch(`${base}data/world-indicators.json`),
      ])
      if (!geoRes.ok) throw new Error('No se pudo cargar el mapa mundial')
      const diaspora = (await geoRes.json()) as AdmGeoJSON<DiasporaProps>
      if (indicatorsRes.ok) {
        const indicators = (await indicatorsRes.json()) as {
          countries?: Record<string, { pib_per_capita_usd?: number | null; idh?: number | null }>
        }
        const lookup = indicators.countries ?? {}
        // Mutación in-place del array recién parseado (no afecta nada externo).
        // Más simple y barato que rebuildear el feature collection completo.
        for (const f of diaspora.features) {
          const iso = f.properties?.iso_a3
          const data = iso ? lookup[iso] : undefined
          if (data) {
            f.properties = { ...f.properties, ...data }
          }
        }
      }
      set({ diaspora, diasporaLoading: false })
      // Si el user ya cambió a la vista global antes de que cargara, pintar
      if (get().view === 'global') get().applyMerge()
    } catch (err) {
      set({ diasporaLoading: false, loadError: String(err) })
    }
  },

  setView(view) {
    set({ view })
    // Tanto 'global' (d3-geo) como 'region_test' (Leaflet) usan el geo de
    // diáspora — cargamos lazy la primera vez que se entra a cualquiera
    // de las dos. Si ya estaba cargado, aplyMerge re-pinta con la métrica
    // activa. 'venezuela' usa adm1/adm2 que ya se cargaron al boot.
    const needsDiaspora = view === 'global' || view === 'region_test'
    if (needsDiaspora && !get().diaspora) {
      get().loadDiasporaData()
    } else {
      get().applyMerge()
    }
  },

  setProjection(p) {
    set({ projection: p })
  },

  setRotation(r) {
    set({ rotation: r })
  },

  setGlobalMetric(m) {
    set({ globalMetric: m })
    if (get().view === 'global') get().applyMerge()
  },

  setGlobalRegion(r) {
    set({ globalRegion: r })
    // No hace falta applyMerge — la región solo filtra el render, no
    // recalcula colores. WorldMapView lee globalRegion directamente.
  },

  setMobilePanelHeight(h) {
    set({ mobilePanelHeight: Math.max(0, Math.min(1, h)) })
  },

  setLevel(level) {
    // Auto-switch: si el indicador activo pertenece a un grupo simbólico
    // (banderas/escudos) y existe variant para el nuevo nivel, switch
    // automático. Permite al user "navegar por niveles" sin re-seleccionar
    // el indicador. Si no hay variant para el nivel, mantenemos el actual
    // (caerá en "Solo a nivel X" archivado).
    const src = get().source
    if (src?.kind === 'indicator' && src.indicator.group) {
      const next = getIndicatorByGroupAndLevel(src.indicator.group, level)
      if (next && next.id !== src.indicator.id) {
        set({ level, source: { kind: 'indicator', indicator: next } })
        get().applyMerge()
        return
      }
    }
    set({ level })
    get().applyMerge()
  },

  setPalette(palette) {
    set({ palette })
    // Recalcular merge para que todos los niveles tengan colores nuevos
    get().applyMerge()
  },

  selectIndicator(id) {
    if (!id) {
      set({ source: null, customRange: { min: null, mid: null, max: null } })
      get().applyMerge()
      return
    }
    const indicator = getIndicator(id)
    if (!indicator) return
    // Resetear customRange al cambiar de indicador (cada uno tiene su escala)
    set({
      source: { kind: 'indicator', indicator },
      customRange: { min: null, mid: null, max: null },
    })
    get().applyMerge()
  },

  setDataset(dataset) {
    set({ source: dataset ? { kind: 'upload', dataset } : null })
    get().applyMerge()
  },

  updateDatasetMapping(mapping) {
    const src = get().source
    if (!src || src.kind !== 'upload') return
    set({ source: { kind: 'upload', dataset: { ...src.dataset, ...mapping } } })
    get().applyMerge()
  },

  applyMerge() {
    const { view, level, adm0, adm1, adm2, diaspora, source, palette, mapStyle, customRange, globalMetric } = get()
    const custom = { start: mapStyle.customStart, end: mapStyle.customEnd }

    // Vista Global: lógica aparte, no usa indicators ni level. Lee globalMetric
    // para decidir qué pintar (migrantes recibidos / venezolanos totales / %).
    if (view === 'global') {
      if (!diaspora) return
      const opts = { clipExtremes: mapStyle.autoClipExtremes }
      const { geo, stats } = applyDiaspora(diaspora, palette, globalMetric, custom, customRange, opts)
      set({ diaspora: geo, stats })
      return
    }

    if (!adm1 || !adm2) return

    if (!source) {
      set({
        adm0: adm0 ? clearAll(adm0) : null,
        adm1: clearAll(adm1),
        adm2: clearAll(adm2),
        stats: null,
      })
      return
    }

    if (source.kind === 'indicator') {
      const opts = { clipExtremes: mapStyle.autoClipExtremes }
      if (level === 'adm0' && adm0) {
        const { geo, stats } = applyIndicatorToAdm0(adm0, source.indicator, palette, custom)
        set({ adm0: geo, stats })
      } else if (level === 'adm1') {
        const { geo, stats } = applyIndicatorToAdm1(adm1, source.indicator, palette, custom, customRange, opts)
        set({ adm1: geo, stats })
      } else if (level === 'adm2') {
        const { geo, stats } = applyIndicatorToAdm2(adm2, source.indicator, palette, custom, customRange, opts)
        set({ adm2: geo, stats })
      }
      return
    }

    if (source.kind === 'upload') {
      // Para CSV con level=adm0 todavía no hay merge específico (futuro).
      // Por ahora, en adm0 con upload, simplemente clear.
      if (level === 'adm0' && adm0) {
        set({ adm0: clearAll(adm0), stats: null })
      } else if (level === 'adm1') {
        const { geo, stats } = mergeUserDataIntoGeo(adm1, 'adm1', source.dataset, palette, custom)
        set({ adm1: geo, stats })
      } else if (level === 'adm2') {
        const { geo, stats } = mergeUserDataIntoGeo(adm2, 'adm2', source.dataset, palette, custom)
        set({ adm2: geo, stats })
      }
    }
  },

  setSelected(sel) {
    set({ selected: sel })
  },

  clearSource() {
    set({ source: null, stats: null, selected: null })
    get().applyMerge()
  },

  setMapStyle(patch) {
    set({ mapStyle: { ...get().mapStyle, ...patch } })
    // Si cambiaron colores custom y la paleta activa es 'custom', re-aplicar
    if ((patch.customStart || patch.customEnd) && get().palette === 'custom') {
      get().applyMerge()
    }
    // El toggle de auto-clip cambia min/max del autoRange → recolorear
    if (patch.autoClipExtremes !== undefined) {
      get().applyMerge()
    }
  },

  setCosmosTweaks(patch) {
    set({ cosmosTweaks: { ...get().cosmosTweaks, ...patch } })
  },

  resetCosmosTweaks() {
    set({ cosmosTweaks: COSMOS_TWEAKS_DEFAULT })
  },

  setThematicOverride(id, patch) {
    const current = get().thematicOverrides[id] ?? {}
    set({
      thematicOverrides: { ...get().thematicOverrides, [id]: { ...current, ...patch } },
    })
  },

  resetThematicOverride(id) {
    const rest = { ...get().thematicOverrides }
    delete rest[id]
    set({ thematicOverrides: rest })
  },

  // ─── Painter actions ──────────────────────────────────────────────────
  setPaintMode(active) {
    set({ paintModeActive: active })
    // Al activar el modo, llevamos al user al tab Pintar (paleta) si está
    // en uno que ya no será visible. Al desactivar, lo llevamos a Datos.
    if (active) {
      const t = get().tab
      if (t !== 'presets' && t !== 'estilo' && t !== 'pintar') {
        set({ tab: 'pintar' })
      }
    } else {
      const t = get().tab
      if (t !== 'datos' && t !== 'capas' && t !== 'estilo') {
        set({ tab: 'datos' })
      }
    }
  },

  setPaintTitle(title) {
    set({ paint: { ...get().paint, title } })
  },

  setPaintActiveColor(color) {
    set({ paint: { ...get().paint, activeColor: color } })
  },

  // Click sobre un feature en modo Dibujar. Toggle:
  //   - Si ya tenía el color activo → despinta
  //   - Si estaba sin color o con otro → asigna el color activo
  // Sin color activo, no hace nada (el modo lectura del painter).
  paintFeature(ctx, featureId) {
    const paint = get().paint
    if (!paint.activeColor) return
    const current = paint.assignments[ctx][featureId]
    const next = { ...paint.assignments[ctx] }
    if (current === paint.activeColor) {
      delete next[featureId]
    } else {
      next[featureId] = paint.activeColor
    }
    set({
      paint: {
        ...paint,
        assignments: { ...paint.assignments, [ctx]: next },
      },
    })
  },

  paintFeatureForce(ctx, featureId) {
    const paint = get().paint
    if (!paint.activeColor) return
    const current = paint.assignments[ctx][featureId]
    if (current === paint.activeColor) return // ya está, no hacer nada
    set({
      paint: {
        ...paint,
        assignments: {
          ...paint.assignments,
          [ctx]: { ...paint.assignments[ctx], [featureId]: paint.activeColor },
        },
      },
    })
  },

  setPaintColorLabel(color, label) {
    const labels = { ...get().paint.labels }
    if (label.trim() === '') delete labels[color]
    else labels[color] = label
    set({ paint: { ...get().paint, labels } })
  },

  // Despinta todos los features asignados a este color en el contexto dado.
  // El label del color se conserva (queda en `labels` por si el user vuelve
  // a usarlo) salvo que no haya quedado nada en ningún contexto.
  removePaintColor(ctx, color) {
    const paint = get().paint
    const next = Object.fromEntries(
      Object.entries(paint.assignments[ctx]).filter(([, c]) => c !== color),
    )
    const newAssignments = { ...paint.assignments, [ctx]: next }
    // Si el color ya no aparece en NINGÚN contexto, limpiamos también su label.
    const stillUsed =
      Object.values(newAssignments.ve_states).includes(color) ||
      Object.values(newAssignments.ve_munis).includes(color) ||
      Object.values(newAssignments.countries).includes(color)
    const labels = { ...paint.labels }
    if (!stillUsed) delete labels[color]
    set({
      paint: {
        ...paint,
        assignments: newAssignments,
        labels,
      },
    })
  },

  clearPaintContext(ctx) {
    const paint = get().paint
    set({
      paint: {
        ...paint,
        assignments: { ...paint.assignments, [ctx]: {} },
      },
    })
  },

  resetPaint() {
    set({ paint: PAINT_STATE_DEFAULT })
  },

  // ─── Slots de mapas guardados ─────────────────────────────────────────
  saveMapAs(name) {
    const paint = get().paint
    const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const slot: SavedMap = {
      id,
      name: name.trim() || paint.title || 'Mapa sin nombre',
      savedAt: Date.now(),
      title: paint.title,
      // Deep clone para que ediciones futuras al paint NO muten el snapshot
      assignments: {
        ve_states: { ...paint.assignments.ve_states },
        ve_munis: { ...paint.assignments.ve_munis },
        countries: { ...paint.assignments.countries },
      },
      labels: { ...paint.labels },
    }
    // Más recientes primero — orden natural en la UI.
    set({ savedMaps: [slot, ...get().savedMaps] })
  },

  loadSavedMap(id) {
    const slot = get().savedMaps.find(m => m.id === id)
    if (!slot) return
    // Cargamos title + assignments + labels al paint actual. activeColor
    // no se toca (es preferencia momentánea del user).
    set({
      paint: {
        ...get().paint,
        title: slot.title,
        assignments: {
          ve_states: { ...slot.assignments.ve_states },
          ve_munis: { ...slot.assignments.ve_munis },
          countries: { ...slot.assignments.countries },
        },
        labels: { ...slot.labels },
      },
    })
  },

  deleteSavedMap(id) {
    set({ savedMaps: get().savedMaps.filter(m => m.id !== id) })
  },

  renameSavedMap(id, name) {
    const newName = name.trim()
    if (!newName) return
    set({
      savedMaps: get().savedMaps.map(m =>
        m.id === id ? { ...m, name: newName } : m,
      ),
    })
  },

  setColorScheme(scheme) {
    set({ colorScheme: scheme })
  },

  setCountry(code) {
    set({ country: code })
  },

  setTab(tab) {
    set({ tab })
  },

  resetSettings() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    window.location.reload()
  },

  setCustomRange(patch) {
    set({ customRange: { ...get().customRange, ...patch } })
    get().applyMerge()
  },

  resetCustomRange() {
    set({ customRange: { min: null, mid: null, max: null } })
    get().applyMerge()
  },

  archiveIndicator(id) {
    const current = get().archivedIndicators
    if (current.includes(id)) return
    set({ archivedIndicators: [...current, id] })
  },

  unarchiveIndicator(id) {
    set({ archivedIndicators: get().archivedIndicators.filter(x => x !== id) })
  },

  async loadThematicManifest() {
    if (Object.keys(get().thematic).length > 0) return
    try {
      const base = import.meta.env.BASE_URL
      const res = await fetch(`${base}data/thematic/manifest.json`)
      if (!res.ok) return
      const list = (await res.json()) as ThematicMeta[]
      const initial: Record<string, ThematicState> = {}
      for (const meta of list) {
        // El manifest guarda paths absolutos /data/thematic/x.geojson — convertir a relativos
        const file = meta.file.startsWith('/') ? `${base.replace(/\/$/, '')}${meta.file}` : meta.file
        initial[meta.id] = { meta: { ...meta, file }, enabled: false, loading: false, data: null }
      }
      set({ thematic: initial })
      // Restaurar capas habilitadas. Prioridad:
      //   1) localStorage del user (sesiones anteriores) — respetamos su elección
      //   2) DEFAULT_ENABLED_THEMATIC — usuarios nuevos sin persistencia
      const persistedIds = get()._persistedThematicIds
      const idsToEnable = persistedIds.length > 0 ? persistedIds : DEFAULT_ENABLED_THEMATIC
      for (const id of idsToEnable) {
        if (initial[id]) await get().toggleThematic(id)
      }
      if (persistedIds.length > 0) {
        set({ _persistedThematicIds: [] })
      }
    } catch (err) {
      console.warn('No se pudo cargar manifest de capas temáticas', err)
    }
  },

  async toggleThematic(id) {
    const entry = get().thematic[id]
    if (!entry) return
    // Si ya está habilitado, desactivar
    if (entry.enabled) {
      set({
        thematic: { ...get().thematic, [id]: { ...entry, enabled: false } },
      })
      return
    }
    // Si no tiene data cargada, fetchear primero
    if (!entry.data) {
      set({
        thematic: { ...get().thematic, [id]: { ...entry, loading: true } },
      })
      try {
        const res = await fetch(entry.meta.file)
        if (!res.ok) throw new Error(`fetch ${entry.meta.file} → ${res.status}`)
        const data = await res.json()
        set({
          thematic: { ...get().thematic, [id]: { ...entry, data, enabled: true, loading: false } },
        })
      } catch (err) {
        set({
          thematic: {
            ...get().thematic,
            [id]: { ...entry, loading: false, error: String(err) },
          },
        })
      }
      return
    }
    // Ya tenía data, solo habilitar
    set({
      thematic: { ...get().thematic, [id]: { ...entry, enabled: true } },
    })
  },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Solo serializamos cosas livianas. La geo data se re-fetchea al cargar.
      version: 15,
      // Migraciones:
      //   v1 → v2: view 'diaspora' → 'global' (rename del modo)
      //   v2 → v3: projection default Orthographic + rotation centrada en VE
      //   v3 → v4: fix rotation a [66, -7, 0] para que phi compense la
      //   latitud de Caracas (7°N) y VE quede en el centro absoluto del globo.
      //   v4 → v5: basemap default "Sin nombres" + toggle showLabels en off.
      //   v5 → v6: basemap default "Contornos países". Solo upgrade automático
      //   si el user tenía el viejo default (carto-light-nolabels). Si había
      //   elegido otro manualmente, respetamos.
      //   v6 → v7: agregar cosmosTweaks con defaults si no existe (feature
      //   de personalización del tema Cosmos).
      //   v7 → v8: agregar thematicOverrides {} si no existe (feature de
      //   tweaks por capa temática: opacidad, color, estilo de texto).
      //   v8 → v9: agregar highlightX/Y/Intensity al cosmosTweaks. Merge
      //   con defaults para preservar lo que ya tenía el user.
      //   v9 → v10: agregar paint state (feature "Hacer tu propio mapa").
      //   v10 → v11: agregar globalRegion 'world' default (feature regiones).
      //   v11 → v12: tab 'dibujar' renombrado a 'pintar'; paintModeActive
      //   inicializa en false. El user vuelve a estado neutral.
      //   v12 → v13: Cosmos pasa a ser default del globo (era 'day'). Solo
      //   afecta a usuarios que tenían 'day' (default histórico) — los que
      //   habían elegido otro tema se respetan. Idem para cosmosTweaks: si
      //   tenía los valores legacy exactos (no tocados), se actualiza al
      //   nuevo default; si los tweakeo, se mantiene.
      //   v13 → v14: agregar savedMaps [] (slots de guardado del painter).
      //   v14 → v15: agregar colorScheme 'system' default (modo claro/oscuro).
      migrate: (persisted, version) => {
        let obj = persisted as Record<string, unknown>
        if (version < 2 && obj?.view === 'diaspora') {
          obj = { ...obj, view: 'global' }
        }
        if (version < 3) {
          obj = { ...obj, projection: 'orthographic', rotation: [66, -7, 0] }
        }
        if (version < 4) {
          obj = { ...obj, rotation: [66, -7, 0] }
        }
        if (version < 5) {
          const ms = (obj.mapStyle as Record<string, unknown> | undefined) ?? {}
          obj = {
            ...obj,
            mapStyle: {
              ...ms,
              basemap: ms.basemap === 'carto-light' ? 'carto-light-nolabels' : ms.basemap,
              showLabels: false,
            },
          }
        }
        if (version < 6) {
          const ms = (obj.mapStyle as Record<string, unknown> | undefined) ?? {}
          obj = {
            ...obj,
            mapStyle: {
              ...ms,
              basemap: ms.basemap === 'carto-light-nolabels' ? 'world-outlines' : ms.basemap,
            },
          }
        }
        if (version < 7 && obj.cosmosTweaks == null) {
          obj = { ...obj, cosmosTweaks: COSMOS_TWEAKS_DEFAULT }
        }
        if (version < 8 && obj.thematicOverrides == null) {
          obj = { ...obj, thematicOverrides: {} }
        }
        if (version < 9) {
          // Mergeamos los defaults con lo que el user ya tenía, así garantizamos
          // los campos nuevos sin pisar los que ya había modificado.
          const existing = (obj.cosmosTweaks as Partial<CosmosTweaks> | undefined) ?? {}
          obj = {
            ...obj,
            cosmosTweaks: { ...COSMOS_TWEAKS_DEFAULT, ...existing },
          }
        }
        if (version < 10 && obj.paint == null) {
          obj = { ...obj, paint: PAINT_STATE_DEFAULT }
        }
        if (version < 11 && obj.globalRegion == null) {
          obj = { ...obj, globalRegion: 'world' }
        }
        if (version < 12) {
          // Renombrar tab 'dibujar' (que no existe más en el type) → 'pintar'.
          // paintModeActive inicia en false sin importar lo que tenía antes.
          const t = obj.tab as string | undefined
          obj = {
            ...obj,
            tab: t === 'dibujar' ? 'pintar' : (t ?? 'datos'),
            paintModeActive: false,
          }
        }
        if (version < 14 && obj.savedMaps == null) {
          obj = { ...obj, savedMaps: [] }
        }
        if (version < 15 && obj.colorScheme == null) {
          obj = { ...obj, colorScheme: 'system' }
        }
        if (version < 13) {
          // Cosmos pasa a default. Solo migramos a usuarios que tenían el
          // default histórico 'day' — los que habían elegido otro tema (night,
          // editorial, o ya cosmos) se respetan.
          const ms = (obj.mapStyle as Record<string, unknown> | undefined) ?? {}
          if (ms.globeTheme === 'day') {
            obj = { ...obj, mapStyle: { ...ms, globeTheme: 'cosmos' } }
          }
          // CosmosTweaks: si los valores son los legacy exactos (no tocados),
          // los actualizamos al nuevo default. Comparación por igualdad de
          // cada campo — basta que UNO difiera para considerar "tweakeo".
          const ct = obj.cosmosTweaks as Record<string, unknown> | undefined
          if (ct) {
            const isLegacyDefault = (
              Object.keys(COSMOS_TWEAKS_LEGACY_DEFAULT) as Array<keyof typeof COSMOS_TWEAKS_LEGACY_DEFAULT>
            ).every(k => ct[k] === COSMOS_TWEAKS_LEGACY_DEFAULT[k])
            if (isLegacyDefault) {
              obj = { ...obj, cosmosTweaks: COSMOS_TWEAKS_DEFAULT }
            }
          }
        }
        return obj as unknown
      },
      partialize: state => ({
        view: state.view,
        level: state.level,
        palette: state.palette,
        tab: state.tab,
        mapStyle: state.mapStyle,
        cosmosTweaks: state.cosmosTweaks,
        thematicOverrides: state.thematicOverrides,
        paint: state.paint,
        paintModeActive: state.paintModeActive,
        savedMaps: state.savedMaps,
        colorScheme: state.colorScheme,
        customRange: state.customRange,
        archivedIndicators: state.archivedIndicators,
        projection: state.projection,
        rotation: state.rotation,
        globalMetric: state.globalMetric,
        globalRegion: state.globalRegion,
        _persistedSourceId:
          state.source?.kind === 'indicator' ? state.source.indicator.id : null,
        _persistedThematicIds: Object.entries(state.thematic)
          .filter(([, t]) => t.enabled)
          .map(([id]) => id),
      }),
      // Red de seguridad post-hidratación: garantizar que cosmosTweaks y
      // thematicOverrides estén completos y bien tipados. Sin esto, un state
      // parcial en localStorage (o una migración que no corrió) puede dejar
      // campos como `undefined`, que luego rompen `cx="undefined%"` en SVG
      // o `value.toFixed()` en sliders, dejando el mapa "en gris".
      onRehydrateStorage: () => state => {
        if (!state) return
        state.cosmosTweaks = { ...COSMOS_TWEAKS_DEFAULT, ...(state.cosmosTweaks ?? {}) }
        state.thematicOverrides = state.thematicOverrides ?? {}
        // savedMaps: garantizar array. Si por algún motivo quedó undefined
        // o null, lo inicializamos vacío.
        if (!Array.isArray(state.savedMaps)) {
          state.savedMaps = []
        }
        // Paint: si el persisted no lo tenía o está parcial, garantizamos
        // shape completo. Defensa contra estados corruptos / migraciones
        // que no corrieron por alguna razón. También sirve para migrar
        // del shape viejo (con groups + level) al nuevo (color libre)
        // descartando datos incompatibles.
        const persistedPaint = state.paint as Partial<PaintState> | undefined
        const a = (persistedPaint?.assignments ?? {}) as Partial<PaintState['assignments']>
        state.paint = {
          title: persistedPaint?.title ?? PAINT_STATE_DEFAULT.title,
          activeColor: persistedPaint?.activeColor ?? null,
          assignments: {
            ve_states: a.ve_states ?? {},
            ve_munis: a.ve_munis ?? {},
            countries: a.countries ?? {},
          },
          labels: persistedPaint?.labels ?? {},
        }
      },
    },
  ),
)
