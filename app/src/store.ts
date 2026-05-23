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
import { getIndicator, INDICATORS, type Indicator } from './data/indicators'

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
  globeTheme: 'day' | 'night' | 'editorial'
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
}

export type ThematicState = {
  meta: ThematicMeta
  enabled: boolean
  loading: boolean
  data: unknown | null
  error?: string | null
}

export type PanelTab = 'datos' | 'capas' | 'estilo'

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
  thematic: Record<string, ThematicState>
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
const DEFAULT_ARCHIVED_INDICATORS = ['idh_2026', 'pib_total', 'pib_per_capita']

export const DEFAULT_MAP_STYLE: MapStyle = {
  lineWidth: 0.6,
  borderColor: '#475569',
  bgColor: '#f1f5f9',
  isolateCountry: false,
  stateOverlayInMuni: false,
  customStart: '#f7fbff',
  customEnd: '#08306b',
  paletteMidpoint: 0.5,
  basemap: 'carto-light-nolabels',
  fillOpacity: 0.95,
  borderOpacity: 1,
  transparentBg: false,
  noBorders: true,
  countryBorder: true,
  autoClipExtremes: true,
  globeTheme: 'day',
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
  thematic: {},
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
      // Restaurar indicador persistido o auto-seleccionar el primero
      const sourceId = get()._persistedSourceId
      if (sourceId) {
        get().selectIndicator(sourceId)
        set({ _persistedSourceId: null })
      } else if (!get().source && INDICATORS[0]) {
        // Primera carga: seleccionar el primer indicador disponible
        get().selectIndicator(INDICATORS[0].id)
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
      const res = await fetch(`${base}data/world-countries.geojson`)
      if (!res.ok) throw new Error('No se pudo cargar el mapa mundial')
      const diaspora = (await res.json()) as AdmGeoJSON<DiasporaProps>
      set({ diaspora, diasporaLoading: false })
      // Si el user ya cambió a la vista global antes de que cargara, pintar
      if (get().view === 'global') get().applyMerge()
    } catch (err) {
      set({ diasporaLoading: false, loadError: String(err) })
    }
  },

  setView(view) {
    set({ view })
    // Carga lazy la primera vez que se entra a la vista Global
    if (view === 'global' && !get().diaspora) {
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

  setMobilePanelHeight(h) {
    set({ mobilePanelHeight: Math.max(0, Math.min(1, h)) })
  },

  setLevel(level) {
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
    const { view, level, adm0, adm1, adm2, diaspora, source, palette, mapStyle, customRange } = get()
    const custom = { start: mapStyle.customStart, end: mapStyle.customEnd }

    // Vista Global: lógica aparte, no usa indicators ni level
    if (view === 'global') {
      if (!diaspora) return
      const opts = { clipExtremes: mapStyle.autoClipExtremes }
      const { geo, stats } = applyDiaspora(diaspora, palette, custom, customRange, opts)
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
      // Restaurar capas que estaban habilitadas la última vez
      const persistedIds = get()._persistedThematicIds
      if (persistedIds.length > 0) {
        for (const id of persistedIds) {
          if (initial[id]) await get().toggleThematic(id)
        }
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
      version: 5,
      // Migraciones:
      //   v1 → v2: view 'diaspora' → 'global' (rename del modo)
      //   v2 → v3: projection default Orthographic + rotation centrada en VE
      //   v3 → v4: fix rotation a [66, -7, 0] para que phi compense la
      //   latitud de Caracas (7°N) y VE quede en el centro absoluto del globo.
      //   v4 → v5: basemap default "Sin nombres" + toggle showLabels en off.
      //   El mapa arranca limpio; el user activa labels desde Estilo.
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
              // Solo cambiar si el user tenía el viejo default (carto-light).
              // Si había elegido otro basemap (Dark, OSM, etc.), respetamos.
              basemap: ms.basemap === 'carto-light' ? 'carto-light-nolabels' : ms.basemap,
              showLabels: false,
            },
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
        customRange: state.customRange,
        archivedIndicators: state.archivedIndicators,
        projection: state.projection,
        rotation: state.rotation,
        _persistedSourceId:
          state.source?.kind === 'indicator' ? state.source.indicator.id : null,
        _persistedThematicIds: Object.entries(state.thematic)
          .filter(([, t]) => t.enabled)
          .map(([id]) => id),
      }),
    },
  ),
)
