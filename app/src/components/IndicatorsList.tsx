import { useState } from 'react'
import { useStore } from '../store'
import {
  INDICATORS,
  getIndicatorCoverage,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Indicator,
  type IndicatorCategory,
  type IndicatorCoverage,
} from '../data/indicators'
import {
  GLOBAL_REPORTS,
  GLOBAL_CATEGORY_LABELS,
  GLOBAL_CATEGORY_ORDER,
  getGlobalReportByMode,
  type GlobalReport,
  type GlobalReportCategory,
} from '../data/global-reports'
import { IndicatorCoverageModal } from './IndicatorCoverageModal'
import diasporaReceivers from '../data/diaspora-receivers.json'
import type { DiasporaProps } from '../lib/types'

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
  const view = useStore(s => s.view)
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

  // Vista Global: lista de indicadores VE no aplica. Mostramos un panel
  // con el único indicador disponible + sumario por país.
  if (view === 'global') {
    return <DiasporaPanel />
  }

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

  // Agrupar las visibles por categoría. Las que no tienen category caen en
  // 'otros' al final. El orden de las categorías sale de CATEGORY_ORDER.
  const grouped = new Map<IndicatorCategory | 'otros', typeof visibleRows>()
  for (const cat of CATEGORY_ORDER) grouped.set(cat, [])
  grouped.set('otros', [])
  for (const row of visibleRows) {
    const cat = row.indicator.category ?? 'otros'
    grouped.get(cat)!.push(row)
  }
  // Categorías con al menos 1 indicador, en el orden definido.
  const categoriesWithRows = [...CATEGORY_ORDER, 'otros' as const].filter(
    cat => (grouped.get(cat)?.length ?? 0) > 0,
  )

  // Si el indicador activo está archivado, abrimos la sección para que el user
  // entienda dónde está. Solo se "fuerza" abierto, no se cierra automáticamente.
  const activeIsArchived = activeId && archivedRows.some(r => r.indicator.id === activeId)
  const archiveSectionOpen = archiveOpen || !!activeIsArchived

  return (
    <>
      <div className="space-y-3">
        {categoriesWithRows.map(cat => {
          const items = grouped.get(cat) ?? []
          const label = cat === 'otros' ? 'Otros' : CATEGORY_LABELS[cat]
          return (
            <div key={cat}>
              <div className="mb-1 flex items-baseline justify-between px-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {label}
                </span>
                <span className="text-[10px] tabular-nums text-slate-400">
                  {items.length}
                </span>
              </div>
              <div className="space-y-1">
                {items.map(({ indicator, cov, isManuallyArchived }) => (
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
            </div>
          )
        })}
      </div>

      {archivedRows.length > 0 && (
        <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => setArchiveOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-500 dark:text-slate-300 dark:text-slate-400 transition outline-none hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-300 focus:ring-2 focus:ring-slate-400"
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
          ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
          : disabled
            ? 'cursor-not-allowed opacity-40'
            : isArchived
              ? 'cursor-pointer opacity-70 hover:bg-slate-100 dark:hover:bg-slate-800 hover:opacity-100'
              : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
      title={disabled ? cov.reason : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <div
            className={`text-[14px] font-medium leading-snug tracking-tight ${
              active ? 'text-white dark:text-slate-900' : 'text-slate-800 dark:text-slate-200'
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
                : 'text-slate-400 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-700'
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

// ─── Panel de la vista Diáspora ───────────────────────────────────────────
// La vista LATAM tiene un solo "indicador" (migrantes VE recibidos por país).
// En lugar de la lista de indicadores VE, mostramos un sumario con totales y
// breakdown por país receptor.

type DiasporaRecord = {
  name: string
  total: number
  as_of: string
  source: string
  url?: string
  note?: string
}

// Venezolanos viviendo EN Venezuela hoy (residentes). NO confundir con la
// proyección INE 34.9M, que es "cuántos venezolanos habría si nadie hubiera
// emigrado" — esa cifra ya incluye conceptualmente a los 7.1M de diáspora,
// y usarla aquí causaba double-counting (total 42M en vez de ~36M real).
// La cifra correcta para "venezolanos residentes en VE" es UN 2024: ~28.8M.
const VE_VENEZOLANOS_RESIDENTES = 28_800_000

// Población total por país receptor (UN 2024, redondeada). Coincide con
// world-countries.geojson; replicada acá para el cálculo del % sin tener
// que cargar el geojson dos veces.
const POBLACION_TOTAL: Record<string, number> = {
  COL: 52_800_000, PER: 34_000_000, USA: 341_800_000, CHL: 19_800_000,
  ECU: 18_200_000, BRA: 217_600_000, ESP: 48_800_000, ARG: 45_800_000,
  PAN: 4_600_000, DOM: 11_400_000, MEX: 130_000_000, URY: 3_400_000,
  PRY: 6_900_000, BOL: 12_400_000, CRI: 5_300_000, TTO: 1_500_000,
  GUY: 800_000, ARU: 110_000, CUB: 11_200_000,
}

function DiasporaPanel() {
  const setSelected = useStore(s => s.setSelected)
  const globalMetric = useStore(s => s.globalMetric)
  const setGlobalMetric = useStore(s => s.setGlobalMetric)
  const diaspora = useStore(s => s.diaspora)
  const data = diasporaReceivers as Record<string, DiasporaRecord>
  const activeReport = getGlobalReportByMode(globalMetric)

  // Construye la lista según el modo activo. Cada entry trae un valor
  // numérico ya en la unidad correcta (personas, USD, IDH 0..1, %) y un
  // formatter por modo en formatValue() decide el render. Eso desacopla
  // el rendering del modo.
  //
  // Hay dos fuentes:
  //   - Modos diáspora (migrantes/venezolanos/porcentaje): usan
  //     diasporaReceivers (lista de 19 países receptores) + VE_VENEZOLANOS_RESIDENTES
  //     + POBLACION_TOTAL. Datos curados específicos para esta vista.
  //   - Modos comparativos (poblacion/pib_pc/idh): leen world-indicators.json
  //     mergeado en `diaspora.features[].properties` por el store. Cobertura
  //     de ~170 países, lo que llena toda la lista del panel.
  type Entry = { iso: string; name: string; value: number; source: string }
  let entries: Entry[]
  let unit: '' | '%' | 'M' | 'USD' | 'IDH'
  let header: { label: string; sub: string; total: string | null }

  if (globalMetric === 'migrantes') {
    entries = Object.entries(data)
      .map(([iso, r]) => ({ iso, name: r.name, value: r.total, source: r.source }))
      .sort((a, b) => b.value - a.value)
    const sum = entries.reduce((acc, e) => acc + e.value, 0)
    unit = 'M'
    header = {
      label: 'Migrantes venezolanos · 2022–2025',
      sub: `en ${entries.length} países · R4V regional estima 6.7 M · ACNUR global 7.9 M`,
      total: `${(sum / 1_000_000).toFixed(1)} M`,
    }
  } else if (globalMetric === 'venezolanos') {
    // Total de venezolanos en el mundo: residentes en VE + diáspora.
    // Suma realista ~35.9M, NO los 42M que daba antes (double-counting con
    // la proyección INE 34.9M, que ya incluía conceptualmente a los emigrados).
    entries = [
      { iso: 'VEN', name: 'Venezuela (origen)', value: VE_VENEZOLANOS_RESIDENTES, source: 'UN World Population Prospects 2024' },
      ...Object.entries(data).map(([iso, r]) => ({ iso, name: r.name, value: r.total, source: r.source })),
    ].sort((a, b) => b.value - a.value)
    const sum = entries.reduce((acc, e) => acc + e.value, 0)
    unit = 'M'
    const diasporaM = (sum - VE_VENEZOLANOS_RESIDENTES) / 1_000_000
    header = {
      label: 'Venezolanos en el mundo',
      sub: `${entries.length} países · ${(VE_VENEZOLANOS_RESIDENTES / 1_000_000).toFixed(1)} M en VE + ${diasporaM.toFixed(1)} M en el exterior`,
      total: `${(sum / 1_000_000).toFixed(1)} M`,
    }
  } else if (globalMetric === 'porcentaje') {
    // porcentaje = venezolanos / población total del país × 100.
    // Para VE es 100% por definición: los venezolanos viviendo en VE son los
    // 28.8M residentes; la población total de VE son los mismos 28.8M.
    entries = [
      {
        iso: 'VEN',
        name: 'Venezuela (origen)',
        value: 100,
        source: 'residentes venezolanos / población total VE',
      },
      ...Object.entries(data)
        .filter(([iso]) => POBLACION_TOTAL[iso] != null)
        .map(([iso, r]) => ({
          iso,
          name: r.name,
          value: (r.total / POBLACION_TOTAL[iso]) * 100,
          source: r.source,
        })),
    ].sort((a, b) => b.value - a.value)
    unit = '%'
    header = {
      label: 'Venezolanos sobre población local',
      sub: 'porcentaje de residentes venezolanos en cada país',
      total: entries[0] ? `${entries[0].value.toFixed(1)}%` : null,
    }
  } else {
    // Modos comparativos: leen del geojson (cargado con merge desde
    // world-indicators.json). Si el geojson aún no cargó, lista vacía
    // y el panel muestra "Cargando" via el header.
    const fieldFor = (p: DiasporaProps): number | null | undefined =>
      globalMetric === 'poblacion'
        ? p.poblacion_total
        : globalMetric === 'pib_pc'
          ? p.pib_per_capita_usd
          : globalMetric === 'idh'
            ? p.idh
            : null
    const sourceLabel = activeReport?.source ?? ''
    entries = (diaspora?.features ?? [])
      .map(f => {
        const p = f.properties as DiasporaProps
        const v = fieldFor(p)
        return { iso: p.iso_a3, name: p.name, value: v ?? NaN, source: sourceLabel }
      })
      .filter(e => Number.isFinite(e.value))
      .sort((a, b) => b.value - a.value)

    if (globalMetric === 'poblacion') {
      const sum = entries.reduce((acc, e) => acc + e.value, 0)
      unit = 'M'
      header = {
        label: 'Población mundial',
        sub: `${entries.length} países · ONU World Population Prospects 2024`,
        total: `${(sum / 1_000_000_000).toFixed(2)} mil M`,
      }
    } else if (globalMetric === 'pib_pc') {
      unit = 'USD'
      header = {
        label: 'PIB per cápita',
        sub: `${entries.length} países · Banco Mundial 2023 · USD nominal`,
        total: entries[0]
          ? `$${entries[0].value.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
          : null,
      }
    } else {
      // idh
      unit = 'IDH'
      header = {
        label: 'Índice de Desarrollo Humano',
        sub: `${entries.length} países · PNUD HDR 2023/2024 · rango 0 a 1`,
        total: entries[0] ? entries[0].value.toFixed(3) : null,
      }
    }
  }

  const max = entries[0]?.value ?? 1

  // Reportes globales agrupados por categoría. Mismo patrón que la lista
  // de Indicators VE: header con label + contador, items clickeables, sólo
  // se renderean categorías con al menos 1 reporte. Soporta crecer a muchas
  // categorías (demografía mundial, IDH PNUD, etc.) sin cambiar la UI.
  const groupedReports = new Map<GlobalReportCategory, GlobalReport[]>()
  for (const cat of GLOBAL_CATEGORY_ORDER) groupedReports.set(cat, [])
  for (const r of GLOBAL_REPORTS) groupedReports.get(r.category)?.push(r)
  const categoriesWithReports = GLOBAL_CATEGORY_ORDER.filter(
    cat => (groupedReports.get(cat)?.length ?? 0) > 0,
  )

  // Formato del valor mostrado en cada fila + en el modal "selected".
  // Cada modo tiene su unidad propia y nivel de precisión:
  //   migrantes/venezolanos/poblacion → entero con separador de miles
  //   porcentaje → 2 decimales + %
  //   pib_pc → "$X.XXX USD" con separador de miles
  //   idh → 3 decimales (rango 0..1 necesita precisión)
  function formatValue(value: number): string {
    if (unit === '%') return `${value.toFixed(2)}%`
    if (unit === 'USD') return `$${value.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
    if (unit === 'IDH') return value.toFixed(3)
    // M (millones de personas): valor entero, separador de miles.
    return value.toLocaleString('es-VE', { maximumFractionDigits: 0 })
  }

  return (
    <div className="space-y-4">
      {/* Lista de reportes agrupada por categoría */}
      <div className="space-y-3">
        {categoriesWithReports.map(cat => {
          const items = groupedReports.get(cat) ?? []
          return (
            <div key={cat}>
              <div className="mb-1 flex items-baseline justify-between px-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {GLOBAL_CATEGORY_LABELS[cat]}
                </span>
                <span className="text-[10px] tabular-nums text-slate-400">
                  {items.length}
                </span>
              </div>
              <div className="space-y-1">
                {items.map(report => {
                  const isActive = activeReport?.id === report.id
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setGlobalMetric(report.mode)}
                      className={`group flex w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left transition outline-none focus:ring-2 focus:ring-slate-400 ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[13px] font-medium leading-tight ${
                            isActive ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {report.label}
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[10px] ${
                            isActive ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {report.year} · {report.source}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {header.label}
        </div>
        <div className="mt-0.5 text-[22px] font-semibold tabular-nums tracking-tight text-slate-900">
          {header.total ?? '—'}
          {entries[0] && (unit === '%' || unit === 'USD' || unit === 'IDH') && (
            <span className="ml-1.5 text-[11px] font-normal text-slate-400">
              máx · {entries[0].name.replace(' (origen)', '')}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
          {header.sub}
        </div>
      </div>

      <div className="space-y-0.5">
        {entries.map(r => (
          <button
            key={r.iso}
            type="button"
            onClick={() => setSelected({ name: r.name, iso: r.iso, value: r.value })}
            className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition outline-none hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-2 focus:ring-slate-400"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">{r.name}</span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatValue(r.value)}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }}
                />
              </div>
              <div className="mt-1 truncate text-[10px] text-slate-400">
                {r.source}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        {globalMetric === 'porcentaje' && (
          <>
            Porcentaje calculado sobre población total del país (UN 2024).
            La diáspora venezolana es más densa donde el país receptor es
            más chico (Panamá, Trinidad), no donde más migrantes recibió.
          </>
        )}
        {(globalMetric === 'migrantes' || globalMetric === 'venezolanos') && (
          <>
            Cifras oficiales de gobiernos receptores agregadas por R4V
            (coordinada por OIM + ACNUR). Subestiman porque no contemplan
            migrantes en situación irregular.{' '}
            <a
              href="https://www.r4v.info/en/refugeeandmigrants"
              target="_blank"
              rel="noreferrer"
              className="text-slate-700 dark:text-slate-300 underline hover:text-slate-900"
            >
              R4V
            </a>
          </>
        )}
        {globalMetric === 'poblacion' && (
          <>
            Población estimada total por país. Fuente: ONU{' '}
            <a
              href="https://population.un.org/wpp/"
              target="_blank"
              rel="noreferrer"
              className="text-slate-700 dark:text-slate-300 underline hover:text-slate-900"
            >
              World Population Prospects 2024
            </a>
            . Cifras redondeadas.
          </>
        )}
        {globalMetric === 'pib_pc' && (
          <>
            PIB nominal per cápita en USD corrientes. Fuente:{' '}
            <a
              href="https://data.worldbank.org/indicator/NY.GDP.PCAP.CD"
              target="_blank"
              rel="noreferrer"
              className="text-slate-700 dark:text-slate-300 underline hover:text-slate-900"
            >
              Banco Mundial WDI
            </a>
            . Venezuela: estimación FMI (BM no publica desde 2014).
          </>
        )}
        {globalMetric === 'idh' && (
          <>
            IDH combina esperanza de vida, años de escolaridad e ingreso
            per cápita (PPP). Rango 0 a 1. Fuente:{' '}
            <a
              href="https://hdr.undp.org/data-center/country-insights"
              target="_blank"
              rel="noreferrer"
              className="text-slate-700 dark:text-slate-300 underline hover:text-slate-900"
            >
              PNUD HDR 2023/2024
            </a>
            .
          </>
        )}
      </div>
    </div>
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
