import { useMemo, useRef, useState, useEffect } from 'react'
import { useStore } from '../store'
import { colorScale } from '../lib/color-scale'
import { formatIndicatorValue } from '../data/indicators'

const HIST_BUCKETS = 22
const STEPS = 5

type Thumb = 'min' | 'mid' | 'max'

export function ClassificationPanel() {
  const source = useStore(s => s.source)
  const palette = useStore(s => s.palette)
  const mapStyle = useStore(s => s.mapStyle)
  const customRange = useStore(s => s.customRange)
  const setCustomRange = useStore(s => s.setCustomRange)
  const resetCustomRange = useStore(s => s.resetCustomRange)

  // Hooks SIEMPRE arriba; los valores derivados se calculan condicionalmente.
  const indicator = source?.kind === 'indicator' ? source.indicator : null

  const values = useMemo(() => {
    if (!indicator) return [] as number[]
    return Object.values(indicator.data).filter(v => typeof v === 'number') as number[]
  }, [indicator])

  const [autoMin, autoMax] = useMemo<[number, number]>(() => {
    if (values.length === 0) return [0, 1]
    let lo = values[0]
    let hi = values[0]
    for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v }
    return [lo, hi]
  }, [values])

  // Valores efectivos: usan custom si está, sino auto
  const min = customRange.min ?? autoMin
  const max = customRange.max ?? autoMax
  const mid = customRange.mid ?? (min + max) / 2

  // Histograma normalizado [0..1] de las alturas
  const histogram = useMemo(() => {
    if (values.length === 0 || autoMin === autoMax) return new Array(HIST_BUCKETS).fill(0)
    const buckets = new Array(HIST_BUCKETS).fill(0)
    const range = autoMax - autoMin
    for (const v of values) {
      const idx = Math.min(HIST_BUCKETS - 1, Math.max(0, Math.floor(((v - autoMin) / range) * HIST_BUCKETS)))
      buckets[idx]++
    }
    const maxCount = Math.max(...buckets)
    return buckets.map(b => (maxCount > 0 ? b / maxCount : 0))
  }, [values, autoMin, autoMax])

  // 5 bins centrados (0.1, 0.3, 0.5, 0.7, 0.9 del rango [min, max])
  const bins = useMemo(() => {
    const customStops = { start: mapStyle.customStart, end: mapStyle.customEnd }
    const out: { value: number; color: string }[] = []
    for (let i = 0; i < STEPS; i++) {
      const t = (i + 0.5) / STEPS
      const value = min + (max - min) * t
      out.push({ value, color: colorScale(value, min, max, palette, customStops) })
    }
    return out
  }, [min, max, palette, mapStyle.customStart, mapStyle.customEnd])

  // Posición de los thumbs como % del rango natural (lo que ve el histograma)
  const natRange = autoMax - autoMin || 1
  const posMin = Math.max(0, Math.min(100, ((min - autoMin) / natRange) * 100))
  const posMid = Math.max(0, Math.min(100, ((mid - autoMin) / natRange) * 100))
  const posMax = Math.max(0, Math.min(100, ((max - autoMin) / natRange) * 100))

  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<Thumb | null>(null)

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const v = autoMin + x * natRange
      const cur = { min, mid, max }
      const eps = natRange * 0.005
      if (dragging === 'min') {
        const newMin = Math.min(v, cur.mid - eps, cur.max - eps)
        setCustomRange({ min: newMin })
      } else if (dragging === 'max') {
        const newMax = Math.max(v, cur.mid + eps, cur.min + eps)
        setCustomRange({ max: newMax })
      } else {
        const newMid = Math.max(cur.min + eps, Math.min(cur.max - eps, v))
        setCustomRange({ mid: newMid })
      }
    }
    const onUp = () => setDragging(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, autoMin, natRange, min, mid, max, setCustomRange])

  if (!indicator) return null
  if (values.length < 2) return null

  const fmt = (v: number) => formatIndicatorValue(v, indicator)

  const isCustom = customRange.min != null || customRange.mid != null || customRange.max != null

  return (
    <div className="space-y-3">
      <div className="text-[10px] leading-snug text-slate-500">
        Arrastrá Min/Med/Max para redefinir el rango y el centro del color.
      </div>

      {/* Histograma */}
      <div className="flex h-10 items-end gap-px">
        {histogram.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-slate-400/70"
            style={{ height: `${Math.max(h * 100, 2)}%` }}
          />
        ))}
      </div>

      {/* Track con 3 thumbs */}
      <div
        ref={trackRef}
        className="relative mt-1 h-6 cursor-pointer select-none touch-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-800"
          style={{ left: `${posMin}%`, width: `${Math.max(0, posMax - posMin)}%` }}
        />
        <ThumbDot pos={posMin} label="Min" active={dragging === 'min'} onDown={() => setDragging('min')} />
        <ThumbDot pos={posMid} label="Med" active={dragging === 'mid'} onDown={() => setDragging('mid')} />
        <ThumbDot pos={posMax} label="Max" active={dragging === 'max'} onDown={() => setDragging('max')} />
      </div>

      <div className="flex justify-between text-[10px] font-medium tabular-nums text-slate-600">
        <span>{fmt(min)}</span>
        <span>{fmt(mid)}</span>
        <span>{fmt(max)}</span>
      </div>

      {/* 5 bins discretos */}
      <div className="grid grid-cols-5 gap-1">
        {bins.map((b, i) => (
          <div
            key={i}
            className="rounded-sm border border-slate-200 px-1 py-1.5 text-center text-[10px] font-medium tabular-nums"
            style={{
              background: b.color,
              color: contrastColor(b.color),
            }}
          >
            {fmt(b.value)}
          </div>
        ))}
      </div>

      {isCustom && (
        <button
          type="button"
          onClick={resetCustomRange}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        >
          Restaurar rango automático
        </button>
      )}
    </div>
  )
}

function ThumbDot({
  pos,
  label,
  active,
  onDown,
}: {
  pos: number
  label: string
  active: boolean
  onDown: () => void
}) {
  return (
    <div
      onPointerDown={e => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onDown()
      }}
      role="slider"
      aria-label={label}
      aria-valuenow={pos}
      tabIndex={0}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-slate-900 bg-white cursor-grab ${
        active ? 'cursor-grabbing scale-110 ring-2 ring-slate-300' : ''
      }`}
      style={{ left: `${pos}%` }}
    >
      <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </div>
  )
}

// Devuelve negro o blanco según la luminancia del color de fondo (legibilidad)
function contrastColor(bg: string): string {
  // Extraer rgb de hex o rgb()
  let r = 255, g = 255, b = 255
  if (bg.startsWith('#') && bg.length === 7) {
    r = parseInt(bg.slice(1, 3), 16)
    g = parseInt(bg.slice(3, 5), 16)
    b = parseInt(bg.slice(5, 7), 16)
  } else {
    const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (m) { r = +m[1]; g = +m[2]; b = +m[3] }
  }
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.55 ? '#1e293b' : '#ffffff'
}
