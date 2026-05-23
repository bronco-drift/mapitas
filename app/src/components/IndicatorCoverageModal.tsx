import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { getIndicatorCoverage, type Indicator } from '../data/indicators'
import type { Adm1Props, Adm2Props } from '../lib/types'

// Modal que se abre al hacer click en el badge "−NN" rojo de un indicador.
// Muestra info del indicador + lista de entidades sin data agrupadas por
// estado (cuando son munis) o tal cual (cuando son estados).

export function IndicatorCoverageModal({
  indicator,
  onClose,
}: {
  indicator: Indicator
  onClose: () => void
}) {
  const level = useStore(s => s.level)
  const adm1 = useStore(s => s.adm1)
  const adm2 = useStore(s => s.adm2)

  const totals = {
    adm1Count: adm1?.features.length ?? 26,
    adm2Count: adm2?.features.length ?? 336,
  }
  const cov = getIndicatorCoverage(indicator, level, totals)
  const entityLabel = level === 'adm1' ? 'estados' : 'municipios'

  // Set de ids con data — sirve para detectar faltantes por exclusión
  const dataIds = useMemo(() => {
    if (indicator.aggregation === 'state') {
      // En adm1, indicator.data keyed por ISO
      // En adm2, no aplica (no se debería abrir modal sobre state-level en adm2)
      return new Set(Object.keys(indicator.data))
    }
    // municipality
    if (level === 'adm1') {
      return new Set(Object.keys(indicator.stateAggregate ?? {}))
    }
    return new Set(Object.keys(indicator.data))
  }, [indicator, level])

  // Lista de entidades sin data, agrupadas por estado (cuando son munis)
  const missingByGroup = useMemo(() => {
    if (level === 'adm0') return new Map<string, string[]>()
    if (level === 'adm1') {
      // Una sola "categoría" (todos los estados)
      const out = new Map<string, string[]>()
      const list: string[] = []
      for (const f of adm1?.features ?? []) {
        const p = f.properties as Adm1Props
        if (!dataIds.has(p.iso)) list.push(p.name)
      }
      list.sort((a, b) => a.localeCompare(b))
      if (list.length) out.set('Estados sin data', list)
      return out
    }
    // adm2 — agrupado por estado padre
    const grouped = new Map<string, string[]>()
    for (const f of adm2?.features ?? []) {
      const p = f.properties as Adm2Props
      if (!dataIds.has(p.sourceID)) {
        const state = p.parentState ?? '(sin estado)'
        const arr = grouped.get(state) ?? []
        arr.push(p.name)
        grouped.set(state, arr)
      }
    }
    // Sort dentro de cada grupo y entre grupos
    const sorted = new Map<string, string[]>()
    for (const state of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
      sorted.set(state, grouped.get(state)!.sort((a, b) => a.localeCompare(b)))
    }
    return sorted
  }, [adm1, adm2, dataIds, level])

  // Cerrar con Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cov-modal-title"
    >
      <div
        className="modal-content relative max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header pegajoso */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div id="cov-modal-title" className="truncate text-[17px] font-semibold leading-tight tracking-tight text-slate-900">
              {indicator.label}
            </div>
            <div className="mt-1 text-[12px] tabular-nums text-slate-500">
              <span className="text-slate-800">{cov.covered}</span>
              <span className="text-slate-400"> de {cov.total} </span>
              <span>{entityLabel} con datos</span>
              {cov.missing > 0 && (
                <span className="ml-1.5 font-medium text-rose-600">· {cov.missing} sin datos</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="max-h-[calc(80vh-70px)] overflow-y-auto px-5 py-4">
          {/* Info del indicador */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px] text-slate-600">
            <dt className="text-slate-400">Fuente</dt>
            <dd>{indicator.source}</dd>
            <dt className="text-slate-400">Año</dt>
            <dd>{indicator.year}</dd>
            <dt className="text-slate-400">Unidad</dt>
            <dd>{indicator.unit}</dd>
            <dt className="text-slate-400">Nivel</dt>
            <dd>{indicator.aggregation === 'state' ? 'Estatal' : 'Municipal'}</dd>
          </dl>
          {indicator.description && (
            <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
              {indicator.description}
            </p>
          )}
          {indicator.note && (
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800">
              {indicator.note}
            </p>
          )}

          {/* Lista de faltantes */}
          {cov.missing > 0 && missingByGroup.size > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                Sin datos
              </div>
              <div className="space-y-3">
                {[...missingByGroup.entries()].map(([group, items]) => (
                  <div key={group}>
                    <div className="text-[11px] font-semibold text-slate-700">
                      {group}
                      <span className="ml-1 font-normal text-slate-400">({items.length})</span>
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {items.join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
