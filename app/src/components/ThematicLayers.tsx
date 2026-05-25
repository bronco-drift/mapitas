import { useState } from 'react'
import { useStore } from '../store'
import type { ThematicMeta, ThematicOverride } from '../store'

// Lista de capas temáticas con tweakers expandibles por capa.
// Cada fila tiene:
//   - Toggle de visibilidad (clic en el cuerpo)
//   - Chevron para expandir → controles de estilo
//   - Cuando la capa está expandida, aparecen color, opacidad, weight,
//     dashed (sólo líneas), y si tiene labels permanentes, controles de
//     tipografía (negrita/itálica, tamaño, fuente, alineación, color,
//     fondo + opacidad).

export function ThematicLayersList() {
  const thematic = useStore(s => s.thematic)
  const toggleThematic = useStore(s => s.toggleThematic)
  const overrides = useStore(s => s.thematicOverrides)
  const setOverride = useStore(s => s.setThematicOverride)
  const resetOverride = useStore(s => s.resetThematicOverride)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const entries = Object.values(thematic)
  if (entries.length === 0) {
    return <div className="text-[11px] italic text-slate-400">Cargando catálogo…</div>
  }

  return (
    <div className="space-y-1">
      {entries.map(entry => {
        const { meta, enabled, loading } = entry
        const ov = overrides[meta.id] ?? {}
        const expanded = expandedId === meta.id
        const isLine =
          meta.geometryType === 'LineString' || meta.geometryType === 'MultiLineString'
        const isPoint = meta.geometryType === 'Point' || meta.geometryType === 'MultiPoint'
        const hasLabels = meta.permanentLabels === true
        const effectiveColor = ov.color ?? meta.color
        const hasOverride = Object.keys(ov).length > 0

        return (
          <div
            key={meta.id}
            className={`rounded-md transition-colors ${
              enabled || expanded ? 'bg-slate-50' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-stretch gap-1 px-1">
              <button
                type="button"
                onClick={() => toggleThematic(meta.id)}
                disabled={loading}
                className="flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-300"
                  style={{ background: enabled ? effectiveColor : 'transparent' }}
                />
                <span className="min-w-0 flex-1">
                  <div className={`truncate ${enabled ? 'text-slate-900' : 'text-slate-700'}`}>
                    {meta.label}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {meta.featureCount} · {meta.sizeKB} KB
                    {hasOverride && <span className="ml-1 text-slate-500">· editado</span>}
                  </div>
                </span>
                <span className="text-[10px] text-slate-400">
                  {loading ? '…' : enabled ? 'on' : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : meta.id)}
                aria-label={expanded ? 'Cerrar ajustes' : 'Abrir ajustes'}
                aria-expanded={expanded}
                className="flex w-7 shrink-0 items-center justify-center rounded-md text-slate-400 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                title={expanded ? 'Cerrar ajustes' : 'Ajustar capa'}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
                  aria-hidden
                >
                  <path d="M4 3l4 3-4 3" />
                </svg>
              </button>
            </div>

            {expanded && (
              <div className="space-y-3 border-t border-slate-200/70 px-3 py-2.5">
                <SectionLabel>Forma</SectionLabel>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
                  <Label>Color</Label>
                  <input
                    type="color"
                    value={effectiveColor}
                    onChange={e => setOverride(meta.id, { color: e.target.value })}
                    className="h-6 w-9 cursor-pointer rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-0"
                    aria-label="Color de la capa"
                  />

                  {!isLine && (
                    <>
                      <Label>Relleno</Label>
                      <Slider
                        value={ov.fillOpacity ?? 0.28}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={v => setOverride(meta.id, { fillOpacity: v })}
                        format={v => `${Math.round(v * 100)}%`}
                      />
                    </>
                  )}

                  <Label>{isLine ? 'Opacidad' : 'Borde'}</Label>
                  <Slider
                    value={ov.opacity ?? (isLine ? 0.85 : 0.8)}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={v => setOverride(meta.id, { opacity: v })}
                    format={v => `${Math.round(v * 100)}%`}
                  />

                  <Label>Grosor</Label>
                  <Slider
                    value={ov.weight ?? meta.weight ?? (isLine ? 1 : isPoint ? 1 : 0.8)}
                    min={0}
                    max={6}
                    step={0.1}
                    onChange={v => setOverride(meta.id, { weight: v })}
                    format={v => `${v.toFixed(1)}px`}
                  />

                  {isLine && (
                    <>
                      <Label>Punteada</Label>
                      <ToggleInline
                        checked={ov.dashed ?? meta.dashed ?? false}
                        onChange={v => setOverride(meta.id, { dashed: v })}
                      />
                    </>
                  )}
                </div>

                {hasLabels && <LabelTweaks meta={meta} ov={ov} setOverride={setOverride} />}

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => resetOverride(meta.id)}
                    disabled={!hasOverride}
                    className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-400 transition-colors enabled:hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-300 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Restaurar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Subcomponentes locales ──────────────────────────────────────────────

function LabelTweaks({
  meta: _meta,
  ov,
  setOverride,
}: {
  meta: ThematicMeta
  ov: ThematicOverride
  setOverride: (id: string, patch: Partial<ThematicOverride>) => void
}) {
  return (
    <>
      <SectionLabel>Texto</SectionLabel>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
        <Label>Estilo</Label>
        <div className="flex gap-1">
          <PillToggle
            label="B"
            bold
            active={ov.labelBold !== false}
            onClick={() => setOverride(_meta.id, { labelBold: ov.labelBold === false })}
            title="Negrita"
          />
          <PillToggle
            label="I"
            italic
            active={!!ov.labelItalic}
            onClick={() => setOverride(_meta.id, { labelItalic: !ov.labelItalic })}
            title="Itálica"
          />
        </div>

        <Label>Fuente</Label>
        <select
          value={ov.labelFontFamily ?? 'sans'}
          onChange={e =>
            setOverride(_meta.id, {
              labelFontFamily: e.target.value as 'sans' | 'serif' | 'mono',
            })
          }
          className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-800 dark:text-slate-200 focus:border-slate-900 focus:outline-none"
        >
          <option value="sans">Sans-serif</option>
          <option value="serif">Serif</option>
          <option value="mono">Monoespaciada</option>
        </select>

        <Label>Tamaño</Label>
        <Slider
          value={ov.labelFontSize ?? 11}
          min={8}
          max={22}
          step={1}
          onChange={v => setOverride(_meta.id, { labelFontSize: v })}
          format={v => `${v}px`}
        />

        <Label>Alineación</Label>
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map(a => (
            <PillToggle
              key={a}
              label={a === 'left' ? '⟸' : a === 'center' ? '☰' : '⟹'}
              active={(ov.labelAlign ?? 'left') === a}
              onClick={() => setOverride(_meta.id, { labelAlign: a })}
              title={a === 'left' ? 'Izquierda' : a === 'center' ? 'Centro' : 'Derecha'}
            />
          ))}
        </div>

        <Label>Color</Label>
        <input
          type="color"
          value={ov.labelColor ?? '#0f172a'}
          onChange={e => setOverride(_meta.id, { labelColor: e.target.value })}
          className="h-6 w-9 cursor-pointer rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-0"
          aria-label="Color del texto"
        />

        <Label>Fondo</Label>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={ov.labelBg && ov.labelBg.length > 0 ? ov.labelBg : '#ffffff'}
            onChange={e => setOverride(_meta.id, { labelBg: e.target.value })}
            className="h-6 w-9 cursor-pointer rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-0"
            aria-label="Color del fondo"
          />
          <button
            type="button"
            onClick={() => setOverride(_meta.id, { labelBg: '' })}
            className="rounded border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-300 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-slate-700"
            title="Sin fondo"
          >
            Sin
          </button>
        </div>

        {ov.labelBg && ov.labelBg.length > 0 && (
          <>
            <Label>Opacidad bg</Label>
            <Slider
              value={ov.labelBgOpacity ?? 0.92}
              min={0}
              max={1}
              step={0.05}
              onChange={v => setOverride(_meta.id, { labelBgOpacity: v })}
              format={v => `${Math.round(v * 100)}%`}
            />
          </>
        )}
      </div>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-slate-600">{children}</span>
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="min-w-0 flex-1 accent-slate-900"
      />
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-slate-500">
        {format ? format(value) : value}
      </span>
    </div>
  )
}

function ToggleInline({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
        checked ? 'bg-slate-900' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white dark:bg-slate-900 shadow transition ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function PillToggle({
  label,
  active,
  onClick,
  bold,
  italic,
  title,
}: {
  label: string
  active: boolean
  onClick: () => void
  bold?: boolean
  italic?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`flex h-6 min-w-[26px] items-center justify-center rounded border px-1.5 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 dark:text-slate-400 hover:border-slate-400'
      }`}
      style={{
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? 'italic' : 'normal',
      }}
    >
      {label}
    </button>
  )
}
