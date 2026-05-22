import { useStore } from '../store'
import { INDICATORS } from '../data/indicators'

export function IndicatorsList() {
  const source = useStore(s => s.source)
  const selectIndicator = useStore(s => s.selectIndicator)
  const activeId = source?.kind === 'indicator' ? source.indicator.id : null

  return (
    <div className="space-y-1">
      {INDICATORS.map(indicator => {
        const active = activeId === indicator.id
        return (
          <button
            key={indicator.id}
            type="button"
            onClick={() => selectIndicator(active ? null : indicator.id)}
            className={`group flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left transition ${
              active
                ? 'bg-slate-900 text-white'
                : 'hover:bg-slate-100'
            }`}
          >
            <div className="min-w-0">
              <div className={`text-[13px] font-medium ${active ? 'text-white' : 'text-slate-800'}`}>
                {indicator.label}
              </div>
              <div className={`mt-0.5 truncate text-[11px] ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                {indicator.unit} · {indicator.year}
              </div>
            </div>
            <span
              aria-hidden
              className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full border ${
                active ? 'border-white bg-white' : 'border-slate-300'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
