import { useStore } from '../store'

export function ThematicLayersList() {
  const thematic = useStore(s => s.thematic)
  const toggleThematic = useStore(s => s.toggleThematic)

  const entries = Object.values(thematic)
  if (entries.length === 0) {
    return (
      <div className="text-[11px] italic text-slate-400">
        Cargando catálogo…
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {entries.map(entry => {
        const { meta, enabled, loading } = entry
        return (
          <button
            key={meta.id}
            type="button"
            onClick={() => toggleThematic(meta.id)}
            disabled={loading}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition ${
              enabled ? 'bg-slate-50 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-300"
                style={{ background: enabled ? meta.color : 'transparent' }}
              />
              <span className="min-w-0">
                <div className="truncate">{meta.label}</div>
                <div className="text-[10px] text-slate-400">
                  {meta.featureCount} · {meta.sizeKB} KB
                </div>
              </span>
            </span>
            <span className="text-[10px] text-slate-400">
              {loading ? '…' : enabled ? 'on' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
