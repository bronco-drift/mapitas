import { useStore } from '../store'
import { REGIONS, type RegionId } from '../lib/regions'

type Country = {
  code: string
  name: string
  flag: string
  enabled: boolean
}

// Países disponibles a nivel ADM1/ADM2 (vista propia). Hoy solo VE — el
// resto está como "próximamente" porque requiere descargar y procesar sus
// geojsons. Las regiones (Mundo, Latam, etc.) viven en REGIONS y van al
// principio del dropdown porque son lo más probable que el user use.
const COUNTRIES: Country[] = [
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', enabled: true },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', enabled: false },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', enabled: false },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', enabled: false },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', enabled: false },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', enabled: false },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', enabled: false },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', enabled: false },
  { code: 'DO', name: 'República Dominicana', flag: '🇩🇴', enabled: false },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', enabled: false },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', enabled: false },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', enabled: false },
  { code: 'MX', name: 'México', flag: '🇲🇽', enabled: false },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', enabled: false },
  { code: 'PA', name: 'Panamá', flag: '🇵🇦', enabled: false },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', enabled: false },
  { code: 'PE', name: 'Perú', flag: '🇵🇪', enabled: false },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', enabled: false },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', enabled: false },
]

export function TopBar() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const globalRegion = useStore(s => s.globalRegion)
  const setGlobalRegion = useStore(s => s.setGlobalRegion)
  const paintModeActive = useStore(s => s.paintModeActive)
  const setPaintMode = useStore(s => s.setPaintMode)
  const colorScheme = useStore(s => s.colorScheme)
  const setColorScheme = useStore(s => s.setColorScheme)

  // Toggle cíclico: light → dark → system → light. El ícono refleja el
  // estado actual; el title explica qué pasa al click siguiente. Cycle
  // es más compacto que segmented control en TopBar, y como hay solo 3
  // estados, el descubrimiento via title es aceptable.
  function cycleColorScheme() {
    const next = colorScheme === 'light' ? 'dark' : colorScheme === 'dark' ? 'system' : 'light'
    setColorScheme(next)
  }
  const nextSchemeLabel =
    colorScheme === 'light' ? 'oscuro' : colorScheme === 'dark' ? 'sistema' : 'claro'
  // El value del select tiene 2 formatos:
  //   region:<id>   ej "region:latam"  → view='global' + esa región
  //   country:<iso> ej "country:VE"    → view='venezuela' (solo VE habilitado)
  // Permite mezclar regiones y países en un solo dropdown con <optgroup>.
  const currentValue =
    view === 'global'
      ? `region:${globalRegion}`
      : view === 'region_test'
        ? `region_test:${globalRegion}`
        : `country:VE`
  // (Antes mostrábamos currentLabel acá al lado del dropdown, pero era
  // redundante: el dropdown ya muestra la vista activa. Conservamos sólo el
  // badge BETA para vista Global / Test Leaflet.)
  const isDibujando = paintModeActive

  function handleChange(value: string) {
    const [kind, id] = value.split(':')
    if (kind === 'region') {
      setGlobalRegion(id as RegionId)
      if (view !== 'global') setView('global')
    } else if (kind === 'region_test') {
      // Test Leaflet de cualquier región. Setea la región Y cambia view.
      setGlobalRegion(id as RegionId)
      if (view !== 'region_test') setView('region_test')
    } else if (kind === 'country') {
      if (id === 'VE') {
        if (view !== 'venezuela') setView('venezuela')
      }
      // otros países están disabled, no llegan acá
    }
  }

  return (
    <div
      // Safe area top: en iOS con notch, sin esto el TopBar queda parcialmente
      // tapado por el área del notch/Dynamic Island. env(safe-area-inset-top)
      // devuelve 47px en iPhone 14 Pro, 0 en desktop/Android sin notch.
      // px-3/md:px-4 también heredan safe-area-inset horizontal para landscape.
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
      }}
      className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white md:gap-3 dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex h-11 w-full items-center gap-2 md:h-12 md:gap-3">
      <a
        href="#/"
        className="flex items-center gap-1.5 text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        aria-label="Volver al inicio"
        title="Inicio"
      >
        <svg className="h-5 w-5" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="lg-topbar" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="#0f172a" />
          <path
            d="M14 48 V16 H22 L32 32 L42 16 H50 V48 H42 V28 L34 40 H30 L22 28 V48 Z"
            fill="url(#lg-topbar)"
          />
        </svg>
        <span className="hidden text-[13px] font-semibold tracking-tight md:inline">Mapitas</span>
      </a>
      <span className="hidden h-4 w-px bg-slate-200 sm:inline-block dark:bg-slate-700" aria-hidden="true" />
      <div className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:block dark:text-slate-400">
        Vista
      </div>
      <div className="relative">
        <select
          value={currentValue}
          onChange={e => handleChange(e.target.value)}
          className="appearance-none rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-[12px] text-slate-800 focus:border-slate-900 focus:outline-none md:pr-8 md:text-[13px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-300"
        >
          <optgroup label="Regiones">
            {REGIONS.map(r => (
              <option key={r.id} value={`region:${r.id}`}>
                {r.flag} {r.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Experimental · Test Leaflet">
            {REGIONS.map(r => (
              <option key={`test-${r.id}`} value={`region_test:${r.id}`}>
                🧪 {r.label} (Leaflet)
              </option>
            ))}
          </optgroup>
          <optgroup label="Países">
            {COUNTRIES.map(c => (
              <option key={c.code} value={`country:${c.code}`} disabled={!c.enabled}>
                {c.flag} {c.name}
                {!c.enabled ? ' · próximamente' : ''}
              </option>
            ))}
          </optgroup>
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
          ▾
        </span>
      </div>
      {/* Badge BETA solo cuando la vista activa lo necesita. El label
          completo (currentLabel) lo quitamos: era redundante con el dropdown
          de arriba, que ya muestra la vista seleccionada. */}
      {(view === 'global' || view === 'region_test') && (
        <span className="hidden rounded-sm bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-800 md:inline-block dark:bg-amber-900/40 dark:text-amber-300">
          beta
        </span>
      )}
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Toggle de color scheme: cicla light → dark → system. El ícono
            indica el estado actual; el title sugiere el próximo. */}
        <button
          type="button"
          onClick={cycleColorScheme}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
          title={`Modo ${colorScheme === 'light' ? 'claro' : colorScheme === 'dark' ? 'oscuro' : 'sistema'} · click para ${nextSchemeLabel}`}
          aria-label={`Cambiar a modo ${nextSchemeLabel}`}
        >
          {colorScheme === 'light' && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.05 3.05l1.05 1.05M11.9 11.9l1.05 1.05M3.05 12.95l1.05-1.05M11.9 4.1l1.05-1.05" />
            </svg>
          )}
          {colorScheme === 'dark' && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M13.5 9.6a5.5 5.5 0 1 1-7.1-7.1 6 6 0 1 0 7.1 7.1z" />
            </svg>
          )}
          {colorScheme === 'system' && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="3" width="12" height="8" rx="1" />
              <path d="M6 14h4M8 11v3" />
            </svg>
          )}
        </button>

        {/* Atajo al tab Dibujar. Cuando el tab activo ya es "dibujar", el
            botón cambia a estado "activo" (fondo oscuro) y deja de actuar
            como toggle al tab — sirve como indicador visual del modo. */}
        <button
          type="button"
          onClick={() => setPaintMode(!isDibujando)}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 md:px-2.5 ${
            isDibujando
              ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-700 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300'
              : 'border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100'
          }`}
          title={isDibujando ? 'Cerrar modo Pintar' : 'Hacer tu propio mapa'}
          aria-pressed={isDibujando}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 11.5V13h1.5L12 5.5 10.5 4z" />
            <path d="M9.5 5 11 6.5" />
          </svg>
          <span className="hidden sm:inline">
            {isDibujando ? 'Pintando' : 'Hacer tu propio mapa'}
          </span>
        </button>
      </div>
      </div>
    </div>
  )
}
