import { useStore } from '../store'

type Country = {
  code: string
  name: string
  flag: string
  enabled: boolean
}

// La opción "Global" no es un país, es un modo de vista (mapa mundial con
// d3-geo + proyecciones). Va al principio para que sea la primera opción
// visible cuando el user abre el selector.
const COUNTRIES: Country[] = [
  { code: 'GLOBAL', name: 'Global', flag: '🌍', enabled: true },
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
  // El selector unifica vista (Global) + país. "Global" mapea a view='global'.
  // Cualquier código de país concreto mapea a view='venezuela' (por ahora
  // solo VE está habilitado; los demás están como próximamente).
  const currentCode = view === 'global' ? 'GLOBAL' : 'VE'
  const current = COUNTRIES.find(c => c.code === currentCode)

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
      className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white md:gap-3"
    >
      <div className="flex h-11 w-full items-center gap-2 md:h-12 md:gap-3">
      <a
        href="#/"
        className="flex items-center gap-1.5 text-slate-700 transition hover:text-slate-900"
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
      <span className="hidden h-4 w-px bg-slate-200 sm:inline-block" aria-hidden="true" />
      <div className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:block">
        Vista
      </div>
      <div className="relative">
        <select
          value={currentCode}
          onChange={e => {
            const code = e.target.value
            if (code === 'GLOBAL') {
              setView('global')
            } else if (code === 'VE') {
              setView('venezuela')
            }
            // otros países están disabled, no llegan acá
          }}
          className="appearance-none rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-[12px] text-slate-800 focus:border-slate-900 focus:outline-none md:pr-8 md:text-[13px]"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code} disabled={!c.enabled}>
              {c.flag} {c.name}
              {!c.enabled ? ' · próximamente' : ''}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
          ▾
        </span>
      </div>
      <span className="hidden text-[11px] text-slate-400 md:inline">
        {current?.flag} {current?.name}
        {view === 'global' && (
          <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-800">
            beta
          </span>
        )}
      </span>
      <div className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 md:gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="hidden sm:inline">Local · sin red</span>
        <span className="sm:hidden">Local</span>
      </div>
      </div>
    </div>
  )
}
