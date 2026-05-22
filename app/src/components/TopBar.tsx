import { useStore } from '../store'

type Country = {
  code: string
  name: string
  flag: string
  enabled: boolean
}

const LATAM: Country[] = [
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
  const country = useStore(s => s.country)
  const current = LATAM.find(c => c.code === country)

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
        País
      </div>
      <div className="relative">
        <select
          value={country}
          onChange={e => {
            const next = LATAM.find(c => c.code === e.target.value)
            if (next?.enabled) {
              // por ahora solo VE; cuando habilitemos otros, cambiar país en store
            }
          }}
          className="appearance-none rounded-md border border-slate-200 bg-white py-1 pl-2 pr-8 text-[13px] text-slate-800 focus:border-slate-900 focus:outline-none"
        >
          {LATAM.map(c => (
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
      <span className="text-[11px] text-slate-400">
        {current?.flag} {current?.name}
      </span>
      <div className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Local · sin red
      </div>
    </div>
  )
}
