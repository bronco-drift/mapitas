import { useStore } from '../store'
import { paletteStops } from '../lib/color-scale'
import { formatIndicatorValue } from '../data/indicators'

export function Legend() {
  const stats = useStore(s => s.stats)
  const palette = useStore(s => s.palette)
  const source = useStore(s => s.source)
  const mapStyle = useStore(s => s.mapStyle)

  if (!stats || stats.matched === 0) return null

  const custom = {
    start: mapStyle.customStart,
    end: mapStyle.customEnd,
    reverse: mapStyle.paletteReverse,
  }
  const stops = paletteStops(palette, 6, custom)
  const min = stats.min
  const max = stats.max
  const mid = (min + max) / 2

  const fmt = (v: number) => {
    if (source?.kind === 'indicator') return formatIndicatorValue(v, source.indicator)
    return v.toLocaleString('es-VE', { maximumFractionDigits: 1 })
  }

  // Si auto-clip está activo, el `max` mostrado es el percentil 98 (no el
  // máximo absoluto). Sin marcarlo, el user puede creer que ese es el valor
  // real más alto y subestimar los outliers. Asterisco discreto + tooltip
  // explican que hay valores fuera del rango visualizado.
  const isClipped = mapStyle.autoClipExtremes && source?.kind === 'indicator'

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-sm">
        {stops.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>{fmt(min)}{isClipped && <Clipped pos="min" />}</span>
        <span>{fmt(mid)}</span>
        <span>{fmt(max)}{isClipped && <Clipped pos="max" />}</span>
      </div>
    </div>
  )
}

// Asterisco con title nativo que explica el auto-clip. Title es leído por
// screen readers y muestra tooltip en hover (desktop). Para mobile el user
// puede tocar el toggle "Auto-clip" en Estilo → Apariencia.
function Clipped({ pos }: { pos: 'min' | 'max' }) {
  return (
    <span
      className="ml-0.5 cursor-help text-slate-400 dark:text-slate-500"
      title={
        pos === 'min'
          ? 'Valor del percentil 2. Los valores más bajos quedan fuera del gradiente. Desactivar en Estilo → Apariencia.'
          : 'Valor del percentil 98. Los valores más altos quedan fuera del gradiente. Desactivar en Estilo → Apariencia.'
      }
    >
      *
    </span>
  )
}
