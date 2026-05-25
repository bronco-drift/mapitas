import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useStore } from '../store'
import { PALETTE_OPTIONS, PALETTE_EXTRA, paletteGradient, getPaletteStops } from '../lib/color-scale'
import { RangeEditor } from './RangeEditor'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}
import { formatIndicatorValue } from '../data/indicators'
import { Section } from './Section'
import { IndicatorsList } from './IndicatorsList'
import { DataUploader } from './DataUploader'
import { Legend } from './Legend'
import { StyleControls } from './StyleControls'
import { ThematicLayersList } from './ThematicLayers'
import { IndicatorCoverageModal } from './IndicatorCoverageModal'
import { WikiModal } from './WikiModal'
import { wikiQueryFor } from '../lib/wiki'
import { PROJECTION_OPTIONS, type ProjectionId } from '../lib/projections'

type Props = {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function ControlPanel({ mobileOpen = false, onMobileClose }: Props) {
  const view = useStore(s => s.view)
  const level = useStore(s => s.level)
  const setLevel = useStore(s => s.setLevel)
  const isDiaspora = view === 'global'
  const selected = useStore(s => s.selected)
  const source = useStore(s => s.source)
  const stats = useStore(s => s.stats)
  const clearSource = useStore(s => s.clearSource)
  const resetSettings = useStore(s => s.resetSettings)
  const tab = useStore(s => s.tab)
  const setTab = useStore(s => s.setTab)
  const setMobilePanelHeight = useStore(s => s.setMobilePanelHeight)
  const isMobile = useIsMobile()

  const activeIndicator = source?.kind === 'indicator' ? source.indicator : null

  // Modal de cobertura del indicador activo. Se abre desde el header
  // (título del reporte clickeable). Para CSV propios o cuando no hay
  // source, el click navega al tab Datos.
  const [headerModalOpen, setHeaderModalOpen] = useState(false)
  // Modal Wikipedia. Se abre desde el botón "Más info" del bloque selected.
  // Aplica a estados/munis VE y a países (vista Global).
  const [wikiOpen, setWikiOpen] = useState(false)

  // ── Drawer expandible (solo mobile) ──────────────────────────────────────
  // Dos snap points: collapsed (45vh) y expanded (88vh). El user puede
  // arrastrar el handle hacia arriba/abajo, o tocarlo para alternar.
  const COLLAPSED_VH = 50
  const EXPANDED_VH = 88
  const SNAP_MID = (COLLAPSED_VH + EXPANDED_VH) / 2
  const [expanded, setExpanded] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const movedRef = useRef(false)

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isMobile) return
    draggingRef.current = true
    startYRef.current = e.clientY
    movedRef.current = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dy = e.clientY - startYRef.current
    if (Math.abs(dy) > 4) movedRef.current = true
    setDragOffset(dy)
  }
  function handlePointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (movedRef.current) {
      // Snap por threshold: dónde quedó la altura en este instante
      const dragVh = (dragOffset / window.innerHeight) * 100
      const finalVh = (expanded ? EXPANDED_VH : COLLAPSED_VH) - dragVh
      setExpanded(finalVh > SNAP_MID)
    } else {
      // Tap simple: alternar estado
      setExpanded(v => !v)
    }
    setDragOffset(0)
  }

  // Altura efectiva en vh, sumando el drag offset durante la interacción
  const baseVh = expanded ? EXPANDED_VH : COLLAPSED_VH
  const dragVh = draggingRef.current ? (dragOffset / (typeof window !== 'undefined' ? window.innerHeight : 800)) * 100 : 0
  const heightVh = Math.max(20, Math.min(95, baseVh - dragVh))

  // Publicar la altura del drawer al store como fracción (0–1) cuando es
  // mobile, para que WorldMapView pueda anclar el globo al área visible.
  // En desktop no aplica (panel es sidebar lateral, mantenemos el default).
  useEffect(() => {
    if (!isMobile) return
    setMobilePanelHeight(heightVh / 100)
  }, [isMobile, heightVh, setMobilePanelHeight])

  const inlineStyle: CSSProperties | undefined = isMobile
    ? {
        transform: mobileOpen ? 'translateY(0)' : 'translateY(100%)',
        height: `${heightVh}vh`,
        maxHeight: `${heightVh}vh`,
        // Safe area bottom: respeta el home indicator de iOS (~34px).
        // Sin esto el contenido inferior del drawer queda tapado por la barra.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transition: draggingRef.current
          ? 'none'
          : 'height 280ms cubic-bezier(0.25,1,0.5,1), max-height 280ms cubic-bezier(0.25,1,0.5,1), transform 280ms cubic-bezier(0.25,1,0.5,1)',
      }
    : undefined

  return (
    <>
      {/* Sin backdrop: el área de mapa arriba del drawer queda totalmente
          interactiva (pan, zoom, click en munis) aunque el panel esté abierto.
          Para cerrar: botón "Cerrar" o drag down del handle. */}

      <aside
        style={inlineStyle}
        className="flex shrink-0 flex-col overflow-hidden bg-white md:relative md:h-full md:w-[320px] md:border-r md:border-slate-200 fixed inset-x-0 bottom-0 z-[1050] rounded-t-2xl border-t border-slate-200 shadow-2xl md:rounded-none md:shadow-none md:h-full md:max-h-none"
      >
        {/* Handle drag area + cerrar (solo mobile).
            Toda la fila es draggable; el botón Cerrar usa stopPropagation
            para no disparar el drag al tap. touch-none evita que el browser
            haga scroll de la página mientras arrastrás. */}
        <div
          className="flex items-center justify-between border-b border-slate-100 px-4 py-1.5 md:hidden touch-none cursor-grab active:cursor-grabbing select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="button"
          tabIndex={0}
          aria-label={expanded ? 'Colapsar panel' : 'Expandir panel'}
        >
          <span aria-hidden className="block w-10" />
          <span className="h-[3px] w-8 rounded-full bg-slate-300" aria-hidden />
          <button
            type="button"
            onClick={onMobileClose}
            onPointerDown={e => e.stopPropagation()}
            className="text-[11px] text-slate-500 hover:text-slate-900"
          >
            Cerrar
          </button>
        </div>
      {/* Header del panel (solo desktop): muestra el reporte activo de forma
          prominente y clickeable. Reemplaza el slogan estático "Transparencia
          territorial" por contexto inmediato del mapa que se está viendo.
          Click → modal de cobertura del indicador, o al tab Datos si no hay
          indicador (CSV propio o vacío). */}
      <header className="hidden border-b border-slate-100 px-5 py-4 md:block">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Mapitas · Reporte
        </div>
        {activeIndicator ? (
          <button
            type="button"
            onClick={() => setHeaderModalOpen(true)}
            className="group mt-1.5 block w-full text-left transition focus:outline-none"
            aria-label={`Ver cobertura del reporte: ${activeIndicator.label}`}
          >
            <div className="flex items-baseline gap-2">
              <h1 className="text-[18px] font-semibold leading-[1.15] tracking-tight text-slate-900 group-hover:text-blue-600">
                {activeIndicator.label}
              </h1>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                aria-hidden="true"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              {activeIndicator.year > 0 ? `${activeIndicator.year} · ` : ''}
              {activeIndicator.source}
            </p>
          </button>
        ) : source?.kind === 'upload' ? (
          <button
            type="button"
            onClick={() => setTab('datos')}
            className="group mt-1.5 block w-full text-left transition focus:outline-none"
          >
            <h1 className="text-[18px] font-semibold leading-[1.15] tracking-tight text-slate-900 group-hover:text-blue-600">
              {source.dataset.valueColumn ?? 'CSV propio'}
            </h1>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              {source.dataset.filename} · {source.dataset.rows.length} filas
            </p>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setTab('datos')}
            className="mt-1.5 block w-full text-left text-[18px] font-semibold leading-[1.15] tracking-tight text-slate-500 transition hover:text-slate-900 focus:outline-none"
          >
            Elegí un indicador
            <span className="ml-2 text-[12px] font-normal text-slate-400">en Datos →</span>
          </button>
        )}
      </header>
      {headerModalOpen && activeIndicator && (
        <IndicatorCoverageModal
          indicator={activeIndicator}
          onClose={() => setHeaderModalOpen(false)}
        />
      )}

      {/* Nivel + Tabs: segmented controls compactos. Mismos en desktop y mobile.
          Tamaño reducido vs versión anterior (text-[11px], padding más chico)
          para ganar verticales sin cambiar el patrón visual.
          En vista Diáspora ocultamos el selector de nivel: no hay adm0/1/2,
          el "nivel" es siempre el país receptor. */}
      {!isDiaspora && (
        <div className="px-4 pt-2 pb-1.5">
          <div className="inline-flex w-full rounded bg-slate-100 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setLevel('adm0')}
              className={`flex-1 rounded-sm px-2 py-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                level === 'adm0' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              País
            </button>
            <button
              type="button"
              onClick={() => setLevel('adm1')}
              className={`flex-1 rounded-sm px-2 py-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                level === 'adm1' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Estados
            </button>
            <button
              type="button"
              onClick={() => setLevel('adm2')}
              className={`flex-1 rounded-sm px-2 py-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                level === 'adm2' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Municipios
            </button>
          </div>
        </div>
      )}

      <div className="border-b border-slate-100 px-4 pb-2">
        <div className="inline-flex w-full rounded bg-slate-100 p-0.5 text-[11px]">
          {(['datos', 'capas', 'estilo'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-sm px-2 py-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                tab === t
                  ? 'bg-white text-slate-900 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'datos' ? 'Datos' : t === 'capas' ? 'Capas' : 'Estilo'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        {tab === 'datos' && (
          <>
            {activeIndicator && level === 'adm2' && activeIndicator.aggregation === 'state' && (
              <div className="border-b border-slate-100 px-5 py-2 text-[10px] text-slate-400">
                Cada municipio toma el valor de su estado
              </div>
            )}
            <Section
              title="Indicadores"
              action={
                source ? (
                  <button
                    type="button"
                    onClick={clearSource}
                    className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-700"
                  >
                    limpiar
                  </button>
                ) : null
              }
            >
              <IndicatorsList />
            </Section>

            {/* Subir CSV al fondo del tab Datos, no fijo: scrollea con el
                resto del contenido. */}
            <Section title="Tus datos">
              <DataUploader />
            </Section>
          </>
        )}

        {tab === 'capas' && (
          <Section title="Capas temáticas">
            <ThematicLayersList />
          </Section>
        )}

        {tab === 'estilo' && (
          <Section title="Apariencia">
            <div className="space-y-4">
              <PaletteSelector />
              {isDiaspora && <ProjectionSelector />}
              <StyleControls />
            </div>
          </Section>
        )}

        {stats && stats.matched > 0 && (
          <Section title="Leyenda">
            {activeIndicator && (
              <div className="mb-2">
                <div className="text-[13px] font-medium text-slate-800">
                  {activeIndicator.label}
                </div>
                <div className="text-[11px] text-slate-500">
                  {activeIndicator.unit} · {activeIndicator.year} · {activeIndicator.source}
                </div>
                {activeIndicator.note && (
                  <div className="mt-1 text-[10px] text-amber-700">
                    {activeIndicator.note}
                  </div>
                )}
              </div>
            )}
            <Legend />
            <div className="mt-2 text-[10px] tabular-nums tracking-wide text-slate-400">
              <span className="text-slate-600">{stats.matched}</span>
              <span> de {stats.totalFeatures} pintados</span>
            </div>
          </Section>
        )}

        {selected && (
          <Section title="Seleccionado">
            <div className="text-[15px] font-semibold leading-tight text-slate-900">{selected.name}</div>
            {selected.nombreOficial && selected.nombreOficial !== selected.name && (
              <div className="mt-0.5 text-[11px] italic leading-snug text-slate-500">{selected.nombreOficial}</div>
            )}
            <div className="mt-1 text-[10px] tracking-wide text-slate-400">
              {selected.parentState && <span>{selected.parentState} · </span>}
              {selected.iso}
            </div>
            {selected.value != null && (
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[22px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                  {activeIndicator
                    ? formatIndicatorValue(selected.value, activeIndicator)
                    : selected.value.toLocaleString('es-VE')}
                </span>
                {activeIndicator && (
                  <span className="text-[11px] font-normal text-slate-500">{activeIndicator.unit}</span>
                )}
              </div>
            )}
            {/* Botón Más info → abre modal con extract de Wikipedia.
                Funciona para estados/munis VE y para países en vista Global.
                El query se arma con `wikiQueryFor` (incluye estado padre
                para munis con nombre genérico). */}
            <button
              type="button"
              onClick={() => setWikiOpen(true)}
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 underline-offset-2 transition hover:text-slate-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Más info
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3 transition group-hover:translate-x-0.5"
                aria-hidden
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </Section>
        )}
        {wikiOpen && selected && (
          <WikiModal
            query={wikiQueryFor(selected)}
            subtitle={
              selected.parentState
                ? `Municipio · ${selected.parentState}`
                : selected.iso?.startsWith('VE-')
                  ? 'Estado de Venezuela'
                  : view === 'global'
                    ? 'País'
                    : undefined
            }
            onClose={() => setWikiOpen(false)}
          />
        )}
      </div>

      <footer className="border-t border-slate-100 px-5 py-3 text-[10px] leading-relaxed text-slate-400">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0">
            Base: IGVSB / Provita. Datos: INE, OVV, estimaciones 2026.
          </span>
          <button
            type="button"
            onClick={() => {
              if (confirm('¿Resetear todos los ajustes guardados?')) resetSettings()
            }}
            className="shrink-0 rounded underline-offset-2 transition-colors hover:text-slate-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Resetear
          </button>
        </div>
      </footer>
      </aside>
    </>
  )
}

function PaletteSelector() {
  const palette = useStore(s => s.palette)
  const setPalette = useStore(s => s.setPalette)
  const mapStyle = useStore(s => s.mapStyle)
  const setMapStyle = useStore(s => s.setMapStyle)
  const custom = { start: mapStyle.customStart, end: mapStyle.customEnd }
  const [extraOpen, setExtraOpen] = useState(false)

  const [currentStart, currentEnd] = getPaletteStops(palette, custom)

  function onChangeStart(v: string) {
    if (palette === 'custom') setMapStyle({ customStart: v })
    else {
      setMapStyle({ customStart: v, customEnd: currentEnd })
      setPalette('custom')
    }
  }
  function onChangeEnd(v: string) {
    if (palette === 'custom') setMapStyle({ customEnd: v })
    else {
      setMapStyle({ customStart: currentStart, customEnd: v })
      setPalette('custom')
    }
  }

  // Previews de paletas usan midpoint geométrico (0.5) — esos son thumbnails,
  // no dependen del dominio de datos.
  const previewMid = 0.5

  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Paleta
      </div>
      <div className="grid grid-cols-6 gap-1">
        {PALETTE_OPTIONS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPalette(p.id)}
            title={p.label}
            aria-label={p.label}
            className={`h-7 rounded-sm border transition ${
              palette === p.id
                ? 'border-slate-900 ring-1 ring-slate-900'
                : 'border-slate-200 hover:border-slate-400'
            }`}
            style={{ background: paletteGradient(p.id, custom, previewMid) }}
          />
        ))}
        <button
          type="button"
          onClick={() => setExtraOpen(o => !o)}
          aria-label="Más paletas"
          title="Más paletas"
          className={`h-7 rounded-sm border border-slate-300 bg-white text-[14px] leading-none text-slate-500 transition hover:border-slate-500 ${
            extraOpen ? 'border-slate-900 text-slate-900' : ''
          }`}
        >
          {extraOpen ? '−' : '+'}
        </button>
      </div>

      {extraOpen && (
        <div className="mt-1 grid grid-cols-6 gap-1">
          {PALETTE_EXTRA.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPalette(p.id)}
              title={p.label}
              aria-label={p.label}
              className={`h-7 rounded-sm border transition ${
                palette === p.id
                  ? 'border-slate-900 ring-1 ring-slate-900'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
              style={{ background: paletteGradient(p.id, custom, previewMid) }}
            />
          ))}
        </div>
      )}

      {/* Color pickers de start/end siempre visibles — editan la paleta.
          El editor de rango con histograma + 3 handles vive abajo. */}
      <div className="mt-3 flex items-center gap-2 px-2">
        <input
          type="color"
          value={currentStart}
          onChange={e => onChangeStart(e.target.value)}
          className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0"
          aria-label="Color inicial"
        />
        <div className="flex-1 text-center text-[10px] uppercase tracking-wider text-slate-400">
          rango y centro
        </div>
        <input
          type="color"
          value={currentEnd}
          onChange={e => onChangeEnd(e.target.value)}
          className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0"
          aria-label="Color final"
        />
      </div>

      <div className="mt-2">
        <RangeEditor />
      </div>
    </div>
  )
}

// Selector de proyección para la vista Global. Solo se renderiza cuando
// view='global' (montaje condicional en ControlPanel arriba). Las sliders
// de rotación aparecen solo si la proyección activa es de tipo globo.
function ProjectionSelector() {
  const projection = useStore(s => s.projection)
  const setProjection = useStore(s => s.setProjection)
  const rotation = useStore(s => s.rotation)
  const setRotation = useStore(s => s.setRotation)
  const opt = PROJECTION_OPTIONS.find(p => p.id === projection)
  const isGlobe = opt?.isGlobe ?? false

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          Proyección
        </label>
        <select
          value={projection}
          onChange={e => setProjection(e.target.value as ProjectionId)}
          className="w-full appearance-none rounded-md border border-slate-200 bg-white py-1.5 px-2 text-[13px] text-slate-800 focus:border-slate-900 focus:outline-none"
        >
          {PROJECTION_OPTIONS.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">
          {projection === 'equalEarth' && 'Equal Earth: áreas correctas. Recomendada para choropleth.'}
          {projection === 'orthographic' && 'Globo terráqueo: se ve solo medio mundo a la vez. Usá la rotación.'}
          {projection === 'naturalEarth' && 'Compromiso clásico entre área y forma.'}
          {projection === 'mercator' && 'Web Mercator: deforma áreas en latitudes altas.'}
          {projection === 'equirectangular' && 'Coordenadas lat/lng lineales.'}
        </p>
      </div>

      {isGlobe && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Rotación del globo
          </div>
          <RotationSlider
            label="Lambda (este/oeste)"
            min={-180}
            max={180}
            value={rotation[0]}
            onChange={v => setRotation([v, rotation[1], rotation[2]])}
          />
          <RotationSlider
            label="Phi (norte/sur)"
            min={-90}
            max={90}
            value={rotation[1]}
            onChange={v => setRotation([rotation[0], v, rotation[2]])}
          />
          <RotationSlider
            label="Gamma (giro)"
            min={-180}
            max={180}
            value={rotation[2]}
            onChange={v => setRotation([rotation[0], rotation[1], v])}
          />
          <button
            type="button"
            onClick={() => setRotation([66, -7, 0])}
            className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-slate-700"
            title="Volver al centro inicial sobre Venezuela"
          >
            centrar en Venezuela
          </button>
        </div>
      )}
    </div>
  )
}

function RotationSlider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums text-slate-500">{Math.round(value)}°</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-0.5 w-full"
        aria-label={label}
      />
    </div>
  )
}
