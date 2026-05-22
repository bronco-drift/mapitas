import { useStore } from '../store'
import { paletteStops } from '../lib/color-scale'
import { formatIndicatorValue } from '../data/indicators'

export function Legend() {
  const stats = useStore(s => s.stats)
  const palette = useStore(s => s.palette)
  const source = useStore(s => s.source)
  const mapStyle = useStore(s => s.mapStyle)

  if (!stats || stats.matched === 0) return null

  const custom = { start: mapStyle.customStart, end: mapStyle.customEnd }
  const stops = paletteStops(palette, 6, custom)
  const min = stats.min
  const max = stats.max
  const mid = (min + max) / 2

  const fmt = (v: number) => {
    if (source?.kind === 'indicator') return formatIndicatorValue(v, source.indicator)
    return v.toLocaleString('es-VE', { maximumFractionDigits: 1 })
  }

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-sm">
        {stops.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{fmt(min)}</span>
        <span>{fmt(mid)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  )
}
