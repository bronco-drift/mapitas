// Modal de bienvenida al primer load. 3 pasos muy breves para orientar
// al usuario que entra por primera vez al mapa. Se descarta al hacer
// click en "Empezar" o en el botón cerrar, y NO vuelve a aparecer
// (persistencia con flag en localStorage).
//
// Diseño Apple/Anthropic: card centrada, mucho whitespace, números
// grandes para los pasos, sin iconos ni gradientes ornamentales.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'mapitas:welcome-seen-v1'

function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // localStorage no disponible (modo incógnito agresivo, etc.); que
    // se vea el modal cada vez es preferible a romper.
  }
}

export function WelcomeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hasSeenWelcome()) {
      // Pequeño delay para que el primer paint del mapa se sienta primero
      // (UX: que el user vea el mapa aparecer, después el modal encima).
      const t = window.setTimeout(() => setOpen(true), 400)
      return () => window.clearTimeout(t)
    }
  }, [])

  // Cerrar con Escape para que sea descartable rápido (UX desktop).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    markSeen()
    setOpen(false)
  }

  if (!open) return null

  const node = (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Overlay: blur + dark sutil. Clickeable para cerrar (UX estándar). */}
      <button
        type="button"
        onClick={close}
        aria-label="Cerrar bienvenida"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/70"
      />

      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-7 shadow-2xl sm:p-9">
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 hover:text-slate-700"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>

        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Bienvenido
        </div>
        <h2
          id="welcome-title"
          className="mt-2 text-[24px] font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-100 sm:text-[26px]"
        >
          Tres pasos para tu primer mapa.
        </h2>

        <ol className="mt-7 space-y-5">
          <Step
            number="1"
            title="Elegí qué ver"
            body="Indicadores oficiales (población, IDH, PIB...) en el panel Datos. O subí tu propio CSV/Excel."
          />
          <Step
            number="2"
            title="Cambiá el nivel"
            body="País, estados o municipios. Los reportes se ajustan automáticamente al nivel seleccionado."
          />
          <Step
            number="3"
            title="Ajustá el estilo"
            body="Paleta, opacidad, basemap. Todo en el panel Estilo. Tu configuración se guarda."
          />
        </ol>

        <button
          type="button"
          onClick={close}
          className="mt-7 w-full rounded-full bg-slate-900 px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Empezar
        </button>
      </div>
    </div>
  )
  return createPortal(node, document.body)
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-3">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[12px] font-semibold tabular-nums text-slate-700"
        aria-hidden
      >
        {number}
      </div>
      <div>
        <div className="text-[14px] font-semibold leading-snug text-slate-900">{title}</div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{body}</p>
      </div>
    </li>
  )
}
