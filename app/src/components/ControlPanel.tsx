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

type Props = {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function ControlPanel({ mobileOpen = false, onMobileClose }: Props) {
  const level = useStore(s => s.level)
  const setLevel = useStore(s => s.setLevel)
  const selected = useStore(s => s.selected)
  const source = useStore(s => s.source)
  const stats = useStore(s => s.stats)
  const clearSource = useStore(s => s.clearSource)
  const resetSettings = useStore(s => s.resetSettings)
  const tab = useStore(s => s.tab)
  const setTab = useStore(s => s.setTab)
  const isMobile = useIsMobile()

  const activeIndicator = source?.kind === 'indicator' ? source.indicator : null

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

  const inlineStyle: CSSProperties | undefined = isMobile
    ? {
        transform: mobileOpen ? 'translateY(0)' : 'translateY(100%)',
        height: `${heightVh}vh`,
        maxHeight: `${heightVh}vh`,
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
      <header className="hidden border-b border-slate-100 px-5 py-5 md:block">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Mapitas
        </div>
        <h1 className="mt-1.5 text-[18px] font-semibold leading-[1.1] tracking-tight text-slate-900">
          Transparencia territorial
        </h1>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          Venezuela · datos abiertos · 100% local
        </p>
      </header>

      {/* Nivel + Tabs: segmented controls compactos. Mismos en desktop y mobile.
          Tamaño reducido vs versión anterior (text-[11px], padding más chico)
          para ganar verticales sin cambiar el patrón visual. */}
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

      <div className="flex-1 overflow-y-auto">
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
          </Section>
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
