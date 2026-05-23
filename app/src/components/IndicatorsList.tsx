import { useState } from 'react'
import { useStore } from '../store'
import { INDICATORS, getIndicatorCoverage, type Indicator, type IndicatorCoverage } from '../data/indicators'
import { IndicatorCoverageModal } from './IndicatorCoverageModal'

// Defaults razonables si los geo todavía no cargaron (primer render).
// 26 estados + Esequibo, 336 munis del adm2 post-fix.
const FALLBACK_TOTALS = { adm1Count: 26, adm2Count: 336 }

type RowMeta = {
  indicator: Indicator
  cov: IndicatorCoverage
  isManuallyArchived: boolean
  isAutoArchived: boolean // no aplica al nivel actual
  isArchived: boolean
}

export function IndicatorsList() {
  const source = useStore(s => s.source)
  const selectIndicator = useStore(s => s.selectIndicator)
  const archivedIndicators = useStore(s => s.archivedIndicators)
  const archiveIndicator = useStore(s => s.archiveIndicator)
  const unarchiveIndicator = useStore(s => s.unarchiveIndicator)
  const level = useStore(s => s.level)
  const adm1 = useStore(s => s.adm1)
  const adm2 = useStore(s => s.adm2)
  const activeId = source?.kind === 'indicator' ? source.indicator.id : null
  const [coverageModalFor, setCoverageModalFor] = useState<Indicator | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const totals = {
    adm1Count: adm1?.features.length ?? FALLBACK_TOTALS.adm1Count,
    adm2Count: adm2?.features.length ?? FALLBACK_TOTALS.adm2Count,
  }

  // Clasificar todos los indicadores en visibles vs archivados.
  // Archivado puede ser por dos motivos:
  //   - manual: el user lo archivó (o estaba archivado por default)
  //   - auto: no aplica al nivel actual (ej. indicador estatal en vista muni)
  const rows: RowMeta[] = INDICATORS.map(indicator => {
    const cov = getIndicatorCoverage(indicator, level, totals)
    const isManuallyArchived = archivedIndicators.includes(indicator.id)
    const isAutoArchived = !cov.applies
    return {
      indicator,
      cov,
      isManuallyArchived,
      isAutoArchived,
      isArchived: isManuallyArchived || isAutoArchived,
    }
  })

  const visibleRows = rows.filter(r => !r.isArchived)
  const archivedRows = rows.filter(r => r.isArchived)

  // Si el indicador activo está archivado, abrimos la sección para que el user
  // entienda dónde está. Solo se "fuerza" abierto, no se cierra automáticamente.
  const activeIsArchived = activeId && archivedRows.some(r => r.indicator.id === activeId)
  const archiveSectionOpen = archiveOpen || !!activeIsArchived

  return (
    <>
      <div className="space-y-1">
        {visibleRows.map(({ indicator, cov, isManuallyArchived }) => (
          <Row
            key={indicator.id}
            indicator={indicator}
            cov={cov}
            level={level}
            active={activeId === indicator.id}
            disabled={false}
            isArchived={false}
            canToggleArchive
            isManuallyArchived={isManuallyArchived}
            onActivate={() => selectIndicator(activeId === indicator.id ? null : indicator.id)}
            onArchiveToggle={() => archiveIndicator(indicator.id)}
            onCoverageClick={() => setCoverageModalFor(indicator)}
          />
        ))}
      </div>

      {archivedRows.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2">
          <button
            type="button"
            onClick={() => setArchiveOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-500 transition outline-none hover:text-slate-700 focus:ring-2 focus:ring-slate-400"
            aria-expanded={archiveSectionOpen}
          >
            <span>Archivados · {archivedRows.length}</span>
            <Chevron open={archiveSectionOpen} />
          </button>

          {archiveSectionOpen && (
            <div className="mt-1 space-y-1">
              {archivedRows.map(({ indicator, cov, isManuallyArchived, isAutoArchived }) => (
                <Row
                  key={indicator.id}
                  indicator={indicator}
                  cov={cov}
                  level={level}
                  active={activeId === indicator.id}
                  disabled={isAutoArchived}
                  isArchived
                  canToggleArchive={isManuallyArchived}
                  isManuallyArchived={isManuallyArchived}
                  onActivate={() => {
                    if (isAutoArchived) return
                    selectIndicator(activeId === indicator.id ? null : indicator.id)
                  }}
                  onArchiveToggle={() => unarchiveIndicator(indicator.id)}
                  onCoverageClick={() => setCoverageModalFor(indicator)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {coverageModalFor && (
        <IndicatorCoverageModal
          indicator={coverageModalFor}
          onClose={() => setCoverageModalFor(null)}
        />
      )}
    </>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────

function Row({
  indicator,
  cov,
  level,
  active,
  disabled,
  isArchived,
  canToggleArchive,
  isManuallyArchived: _isManuallyArchived,
  onActivate,
  onArchiveToggle,
  onCoverageClick,
}: {
  indicator: Indicator
  cov: IndicatorCoverage
  level: 'adm0' | 'adm1' | 'adm2'
  active: boolean
  disabled: boolean
  isArchived: boolean
  canToggleArchive: boolean
  isManuallyArchived: boolean
  onActivate: () => void
  onArchiveToggle: () => void
  onCoverageClick: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={active}
      aria-disabled={disabled}
      onClick={onActivate}
      onKeyDown={e => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={`group flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left transition outline-none focus:ring-2 focus:ring-slate-400 ${
        active
          ? 'bg-slate-900 text-white'
          : disabled
            ? 'cursor-not-allowed opacity-40'
            : isArchived
              ? 'cursor-pointer opacity-70 hover:bg-slate-100 hover:opacity-100'
              : 'cursor-pointer hover:bg-slate-100'
      }`}
      title={disabled ? cov.reason : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <div
            className={`text-[14px] font-medium leading-snug tracking-tight ${
              active ? 'text-white' : 'text-slate-800'
            }`}
          >
            {indicator.label}
          </div>
          {cov.applies && cov.missing > 0 && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onCoverageClick()
              }}
              className={`shrink-0 rounded text-[10px] font-semibold tabular-nums transition hover:underline ${
                active ? 'text-rose-200 hover:text-rose-100' : 'text-rose-600 hover:text-rose-700'
              }`}
              title={`Faltan ${cov.missing} de ${cov.total} ${level === 'adm1' ? 'estados' : 'municipios'}. Click para ver cuáles`}
              aria-label={`Ver cobertura (${cov.missing} sin datos)`}
            >
              −{cov.missing}
            </button>
          )}
        </div>
        <div
          className={`mt-0.5 truncate text-[11px] ${
            active ? 'text-slate-300' : 'text-slate-500'
          }`}
        >
          {disabled ? cov.reason : `${indicator.unit} · ${indicator.year}`}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {canToggleArchive && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onArchiveToggle()
            }}
            className={`rounded p-1 opacity-0 transition focus:opacity-100 focus:ring-2 focus:ring-slate-400 group-hover:opacity-100 ${
              active
                ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
            }`}
            title={isArchived ? 'Desarchivar' : 'Archivar'}
            aria-label={isArchived ? `Desarchivar ${indicator.label}` : `Archivar ${indicator.label}`}
          >
            <ArchiveIcon variant={isArchived ? 'out' : 'in'} />
          </button>
        )}
        <span
          aria-hidden
          className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full border ${
            active ? 'border-white bg-white' : 'border-slate-300'
          }`}
        />
      </div>
    </div>
  )
}

function ArchiveIcon({ variant }: { variant: 'in' | 'out' }) {
  // 'in' = archivar (caja con flecha hacia abajo dentro)
  // 'out' = desarchivar (caja con flecha hacia arriba saliendo)
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="3" width="12" height="3" rx="0.5" />
      <path d="M3.5 6v6.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V6" />
      {variant === 'in' ? (
        <path d="M8 8v3m0 0-1.5-1.5M8 11l1.5-1.5" />
      ) : (
        <path d="M8 11V8m0 0-1.5 1.5M8 8l1.5 1.5" />
      )}
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  )
}
