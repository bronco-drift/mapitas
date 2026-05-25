// Popover de Configuración anclado al botón ⚙️ del TopBar.
//
// Contiene tres bloques (todos opcionales y autocontenidos para que sumar
// uno cuarto sea trivial):
//   1. Cuenta — placeholder mientras no hay backend / auth.
//   2. Tweaks — toggle del panel DesignTweaker (visible solo si lo enciende).
//   3. Mapas guardados — slots del painter: cargar / renombrar / borrar.
//
// Implementación: renderizado por createPortal en <body> para escapar del
// stacking context del TopBar. Cierra con click afuera, ESC o tap en el
// botón "Cerrar". Sin librerías nuevas — handlers manuales con refs.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'

export function SettingsModal({
  open,
  onClose,
  anchorRef,
}: {
  open: boolean
  onClose: () => void
  // ref al botón que abre el modal — lo usamos para posicionar el popover
  // alineado a la derecha del botón y excluirlo del click-outside handler.
  anchorRef: React.RefObject<HTMLButtonElement | null>
}) {
  const tweakerEnabled = useStore(s => s.tweakerEnabled)
  const setTweakerEnabled = useStore(s => s.setTweakerEnabled)
  const savedMaps = useStore(s => s.savedMaps)
  const loadSavedMap = useStore(s => s.loadSavedMap)
  const deleteSavedMap = useStore(s => s.deleteSavedMap)
  const renameSavedMap = useStore(s => s.renameSavedMap)
  const setPaintMode = useStore(s => s.setPaintMode)

  const popoverRef = useRef<HTMLDivElement>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Posición calculada una vez al abrir. Usamos `right` en vez de `left`
  // para que el popover quede alineado al botón aunque el TopBar cambie de
  // ancho (mobile / desktop / orientación).
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)

  // Cálculo de posición al abrir. Refrescamos si cambia el viewport mientras
  // está abierto (rotación de pantalla, redimensionar).
  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null)
      return
    }
    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 6,
        // distancia desde el borde derecho del viewport al borde derecho
        // del anchor — alinea el popover con el botón sin importar el ancho
        // de la pantalla.
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])

  // Click afuera: cerrar. Excluye el anchor (el botón que abre) para evitar
  // un click-toggle que abre + cierra en el mismo frame.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    // capture: true para evitar que un onClick de un botón interno cierre
    // el popover antes de que el botón pueda manejar su propio click.
    // Wait, en realidad queremos lo contrario: queremos que primero el
    // botón interno reciba el click y después cierre si es afuera. Usamos
    // bubble normal y excluimos el popover (clicks adentro NO cierran).
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, onClose, anchorRef])

  // ESC cierra
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !position) return null

  function startRename(id: string, currentName: string) {
    setRenamingId(id)
    setRenameValue(currentName)
  }
  function commitRename() {
    if (renamingId && renameValue.trim()) {
      renameSavedMap(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }
  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  function handleLoad(id: string) {
    loadSavedMap(id)
    // Al cargar un mapa, llevamos al user al modo Pintar para que vea su
    // creación en el contexto correcto (paleta + leyenda visibles).
    setPaintMode(true)
    onClose()
  }

  const node = (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: position.top,
        right: position.right,
        zIndex: 1200,
        width: 'min(320px, calc(100vw - 16px))',
        maxHeight: 'calc(100vh - 80px)',
      }}
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      role="dialog"
      aria-label="Configuración"
    >
      {/* Header sticky con título + cerrar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Configuración
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Contenido scrolleable */}
      <div className="overflow-y-auto">
        {/* ─── Cuenta ──────────────────────────────────────────────────── */}
        <Section title="Cuenta">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {/* Avatar placeholder — iniciales o icon */}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <circle cx="8" cy="5.5" r="2.5" />
                <path d="M8 9c-3 0-5 1.6-5 3.5V14h10v-1.5C13 10.6 11 9 8 9z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
                Sesión local
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Próximamente: sincronizar entre dispositivos
              </div>
            </div>
          </div>
        </Section>

        {/* ─── Tweaks ──────────────────────────────────────────────────── */}
        <Section title="Diseño">
          <Toggle
            label="Mostrar Tweaks"
            description="Panel flotante para iterar estilo en vivo"
            checked={tweakerEnabled}
            onChange={setTweakerEnabled}
          />
        </Section>

        {/* ─── Mapas guardados ─────────────────────────────────────────── */}
        <Section
          title="Mis mapas"
          subtitle={savedMaps.length === 0 ? 'No tenés mapas guardados todavía' : undefined}
        >
          {savedMaps.length === 0 ? (
            <div className="text-[12px] text-slate-500 dark:text-slate-400">
              Pintá tus regiones desde el botón <span className="font-medium text-slate-700 dark:text-slate-200">Hacer tu propio mapa</span> y guardalos para volver después.
            </div>
          ) : (
            <ul className="-mx-1 space-y-0.5">
              {savedMaps.map(map => (
                <li
                  key={map.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {renamingId === map.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') cancelRename()
                      }}
                      autoFocus
                      className="flex-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[12px] text-slate-800 focus:border-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-300"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLoad(map.id)}
                      className="flex min-w-0 flex-1 flex-col items-start text-left"
                      title="Cargar este mapa"
                    >
                      <span className="truncate text-[12px] font-medium text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-slate-50">
                        {map.name}
                      </span>
                      <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                        {formatRelative(map.savedAt)} ·{' '}
                        {countAssignments(map)} regiones
                      </span>
                    </button>
                  )}

                  {renamingId !== map.id && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <IconButton
                        onClick={() => startRename(map.id, map.name)}
                        title="Renombrar"
                      >
                        <svg
                          width="11"
                          height="11"
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
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          if (window.confirm(`¿Borrar "${map.name}"?`)) {
                            deleteSavedMap(map.id)
                          }
                        }}
                        title="Borrar"
                        danger
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4l1 9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-9" />
                        </svg>
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

// ─── Subcomponentes ────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-200">
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{description}</div>
        )}
      </div>
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-slate-900 dark:bg-slate-700 dark:peer-checked:bg-slate-100" />
        <span className="relative ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4 dark:bg-slate-300 dark:peer-checked:bg-slate-900" />
      </span>
    </label>
  )
}

function IconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void
  title: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-6 w-6 items-center justify-center rounded text-slate-400 transition ${
        danger
          ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400'
          : 'hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Tiempo relativo simple, en español. "ahora", "5 min", "2 h", "ayer", "DD/MM".
function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} h`
  if (hr < 48) return 'ayer'
  const d = new Date(ts)
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })
}

function countAssignments(map: { assignments: { ve_states: Record<string, string>; ve_munis: Record<string, string>; countries: Record<string, string> } }): number {
  return (
    Object.keys(map.assignments.ve_states).length +
    Object.keys(map.assignments.ve_munis).length +
    Object.keys(map.assignments.countries).length
  )
}
