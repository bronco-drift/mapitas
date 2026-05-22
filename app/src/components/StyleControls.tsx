import { useStore } from '../store'
import { BASEMAPS } from '../lib/basemaps'

export function StyleControls() {
  const style = useStore(s => s.mapStyle)
  const setMapStyle = useStore(s => s.setMapStyle)
  const level = useStore(s => s.level)

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Mapa base
        </div>
        <div className="grid grid-cols-3 gap-1">
          {BASEMAPS.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => setMapStyle({ basemap: b.id })}
              disabled={style.isolateCountry}
              title={b.label}
              aria-label={b.label}
              className={`group flex flex-col items-stretch overflow-hidden rounded-sm border text-[10px] transition ${
                style.basemap === b.id
                  ? 'border-slate-900 ring-1 ring-slate-900'
                  : 'border-slate-200 hover:border-slate-400'
              } ${style.isolateCountry ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <span className="block h-5" style={{ background: b.preview }} />
              <span className={`block px-1 py-0.5 text-center ${
                style.basemap === b.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
              }`}>
                {b.short}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-[10px] font-medium uppercase tracking-wider text-slate-500">
          <span>Grosor borde</span>
          <span className="font-normal text-slate-400">{style.lineWidth.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0.3}
          max={3}
          step={0.1}
          value={style.lineWidth}
          onChange={e => setMapStyle({ lineWidth: parseFloat(e.target.value) })}
          className="w-full accent-slate-900"
        />
      </div>

      <div className="flex items-center gap-3">
        <ColorField
          label="Borde"
          value={style.borderColor}
          onChange={v => setMapStyle({ borderColor: v })}
        />
        <ColorField
          label="Fondo"
          value={style.bgColor}
          onChange={v => setMapStyle({ bgColor: v })}
        />
      </div>

      <Toggle
        label="Aislar país"
        hint="Oculta basemap, deja solo el país"
        checked={style.isolateCountry}
        onChange={v => setMapStyle({ isolateCountry: v })}
      />

      {level === 'adm2' && (
        <Toggle
          label="Bordes de estados arriba"
          hint="Resalta jerarquía estado / municipio"
          checked={style.stateOverlayInMuni}
          onChange={v => setMapStyle({ stateOverlayInMuni: v })}
        />
      )}
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-1 items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-white p-0"
        aria-label={label}
      />
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="font-mono text-[10px] text-slate-400">{value.toUpperCase()}</div>
      </div>
    </label>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[12px] text-slate-800">{label}</div>
        {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-slate-900' : 'bg-slate-200'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
