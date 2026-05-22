import { create } from 'zustand'
import type {
  Adm0Props,
  Adm1Props,
  Adm2Props,
  AdmGeoJSON,
  AdmLevel,
  PaletteId,
  UploadedDataset,
} from './lib/types'
import {
  mergeUserDataIntoGeo,
  type MergeStats,
} from './lib/merge-data'
import {
  applyIndicatorToAdm0,
  applyIndicatorToAdm1,
  applyIndicatorToAdm2,
  type IndicatorStats,
} from './lib/apply-indicator'
import { getIndicator, type Indicator } from './data/indicators'

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
  basemap: import('./lib/basemaps').BasemapId
  fillOpacity: number
  borderOpacity: number
  transparentBg: boolean
}

export type ThematicMeta = {
  id: string
  label: string
  color: string
  file: string
  featureCount: number
  sizeKB: number
  geometryType: string
}

export type ThematicState = {
  meta: ThematicMeta
  enabled: boolean
  loading: boolean
  data: unknown | null
  error?: string | null
}

type State = {
  level: AdmLevel
  country: 'VE'
  adm0: AdmGeoJSON<Adm0Props> | null
  adm1: AdmGeoJSON<Adm1Props> | null
  adm2: AdmGeoJSON<Adm2Props> | null
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
}

type Actions = {
  loadGeoData: () => Promise<void>
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
  loadThematicManifest: () => Promise<void>
  toggleThematic: (id: string) => Promise<void>
}

export const DEFAULT_MAP_STYLE: MapStyle = {
  lineWidth: 0.6,
  borderColor: '#475569',
  bgColor: '#f1f5f9',
  isolateCountry: false,
  stateOverlayInMuni: false,
  customStart: '#fde68a',
  customEnd: '#7c2d12',
  basemap: 'carto-light',
  fillOpacity: 0.85,
  borderOpacity: 1,
  transparentBg: false,
}

function clearAll<P extends Adm1Props | Adm2Props>(geo: AdmGeoJSON<P>): AdmGeoJSON<P> {
  return {
    ...geo,
    features: geo.features.map(f => ({
      ...f,
      properties: { ...f.properties, _value: null, _color: null, _matched: false } as P,
    })),
  }
}

export const useStore = create<State & Actions>((set, get) => ({
  level: 'adm1',
  country: 'VE',
  adm0: null,
  adm1: null,
  adm2: null,
  loading: false,
  loadError: null,
  source: null,
  palette: 'reds',
  stats: null,
  selected: null,
  mapStyle: DEFAULT_MAP_STYLE,
  thematic: {},

  async loadGeoData() {
    set({ loading: true, loadError: null })
    try {
      const base = import.meta.env.BASE_URL
      const [r0, r1, r2] = await Promise.all([
        fetch(`${base}data/venezuela-adm0-enriched.geojson`),
        fetch(`${base}data/venezuela-adm1-enriched.geojson`),
        fetch(`${base}data/venezuela-adm2-enriched.geojson`),
      ])
      if (!r1.ok || !r2.ok) throw new Error('No se pudo cargar el mapa base')
      const adm0 = r0.ok ? ((await r0.json()) as AdmGeoJSON<Adm0Props>) : null
      const adm1 = (await r1.json()) as AdmGeoJSON<Adm1Props>
      const adm2 = (await r2.json()) as AdmGeoJSON<Adm2Props>
      set({ adm0, adm1, adm2, loading: false })
    } catch (err) {
      set({ loading: false, loadError: String(err) })
    }
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
      set({ source: null })
      get().applyMerge()
      return
    }
    const indicator = getIndicator(id)
    if (!indicator) return
    set({ source: { kind: 'indicator', indicator } })
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
    const { level, adm0, adm1, adm2, source, palette, mapStyle } = get()
    if (!adm1 || !adm2) return
    const custom = { start: mapStyle.customStart, end: mapStyle.customEnd }

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
      if (level === 'adm0' && adm0) {
        const { geo, stats } = applyIndicatorToAdm0(adm0, source.indicator, palette, custom)
        set({ adm0: geo, stats })
      } else if (level === 'adm1') {
        const { geo, stats } = applyIndicatorToAdm1(adm1, source.indicator, palette, custom)
        set({ adm1: geo, stats })
      } else if (level === 'adm2') {
        const { geo, stats } = applyIndicatorToAdm2(adm2, source.indicator, palette, custom)
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
  },

  setCountry(code) {
    set({ country: code })
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
}))
