import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { PALETTE_OPTIONS, paletteGradient, getPaletteStops } from '../lib/color-scale'

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
  const isMobile = useIsMobile()

  const activeIndicator = source?.kind === 'indicator' ? source.indicator : null
  // Solo aplicamos transform inline cuando estamos en mobile; en desktop el
  // aside ocupa su lugar normal por las clases md:relative.
  const inlineStyle = isMobile
    ? { transform: mobileOpen ? 'translateY(0)' : 'translateY(100%)' }
    : undefined

  return (
    <>
      {/* Capa invisible solo en mobile: capta el tap fuera del panel para cerrar,
          pero NO oscurece el mapa */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar panel"
          onClick={onMobileClose}
          className="fixed inset-0 z-[1040] bg-transparent md:hidden"
        />
      )}

      <aside
        style={inlineStyle}
        className="flex shrink-0 flex-col overflow-hidden bg-white md:relative md:h-full md:w-[320px] md:border-r md:border-slate-200 fixed inset-x-0 bottom-0 z-[1050] h-[45vh] max-h-[45vh] rounded-t-2xl border-t border-slate-200 shadow-2xl md:rounded-none md:shadow-none md:h-full md:max-h-none"
      >
        {/* Handle + close visible solo mobile */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 md:hidden">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
          <button
            type="button"
            onClick={onMobileClose}
            className="text-[12px] text-slate-500 hover:text-slate-900"
          >
            Cerrar
          </button>
        </div>
      <header className="hidden border-b border-slate-100 px-5 pt-5 pb-4 md:block">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
          Mapitas
        </div>
        <h1 className="mt-1 text-[15px] font-semibold leading-tight text-slate-900">
          Transparencia territorial
        </h1>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Venezuela · datos abiertos · 100% local
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <Section title="Nivel">
          <div className="inline-flex w-full rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setLevel('adm0')}
              className={`flex-1 rounded px-2.5 py-1 transition ${
                level === 'adm0'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              País
            </button>
            <button
              type="button"
              onClick={() => setLevel('adm1')}
              className={`flex-1 rounded px-2.5 py-1 transition ${
                level === 'adm1'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Estados
            </button>
            <button
              type="button"
              onClick={() => setLevel('adm2')}
              className={`flex-1 rounded px-2.5 py-1 transition ${
                level === 'adm2'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Municipios
            </button>
          </div>
          {activeIndicator && level === 'adm2' && activeIndicator.aggregation === 'state' && (
            <div className="mt-2 text-[10px] text-slate-400">
              Indicador estatal heredado a cada municipio
            </div>
          )}
          {activeIndicator && level === 'adm2' && activeIndicator.aggregation === 'municipality' && (
            <div className="mt-2 text-[10px] text-slate-400">
              Datos municipales · estados sin desglose usan agregado
            </div>
          )}
        </Section>

        <Section
          title="Datos"
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
          <div className="mt-3 border-t border-slate-100 pt-3">
            <DataUploader />
          </div>
        </Section>

        <Section title="Capas" collapsible defaultCollapsed>
          <ThematicLayersList />
        </Section>

        <Section title="Estilo" collapsible defaultCollapsed>
          <div className="space-y-4">
            <PaletteSelector />
            <StyleControls />
          </div>
        </Section>

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
            <div className="mt-2 text-[10px] text-slate-400">
              {stats.matched} de {stats.totalFeatures} pintados
            </div>
          </Section>
        )}

        {selected && (
          <Section title="Seleccionado">
            <div className="text-[13px] font-medium text-slate-900">{selected.name}</div>
            {selected.nombreOficial && selected.nombreOficial !== selected.name && (
              <div className="text-[11px] italic text-slate-500">{selected.nombreOficial}</div>
            )}
            <div className="mt-0.5 text-[10px] text-slate-400">
              {selected.parentState && <span>{selected.parentState} · </span>}
              {selected.iso}
            </div>
            {selected.value != null && (
              <div className="mt-2 text-[13px] font-medium text-slate-800">
                {activeIndicator
                  ? formatIndicatorValue(selected.value, activeIndicator)
                  : selected.value.toLocaleString('es-VE')}
                {activeIndicator && (
                  <span className="ml-1 text-[11px] font-normal text-slate-500">{activeIndicator.unit}</span>
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
            className="shrink-0 underline-offset-2 hover:text-slate-700 hover:underline"
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

  // Stops actuales de la paleta seleccionada (predefinida o custom)
  const [currentStart, currentEnd] = getPaletteStops(palette, custom)

  // Al cambiar un color desde los pickers, "convertimos" la paleta a custom
  // usando esos colores. Si la paleta ya era custom, sólo updateamos el stop.
  function onChangeStart(v: string) {
    if (palette === 'custom') {
      setMapStyle({ customStart: v })
    } else {
      setMapStyle({ customStart: v, customEnd: currentEnd })
      setPalette('custom')
    }
  }
  function onChangeEnd(v: string) {
    if (palette === 'custom') {
      setMapStyle({ customEnd: v })
    } else {
      setMapStyle({ customStart: currentStart, customEnd: v })
      setPalette('custom')
    }
  }

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
            style={{ background: paletteGradient(p.id, custom) }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={currentStart}
          onChange={e => onChangeStart(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-slate-200 bg-white p-0"
          aria-label="Color inicial"
          title="Color inicial"
        />
        <div
          className="h-2 flex-1 rounded-sm"
          style={{ background: paletteGradient(palette, custom) }}
        />
        <input
          type="color"
          value={currentEnd}
          onChange={e => onChangeEnd(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-slate-200 bg-white p-0"
          aria-label="Color final"
          title="Color final"
        />
      </div>
    </div>
  )
}
