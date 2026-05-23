import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { BASEMAPS } from '../lib/basemaps'
import { GLOBE_THEMES } from '../lib/globe-themes'

// Organización del tab Estilo en 3 disclosures colapsables, jerarquía clara:
//   Color   (Fondo, Borde)              — siempre visible arriba
//   Mapa base                            — disclosure
//   Polígonos                            — disclosure (sin bordes, opacidades, grosor, contornos)
//   Vista                                — disclosure (modos especiales: aislar, transparente)

export function StyleControls() {
  const style = useStore(s => s.mapStyle)
  const setMapStyle = useStore(s => s.setMapStyle)
  const level = useStore(s => s.level)
  const view = useStore(s => s.view)
  const isGlobal = view === 'global'

  return (
    <div className="space-y-3">
      {/* Color (Fondo + Borde) — siempre visible, son los más tocados */}
      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="Fondo"
          value={style.bgColor}
          onChange={v => setMapStyle({ bgColor: v })}
          hint={style.basemap === 'solid' ? 'Color del mapa base sólido' : 'Visible cuando no hay tiles'}
        />
        <ColorField
          label="Borde"
          value={style.borderColor}
          onChange={v => setMapStyle({ borderColor: v })}
          hint="Color de los bordes de los polígonos"
        />
      </div>

      {/* Mapa base / Tema del globo — disclosure default colapsado.
          En vista VE muestra los basemaps de Leaflet con tiles.
          En vista Global muestra los temas visuales del globo (que reemplazan
          al espacio + sphere + países sin data con un set coherente). */}
      <Disclosure title={isGlobal ? 'Tema del globo' : 'Mapa base'}>
        {isGlobal ? (
          <div className="grid grid-cols-3 gap-1">
            {GLOBE_THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMapStyle({ globeTheme: t.id })}
                title={t.label}
                aria-label={t.label}
                className={`group flex flex-col items-stretch overflow-hidden rounded-sm border text-[10px] transition ${
                  style.globeTheme === t.id
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <span className="block h-5" style={{ background: t.preview }} />
                <span
                  className={`block px-1 py-0.5 text-center ${
                    style.globeTheme === t.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  {t.short}
                </span>
              </button>
            ))}
          </div>
        ) : (
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
                <span
                  className="block h-5"
                  style={{ background: b.id === 'solid' ? style.bgColor : b.preview }}
                />
                <span
                  className={`block px-1 py-0.5 text-center ${
                    style.basemap === b.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  {b.short}
                </span>
              </button>
            ))}
          </div>
        )}
        {!isGlobal && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <Toggle
              label="Etiquetas"
              hint="Mostrar nombres de ciudades sobre el mapa"
              checked={style.showLabels}
              onChange={v => setMapStyle({ showLabels: v })}
            />
          </div>
        )}
      </Disclosure>

      {/* Polígonos — disclosure default expandido (lo más usado después de Color) */}
      <Disclosure title="Polígonos" defaultOpen>
        <div className="space-y-3">
          <Toggle
            label="Sin bordes"
            hint="Oculta los bordes internos"
            checked={style.noBorders}
            onChange={v => setMapStyle({ noBorders: v })}
          />

          <Toggle
            label="Borde de país"
            hint="Contorno del país en grosor fino"
            checked={style.countryBorder}
            onChange={v => setMapStyle({ countryBorder: v })}
          />

          {level === 'adm2' && (
            <Toggle
              label="Bordes de estados arriba"
              hint="Resalta jerarquía estado/municipio"
              checked={style.stateOverlayInMuni}
              onChange={v => setMapStyle({ stateOverlayInMuni: v })}
            />
          )}

          <div className={style.noBorders ? 'pointer-events-none opacity-40' : ''}>
            <div className="mb-1.5 flex items-baseline justify-between text-[10px] font-medium uppercase tracking-wider text-slate-500">
              <span>Grosor borde</span>
              <span className="font-normal text-slate-400">{style.lineWidth.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={style.lineWidth}
              disabled={style.noBorders}
              onChange={e => setMapStyle({ lineWidth: parseFloat(e.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>

          {/* Opacidad de relleno: SIEMPRE editable. En modo noBorders su valor
              también atenúa el stroke (mismo color del fill) para que todo el
              polígono se mueva junto. */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[10px] font-medium uppercase tracking-wider text-slate-500">
              <span>Opacidad relleno</span>
              <span className="font-normal text-slate-400">
                {`${Math.round(style.fillOpacity * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={style.fillOpacity}
              onChange={e => setMapStyle({ fillOpacity: parseFloat(e.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>

          <div className={style.noBorders ? 'pointer-events-none opacity-40' : ''}>
            <div className="mb-1.5 flex items-baseline justify-between text-[10px] font-medium uppercase tracking-wider text-slate-500">
              <span>Opacidad borde</span>
              <span className="font-normal text-slate-400">
                {style.noBorders ? '100%' : `${Math.round(style.borderOpacity * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={style.noBorders ? 1 : style.borderOpacity}
              disabled={style.noBorders}
              onChange={e => setMapStyle({ borderOpacity: parseFloat(e.target.value) })}
              className="w-full accent-slate-900"
            />
          </div>
        </div>
      </Disclosure>

      {/* Vista — modos especiales, default colapsado */}
      <Disclosure title="Vista">
        <div className="space-y-3">
          <Toggle
            label="Aislar país"
            hint="Oculta el mapa base, deja solo el país"
            checked={style.isolateCountry}
            onChange={v => setMapStyle({ isolateCountry: v })}
          />
          <Toggle
            label="Fondo transparente"
            hint="Sin color de fondo, útil para exportar"
            checked={style.transparentBg}
            onChange={v => setMapStyle({ transparentBg: v })}
          />
        </div>
      </Disclosure>
    </div>
  )
}

// Disclosure simple con estado local. Usamos <details>/<summary> nativos para
// accesibilidad gratis (Enter/Space, screen readers), con estilos custom.
function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      open={open}
      onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="group rounded-md border border-slate-100"
    >
      <summary className="group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 marker:hidden">
        <span>{title}</span>
        <svg
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-700 ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-2.5 pb-2.5 pt-1">{children}</div>
    </details>
  )
}

function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <label className="flex items-center gap-2" title={hint}>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0"
        aria-label={label}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="truncate font-mono text-[10px] text-slate-400">{value.toUpperCase()}</div>
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
