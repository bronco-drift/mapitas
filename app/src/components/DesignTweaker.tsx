// Panel flotante de iteración visual rápida.
//
// Su visibilidad la controla `tweakerEnabled` del store global (toggleable
// desde TopBar → ⚙️ → Configuración → Mostrar Tweaks). En DEV arranca true;
// en prod arranca false hasta que el user lo active. App.tsx hace el render
// condicional + lazy del chunk.
//
// La idea: probar cambios de estilo (fondo, texto, tipografía, etc.) en
// vivo sin tocar código, y exportar un JSON con los valores para discutir
// los cambios y aplicarlos al producto real.
//
// Por qué inyectar <style> en lugar de body.style:
//   - body.style queda invisible: la app tapa el body con componentes que
//     tienen sus propios bg-* / text-*. Necesitamos pisar esas clases con
//     reglas !important que matchean los selectores de Tailwind.
//
// Por qué localStorage propio (no Zustand):
//   - Los TWEAKS (colores, posición, expanded) son dev tooling, no producto.
//     No deben contaminar el state global ni la persistencia del producto.
//     Solo el flag de visibilidad vive en el store (porque lo lee TopBar).
//     Storage key propio: `mapitas:tweaker-v1`.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useStore } from '../store'

const STORAGE_KEY = 'mapitas:tweaker-v1'

type FontFamilyId = 'default' | 'serif' | 'mono' | 'rounded' | 'editorial'

type Tweaks = {
  bg: string | null
  text: string | null
  accent: string | null // se guarda pero NO se aplica global (es para discutir)
  fontFamily: FontFamilyId
  fontSize: number // px en :root, afecta rems
  letterSpacing: number // em
}

const FONT_FAMILIES: Record<FontFamilyId, { label: string; stack: string | null }> = {
  default: { label: 'Sistema', stack: null },
  serif: {
    label: 'Serif',
    stack: 'Iowan Old Style, Apple Garamond, Cambria, Georgia, serif',
  },
  mono: {
    label: 'Monoespaciada',
    stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  rounded: {
    label: 'Redondeada',
    stack: 'ui-rounded, -apple-system-rounded, "SF Pro Rounded", system-ui, sans-serif',
  },
  editorial: {
    label: 'Editorial',
    stack: 'Charter, "Bitstream Charter", Cambria, Georgia, serif',
  },
}

const DEFAULTS: Tweaks = {
  bg: null,
  text: null,
  accent: null,
  fontFamily: 'default',
  fontSize: 16,
  letterSpacing: 0,
}

type Persisted = {
  position: { x: number; y: number }
  expanded: boolean
  tweaks: Tweaks
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const data = JSON.parse(raw)
    // NOTA: data.hidden (de una versión previa que tenía botón de
    // ocultar) se ignora a propósito. El panel siempre está visible
    // como pastilla mínimo, para evitar perderlo.
    return {
      position: data.position ?? { x: 20, y: 80 },
      expanded: data.expanded ?? false,
      tweaks: { ...DEFAULTS, ...(data.tweaks ?? {}) },
    }
  } catch {
    return {
      position: { x: 20, y: 80 },
      expanded: false,
      tweaks: DEFAULTS,
    }
  }
}

export function DesignTweaker() {
  const colorScheme = useStore(s => s.colorScheme)
  const view = useStore(s => s.view)
  const [persisted] = useState<Persisted>(loadPersisted)
  const [position, setPosition] = useState(persisted.position)
  const [expanded, setExpanded] = useState(persisted.expanded)
  const [tweaks, setTweaks] = useState<Tweaks>(persisted.tweaks)
  const [copied, setCopied] = useState(false)

  // Persistencia (debounced via batch: cualquier cambio reescribe el blob).
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ position, expanded, tweaks }),
      )
    } catch {
      /* localStorage lleno o privado: no bloquear */
    }
  }, [position, expanded, tweaks])

  // Aplicar tweaks via <style> inyectado en <head>. body.style.setProperty
  // NO funciona para esto: la app tapa el body con componentes que tienen
  // sus propios bg-white / dark:bg-slate-950, y los text-slate-X tienen
  // color explícito (no heredan del body). Necesitamos pisar esas clases
  // directamente con !important para que el override sea visible.
  //
  // El selector `:where(.dark, .dark *)` matchea el custom-variant de
  // Tailwind v4 definido en index.css. Igualando esa especificidad +
  // !important + mi <style> insertado después del de Tailwind = mi override
  // siempre gana.
  //
  // Listas de clases enumeradas explícitamente: todas las que aparecen
  // como bg/text de UI en components/*.tsx. Si en el futuro agregamos un
  // bg-* nuevo y querés que el tweaker lo pise, sumalo a la lista.
  useEffect(() => {
    const root = document.documentElement

    const rules: string[] = []

    if (tweaks.bg) {
      rules.push(
        [
          'html, body, #root,',
          '.bg-white, .bg-slate-50, .bg-slate-100,',
          '.dark\\:bg-slate-950:where(.dark, .dark *),',
          '.dark\\:bg-slate-900:where(.dark, .dark *),',
          '.dark\\:bg-slate-800:where(.dark, .dark *)',
          `{ background-color: ${tweaks.bg} !important; }`,
        ].join(' '),
      )
    }

    if (tweaks.text) {
      rules.push(
        [
          'body,',
          '.text-slate-900, .text-slate-800, .text-slate-700, .text-slate-600,',
          '.text-slate-500, .text-slate-400,',
          '.dark\\:text-slate-50:where(.dark, .dark *),',
          '.dark\\:text-slate-100:where(.dark, .dark *),',
          '.dark\\:text-slate-200:where(.dark, .dark *),',
          '.dark\\:text-slate-300:where(.dark, .dark *),',
          '.dark\\:text-slate-400:where(.dark, .dark *)',
          `{ color: ${tweaks.text} !important; }`,
        ].join(' '),
      )
    }

    // Font family: aplico a html + controles. Heredan a TODO el árbol.
    // 'default' (stack === null) = sin override.
    const fontStack = FONT_FAMILIES[tweaks.fontFamily].stack
    if (fontStack) {
      rules.push(
        `html, body, button, input, select, textarea { font-family: ${fontStack} !important; }`,
      )
    }

    // Letter spacing: idem.
    if (tweaks.letterSpacing !== 0) {
      rules.push(
        `body, h1, h2, h3, h4, h5, h6, p, span, div, button, label { letter-spacing: ${tweaks.letterSpacing}em !important; }`,
      )
    }

    // Acento: SOLO se guarda como CSS var. NO se aplica a clases — es
    // valor de referencia para que vos decidas dónde meterlo (botones
    // primarios, links, highlights). Yo lo aplico al producto a mano
    // cuando me pases el JSON.
    if (tweaks.accent) {
      root.style.setProperty('--tweak-accent', tweaks.accent)
    } else {
      root.style.removeProperty('--tweak-accent')
    }

    // Font size en :root afecta TODOS los rems de Tailwind. Sigue siendo
    // imperativo en root.style por simpleza — no necesita selector.
    if (tweaks.fontSize !== DEFAULTS.fontSize) {
      root.style.setProperty('font-size', `${tweaks.fontSize}px`)
    } else {
      root.style.removeProperty('font-size')
    }

    // Inyectar/actualizar el <style> tag. Una sola etiqueta reutilizada
    // para evitar acumular nodos en cada render.
    let styleTag = document.getElementById('mapitas-tweaker-styles') as HTMLStyleElement | null
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = 'mapitas-tweaker-styles'
      document.head.appendChild(styleTag)
    }
    styleTag.textContent = rules.join('\n')
  }, [tweaks])

  // Cleanup al desmontar (si en algún momento se desmonta).
  useEffect(() => {
    return () => {
      const root = document.documentElement
      root.style.removeProperty('font-size')
      root.style.removeProperty('--tweak-accent')
      document.getElementById('mapitas-tweaker-styles')?.remove()
    }
  }, [])

  // Drag: pointer events. startX/Y son el offset del pointer relativo al
  // origen del panel al inicio del drag, para que el panel no salte al
  // primer pointermove.
  const dragRef = useRef<{ startX: number; startY: number } | null>(null)
  function onDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    // No iniciar drag si el click viene de un control interactivo
    const target = e.target as HTMLElement
    if (target.closest('button, input, select')) return
    dragRef.current = {
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    }
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      // Clamp para que el panel no se salga del viewport. 32px de margen
      // mínimo para siempre poder agarrarlo.
      const newX = Math.max(
        -200,
        Math.min(window.innerWidth - 60, ev.clientX - dragRef.current.startX),
      )
      const newY = Math.max(
        0,
        Math.min(window.innerHeight - 32, ev.clientY - dragRef.current.startY),
      )
      setPosition({ x: newX, y: newY })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  async function copyData() {
    const payload = {
      timestamp: new Date().toISOString(),
      context: {
        route: window.location.hash || '#/',
        colorScheme,
        view,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
      },
      tweaks: {
        ...tweaks,
        fontFamilyStack: FONT_FAMILIES[tweaks.fontFamily].stack,
      },
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback: prompt con el texto, el user lo copia manual
      window.prompt('Copiar manualmente:', JSON.stringify(payload, null, 2))
    }
  }

  function reset() {
    setTweaks(DEFAULTS)
  }

  // Drag con click-vs-drag detection para la pastilla. Si el pointer se
  // mueve >4px durante el gesture → drag. Si no → tap = expand. Resuelve
  // el problema de que la pastilla entera es un <button> (no podemos
  // separar área de drag de área de click sin perder accesibilidad).
  function startPillGesture(e: ReactPointerEvent<HTMLButtonElement>) {
    const offsetX = e.clientX - position.x
    const offsetY = e.clientY - position.y
    let moved = false
    const onMove = (ev: PointerEvent) => {
      if (!moved) {
        const dx = ev.clientX - e.clientX
        const dy = ev.clientY - e.clientY
        if (Math.hypot(dx, dy) < 4) return // threshold para click vs drag
        moved = true
      }
      const newX = Math.max(
        -200,
        Math.min(window.innerWidth - 60, ev.clientX - offsetX),
      )
      const newY = Math.max(
        0,
        Math.min(window.innerHeight - 32, ev.clientY - offsetY),
      )
      setPosition({ x: newX, y: newY })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      // Si no se movió, tratamos el gesture como tap = expandir.
      if (!moved) setExpanded(true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // Estado colapsado: pastilla pequeña en su posición.
  // - Tap (sin movimiento): expandir
  // - Drag (con movimiento >4px): mover por toda la pantalla
  if (!expanded) {
    return (
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          touchAction: 'none',
        }}
        className="select-none"
      >
        <button
          type="button"
          onPointerDown={startPillGesture}
          className="flex cursor-grab items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-lg backdrop-blur transition hover:border-slate-400 hover:text-slate-900 active:cursor-grabbing dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:text-slate-50"
          title="Click para abrir · arrastrá para mover"
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
            <circle cx="8" cy="8" r="1.5" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4" />
          </svg>
          Tweaks
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        width: 288,
        touchAction: 'none',
      }}
      className="overflow-hidden rounded-xl border border-slate-300 bg-white/95 text-[12px] text-slate-700 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
    >
      {/* Header drag */}
      <div
        onPointerDown={onDragStart}
        className="flex cursor-move select-none items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex h-1 w-6 items-center justify-center">
          <div className="h-0.5 w-5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Tweaks
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Colapsar a pastilla"
          className="ml-auto flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Colapsar a pastilla"
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
            <path d="M4 8h8" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        <Field label="Fondo">
          <ColorInput
            value={tweaks.bg}
            onChange={v => setTweaks(t => ({ ...t, bg: v }))}
            placeholder="auto"
          />
        </Field>

        <Field label="Texto">
          <ColorInput
            value={tweaks.text}
            onChange={v => setTweaks(t => ({ ...t, text: v }))}
            placeholder="auto"
          />
        </Field>

        <Field label="Acento" hint="(solo se guarda)">
          <ColorInput
            value={tweaks.accent}
            onChange={v => setTweaks(t => ({ ...t, accent: v }))}
            placeholder="—"
          />
        </Field>

        <Field label="Tipografía">
          <select
            value={tweaks.fontFamily}
            onChange={e =>
              setTweaks(t => ({ ...t, fontFamily: e.target.value as FontFamilyId }))
            }
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-800 focus:border-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-300"
          >
            {Object.entries(FONT_FAMILIES).map(([id, f]) => (
              <option key={id} value={id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tamaño base" hint={`${tweaks.fontSize}px`}>
          <input
            type="range"
            min={13}
            max={19}
            step={1}
            value={tweaks.fontSize}
            onChange={e => setTweaks(t => ({ ...t, fontSize: parseInt(e.target.value) }))}
            className="w-full"
          />
        </Field>

        <Field label="Letter spacing" hint={`${tweaks.letterSpacing.toFixed(3)}em`}>
          <input
            type="range"
            min={-0.04}
            max={0.06}
            step={0.005}
            value={tweaks.letterSpacing}
            onChange={e =>
              setTweaks(t => ({ ...t, letterSpacing: parseFloat(e.target.value) }))
            }
            className="w-full"
          />
        </Field>
      </div>

      {/* Footer con acciones */}
      <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-slate-100"
        >
          Resetear
        </button>
        <button
          type="button"
          onClick={copyData}
          className={`ml-auto rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300'
          }`}
          title="Copia JSON al portapapeles"
        >
          {copied ? '¡Copiado!' : 'Copiar datos'}
        </button>
      </div>
    </div>
  )
}

// ─── Subcomponentes ────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </label>
        {hint && (
          <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// Color input con campo hex texteable + picker nativo + botón borrar.
// Permite null = "no override" (placeholder visible).
function ColorInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null
  onChange: (v: string | null) => void
  placeholder: string
}) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => {
    setText(value ?? '')
  }, [value])
  const commit = (v: string) => {
    const trimmed = v.trim()
    if (trimmed === '') {
      onChange(null)
      return
    }
    // Solo aplicar si parece hex válido (#rgb, #rrggbb, #rrggbbaa)
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
      onChange(trimmed)
    }
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value ?? '#888888'}
        onChange={e => onChange(e.target.value)}
        className="h-7 w-7 cursor-pointer rounded border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800"
        aria-label="Color picker"
      />
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit(e.currentTarget.value)
        }}
        placeholder={placeholder}
        className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-slate-300"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Limpiar"
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          title="Volver a auto"
        >
          <svg
            width="9"
            height="9"
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
      )}
    </div>
  )
}
