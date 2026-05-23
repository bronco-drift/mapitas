import { useState } from 'react'
import { useStore } from '../store'
import { INDICATORS, getIndicatorCoverage, type Indicator } from '../data/indicators'
import { IndicatorCoverageModal } from './IndicatorCoverageModal'

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
  const [coverageModalFor, setCoverageModalFor] = useState<Indicator | null>(null)

  const totals = {
    adm1Count: adm1?.features.length ?? FALLBACK_TOTALS.adm1Count,
    adm2Count: adm2?.features.length ?? FALLBACK_TOTALS.adm2Count,
  }

  return (
    <>
      <div className="space-y-1">
        {INDICATORS.map(indicator => {
          const active = activeId === indicator.id
          const cov = getIndicatorCoverage(indicator, level, totals)
          const disabled = !cov.applies

          const onRowActivate = () => {
            if (disabled) return
            selectIndicator(active ? null : indicator.id)
          }

          // El row es un div con role="button" porque queremos un button real
          // anidado adentro (el badge -NN) y eso es HTML inválido dentro de
          // <button>. Mantenemos accesibilidad con tabIndex + onKeyDown.
          return (
            <div
              key={indicator.id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-pressed={active}
              aria-disabled={disabled}
              onClick={onRowActivate}
              onKeyDown={e => {
                if (disabled) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onRowActivate()
                }
              }}
              className={`group flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left transition outline-none focus:ring-2 focus:ring-slate-400 ${
                active
                  ? 'bg-slate-900 text-white'
                  : disabled
                    ? 'cursor-not-allowed opacity-40'
                    : 'cursor-pointer hover:bg-slate-100'
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
                  {/* Badge "·N": cantidad de entidades sin data al nivel actual.
                      Click abre el modal con la lista. Color amber (warning
                      sutil), no rose (alarma). */}
                  {cov.applies && cov.missing > 0 && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setCoverageModalFor(indicator)
                      }}
                      className={`shrink-0 rounded text-[10px] font-medium tabular-nums transition hover:underline ${
                        active ? 'text-amber-200 hover:text-amber-100' : 'text-amber-600 hover:text-amber-700'
                      }`}
                      title={`Faltan ${cov.missing} de ${cov.total} ${level === 'adm1' ? 'estados' : 'municipios'}. Click para ver cuáles`}
                      aria-label={`Ver cobertura (${cov.missing} sin datos)`}
                    >
                      ·{cov.missing}
                    </button>
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
            </div>
          )
        })}
      </div>

      {coverageModalFor && (
        <IndicatorCoverageModal
          indicator={coverageModalFor}
          onClose={() => setCoverageModalFor(null)}
        />
      )}
    </>
  )
}
