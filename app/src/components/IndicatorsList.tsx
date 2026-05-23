import { useStore } from '../store'
import { INDICATORS, getIndicatorCoverage } from '../data/indicators'

// Defaults razonables si los geo todavía no cargaron (primer render).
// 26 estados + Esequibo, 336 munis del adm2 post-fix.
const FALLBACK_TOTALS = { adm1Count: 26, adm2Count: 336 }

export function IndicatorsList() {
  const source = useStore(s => s.source)
  const selectIndicator = useStore(s => s.selectIndicator)
  const level = useStore(s => s.level)
  const adm1 = useStore(s => s.adm1)
  const adm2 = useStore(s => s.adm2)
  const activeId = source?.kind === 'indicator' ? source.indicator.id : null

  const totals = {
    adm1Count: adm1?.features.length ?? FALLBACK_TOTALS.adm1Count,
    adm2Count: adm2?.features.length ?? FALLBACK_TOTALS.adm2Count,
  }

  return (
    <div className="space-y-1">
      {INDICATORS.map(indicator => {
        const active = activeId === indicator.id
        const cov = getIndicatorCoverage(indicator, level, totals)
        const disabled = !cov.applies

        return (
          <button
            key={indicator.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              selectIndicator(active ? null : indicator.id)
            }}
            className={`group flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left transition ${
              active
                ? 'bg-slate-900 text-white'
                : disabled
                  ? 'cursor-not-allowed opacity-40'
                  : 'hover:bg-slate-100'
            }`}
            title={disabled ? cov.reason : undefined}
          >
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <div
                  className={`text-[13px] font-medium ${
                    active ? 'text-white' : 'text-slate-800'
                  }`}
                >
                  {indicator.label}
                </div>
                {/* Badge -NN: cantidad de entidades sin data al nivel actual.
                    Sólo cuando el indicador SÍ aplica (no tiene sentido mostrar
                    -336 cuando el indicador no es de munis). */}
                {cov.applies && cov.missing > 0 && (
                  <span
                    className={`shrink-0 text-[10px] font-semibold tabular-nums ${
                      active ? 'text-rose-200' : 'text-rose-600'
                    }`}
                    title={`Faltan ${cov.missing} de ${cov.total} ${
                      level === 'adm1' ? 'estados' : 'municipios'
                    }`}
                  >
                    −{cov.missing}
                  </span>
                )}
              </div>
              <div
                className={`mt-0.5 truncate text-[11px] ${
                  active ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {disabled
                  ? cov.reason
                  : `${indicator.unit} · ${indicator.year}`}
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
