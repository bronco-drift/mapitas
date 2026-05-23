import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { paletteGradient } from '../lib/color-scale'
import { formatIndicatorValue } from '../data/indicators'

// Editor de 3 stops sobre la barra de gradiente:
//   - Min: límite inferior del dominio del color scale (valores ≤ min → color inicial)
//   - Mid: dónde cae el color medio en el dominio (reshape la curva)
//   - Max: límite superior (valores ≥ max → color final)
//
// Cada handle puede estar en "auto" (null en customRange) — se ve translúcido
// y se posiciona en el extremo / medio natural. Al arrastrar, fija valor
// absoluto del dominio. Doble click resetea ESE handle a auto.
//
// Arriba: histograma de los valores reales del nivel/indicador activo.
// Las barras dentro del rango [min, max] efectivo se tiñen con el color del
// gradiente; las de afuera quedan más apagadas (saturación visual).

const HIST_BINS = 24

type HandleKey = 'min' | 'mid' | 'max'

export function RangeEditor() {
  const palette = useStore(s => s.palette)
  const mapStyle = useStore(s => s.mapStyle)
  const customRange = useStore(s => s.customRange)
  const setCustomRange = useStore(s => s.setCustomRange)
  const stats = useStore(s => s.stats)
  const level = useStore(s => s.level)
  const adm0 = useStore(s => s.adm0)
  const adm1 = useStore(s => s.adm1)
  const adm2 = useStore(s => s.adm2)
  const source = useStore(s => s.source)
  const activeIndicator = source?.kind === 'indicator' ? source.indicator : null

  const custom = { start: mapStyle.customStart, end: mapStyle.customEnd }

  // Valores reales para el histograma — vienen de las features del nivel activo
  const values = useMemo(() => {
    const data = level === 'adm0' ? adm0 : level === 'adm1' ? adm1 : adm2
    if (!data) return [] as number[]
    return data.features
      .map(f => (f.properties as { _value?: number | null })._value)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  }, [level, adm0, adm1, adm2])

  // Min/Max naturales — de stats si están, sino de los values
  const autoMin = stats?.min ?? (values.length ? Math.min(...values) : 0)
  const autoMax = stats?.max ?? (values.length ? Math.max(...values) : 1)
  const effMin = customRange.min ?? autoMin
  const effMax = customRange.max ?? autoMax
  const effMid = customRange.mid ?? (effMin + effMax) / 2
  const span = effMax - effMin

  // Ratios para posicionar handles sobre el track [0..1]
  const minRatio = 0
  const maxRatio = 1
  const midRatio = span > 0 ? Math.max(0.05, Math.min(0.95, (effMid - effMin) / span)) : 0.5

  // Bins del histograma — siempre sobre el dominio efectivo (no auto), así
  // si el user ajusta el rango el histograma se re-bineja en torno a eso.
  const histogram = useMemo(() => {
    if (values.length === 0) return new Array(HIST_BINS).fill(0)
    const lo = autoMin
    const hi = autoMax
    if (hi <= lo) return new Array(HIST_BINS).fill(values.length)
    const counts = new Array(HIST_BINS).fill(0)
    for (const v of values) {
      const t = (v - lo) / (hi - lo)
      const idx = Math.max(0, Math.min(HIST_BINS - 1, Math.floor(t * HIST_BINS)))
      counts[idx] += 1
    }
    return counts
  }, [values, autoMin, autoMax])
  const maxCount = Math.max(1, ...histogram)

  // Posición visual del rango efectivo dentro del dominio natural
  // Sirve para resaltar qué bins del histograma están "dentro" del color scale
  const inRangeStart = autoMax > autoMin ? (effMin - autoMin) / (autoMax - autoMin) : 0
  const inRangeEnd = autoMax > autoMin ? (effMax - autoMin) / (autoMax - autoMin) : 1

  // Drag state
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<HandleKey | null>(null)

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const track = trackRef.current
      if (!track || span <= 0) return
      const r = track.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const clamped = Math.max(0, Math.min(1, x))
      const value = effMin + clamped * span

      if (dragging === 'min') {
        // Min no puede pasar el mid o max. Si supera, lo empuja para abajo.
        const cap = Math.min(effMid - span * 0.02, effMax - span * 0.04)
        setCustomRange({ min: Math.min(value, cap) })
      } else if (dragging === 'mid') {
        const lo = effMin + span * 0.02
        const hi = effMax - span * 0.02
        setCustomRange({ mid: Math.max(lo, Math.min(hi, value)) })
      } else if (dragging === 'max') {
        const floor = Math.max(effMid + span * 0.02, effMin + span * 0.04)
        setCustomRange({ max: Math.max(value, floor) })
      }
    }
    const onUp = () => setDragging(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, effMin, effMid, effMax, span, setCustomRange])

  // Formatter — usa el del indicador si hay; sino genérico
  const fmt = (v: number) => {
    if (activeIndicator) return formatIndicatorValue(v, activeIndicator)
    if (Math.abs(v) >= 1000) return v.toLocaleString('es-VE', { maximumFractionDigits: 0 })
    return v.toFixed(2)
  }

  const hasCustom =
    customRange.min != null || customRange.mid != null || customRange.max != null

  return (
    <div>
      {/* Histograma — solo si hay valores */}
      {values.length > 0 && (
        <div className="mb-1 flex h-10 items-end gap-[1px] px-2">
          {histogram.map((count, i) => {
            const binRatio = (i + 0.5) / HIST_BINS
            const inRange = binRatio >= inRangeStart && binRatio <= inRangeEnd
            const h = (count / maxCount) * 100
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-colors ${
                  inRange ? 'bg-slate-400' : 'bg-slate-200'
                }`}
                style={{ height: `${Math.max(h, 4)}%` }}
                title={`${count} ${count === 1 ? 'feature' : 'features'}`}
              />
            )
          })}
        </div>
      )}

      {/* Track + 3 handles */}
      <div ref={trackRef} className="relative h-7 px-2">
        {/* Barra del gradiente */}
        <div
          className="absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 rounded-sm"
          style={{ background: paletteGradient(palette, custom, midRatio) }}
        />

        {/* Min handle */}
        <Handle
          ratio={minRatio}
          kind="min"
          isAuto={customRange.min == null}
          isDragging={dragging === 'min'}
          label={fmt(effMin)}
          onPointerDown={() => setDragging('min')}
          onDoubleClick={() => setCustomRange({ min: null })}
        />

        {/* Mid handle */}
        <Handle
          ratio={midRatio}
          kind="mid"
          isAuto={customRange.mid == null}
          isDragging={dragging === 'mid'}
          label={fmt(effMid)}
          onPointerDown={() => setDragging('mid')}
          onDoubleClick={() => setCustomRange({ mid: null })}
        />

        {/* Max handle */}
        <Handle
          ratio={maxRatio}
          kind="max"
          isAuto={customRange.max == null}
          isDragging={dragging === 'max'}
          label={fmt(effMax)}
          onPointerDown={() => setDragging('max')}
          onDoubleClick={() => setCustomRange({ max: null })}
        />
      </div>

      {/* Hint + reset */}
      <div className="mt-1 flex items-center justify-between px-2 text-[10px] text-slate-400">
        <span>
          {hasCustom ? 'Rango ajustado' : 'Doble click en un punto para volver a auto'}
        </span>
        {hasCustom && (
          <button
            type="button"
            onClick={() => setCustomRange({ min: null, mid: null, max: null })}
            className="text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            auto
          </button>
        )}
      </div>
    </div>
  )
}

function Handle({
  ratio,
  kind,
  isAuto,
  isDragging,
  label,
  onPointerDown,
  onDoubleClick,
}: {
  ratio: number
  kind: HandleKey
  isAuto: boolean
  isDragging: boolean
  label: string
  onPointerDown: (e: React.PointerEvent) => void
  onDoubleClick: () => void
}) {
  const left = `${ratio * 100}%`
  return (
    <div
      role="slider"
      aria-label={kind === 'min' ? 'Mínimo' : kind === 'mid' ? 'Centro' : 'Máximo'}
      onPointerDown={e => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onPointerDown(e)
      }}
      onDoubleClick={onDoubleClick}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-slate-900 bg-white cursor-grab ${
        isDragging ? 'cursor-grabbing scale-110 ring-2 ring-slate-300' : ''
      } ${isAuto && !isDragging ? 'opacity-60' : ''}`}
      style={{ left }}
      title={`${kind}: ${label}${isAuto ? ' (auto)' : ''} — doble click resetea`}
    >
      {/* Label flotante visible solo al arrastrar */}
      {isDragging && (
        <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </div>
      )}
    </div>
  )
}
