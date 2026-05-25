// Tab "Dibujar" del ControlPanel — feature "Hacer tu propio mapa".
//
// Modelo simple inspirado en mapchart.net:
//   1. Elegís un color de la paleta (o uno custom).
//   2. Click en una región del mapa → la pinta con ese color.
//   3. Click otra vez con el mismo color → la despinta.
//   4. La "leyenda" se construye al runtime con los colores efectivamente
//      usados, ordenados por cantidad. Cada entrada permite editar label,
//      cambiar color en masa, o limpiar todas las regiones de ese color.
//
// Niveles: el painter sigue el (view + level) global del store. En adm0
// (1 solo país) no aplica — mensaje "cambiá a estados o municipios".
// Cada contexto (ve_states / ve_munis / countries) tiene su set propio
// de asignaciones.
//
// Render: el override del color del feature vive en MapView/WorldMapView,
// que leen paint.assignments[ctx] cuando arman el style de cada polígono.

import { useMemo, useRef, useState } from 'react'
import { useStore, getPaintContext } from '../store'

// Paleta curada: 6 filas × 8 columnas = 48 colores. Pasteles arriba,
// medios al centro, saturados y oscuros abajo, neutros en la última fila.
// Diseñada para que cualquier elección quede legible sobre fondo blanco
// del mapa base. Es el set "Default" — el user puede usar otro color
// custom desde el input de "Otro color".
const PALETTE: string[] = [
  // Pasteles
  '#fef3c7', '#fed7aa', '#fecaca', '#fbcfe8', '#e9d5ff', '#c7d2fe', '#bfdbfe', '#a7f3d0',
  // Medios cálidos / fríos
  '#fde047', '#fb923c', '#f87171', '#f472b6', '#a78bfa', '#818cf8', '#60a5fa', '#34d399',
  // Saturados
  '#f59e0b', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#4f46e5', '#2563eb', '#10b981',
  // Oscuros
  '#92400e', '#9a3412', '#991b1b', '#9d174d', '#6b21a8', '#3730a3', '#1e3a8a', '#065f46',
  // Profundos / accent
  '#451a03', '#7c2d12', '#7f1d1d', '#831843', '#581c87', '#1e1b4b', '#172554', '#022c22',
  // Neutros
  '#ffffff', '#e5e7eb', '#9ca3af', '#4b5563', '#1f2937', '#000000', '#fda4af', '#5eead4',
]

export function PaintTab() {
  const view = useStore(s => s.view)
  const level = useStore(s => s.level)
  const paint = useStore(s => s.paint)
  const setPaintActiveColor = useStore(s => s.setPaintActiveColor)
  const setPaintColorLabel = useStore(s => s.setPaintColorLabel)
  const removePaintColor = useStore(s => s.removePaintColor)
  const clearPaintContext = useStore(s => s.clearPaintContext)
  const setPaintTitle = useStore(s => s.setPaintTitle)
  const [downloading, setDownloading] = useState(false)

  const ctx = getPaintContext(view, level)

  // Leyenda en runtime: agrupar features asignados por color (ordenado por
  // cantidad descendente para que los colores más usados queden arriba).
  const legend = useMemo(() => {
    if (!ctx) return [] as Array<{ color: string; count: number }>
    const counts: Record<string, number> = {}
    for (const c of Object.values(paint.assignments[ctx])) {
      counts[c] = (counts[c] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count)
  }, [ctx, paint.assignments])

  if (!ctx) {
    return (
      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-3 text-[12px] leading-relaxed text-slate-600">
        El modo Dibujar aplica a estados, municipios o países. Pasá a un
        nivel con varias regiones (Estados o Municipios en Venezuela; o la
        vista Mundo).
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Título del mapa: editable inline, se usa también como nombre del PNG */}
      <div>
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          Título del mapa
        </div>
        <input
          type="text"
          value={paint.title}
          onChange={e => setPaintTitle(e.target.value)}
          placeholder="Mi mapa"
          maxLength={80}
          className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[13px] font-medium tracking-tight text-slate-900 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-slate-900 focus:outline-none"
          aria-label="Título del mapa"
        />
      </div>

      {/* Color seleccionado + paleta */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            Color
          </span>
          {paint.activeColor && (
            <button
              type="button"
              onClick={() => setPaintActiveColor(null)}
              className="text-[10px] text-slate-400 dark:text-slate-400 hover:text-slate-700"
            >
              soltar
            </button>
          )}
        </div>
        <div className="grid grid-cols-8 gap-1">
          {PALETTE.map(c => (
            <ColorSwatch
              key={c}
              color={c}
              active={paint.activeColor === c}
              onClick={() => setPaintActiveColor(c)}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="relative inline-flex shrink-0" title="Color personalizado">
            <input
              type="color"
              value={paint.activeColor ?? '#5b8def'}
              onChange={e => setPaintActiveColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Color personalizado"
            />
            <span
              aria-hidden
              className="block h-6 w-6 rounded border border-slate-300 dark:border-slate-700 bg-gradient-to-br from-pink-300 via-amber-300 to-cyan-300"
            />
          </label>
          <span className="text-[11px] text-slate-500">
            {paint.activeColor ? (
              <>
                Activo:{' '}
                <span className="font-mono uppercase">{paint.activeColor}</span>
              </>
            ) : (
              'Ningún color seleccionado'
            )}
          </span>
        </div>
        <p className="mt-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5 text-[11px] leading-snug text-slate-500">
          {paint.activeColor
            ? 'Hacé click en una región del mapa para pintarla. Click otra vez sobre la misma región la despinta.'
            : 'Elegí un color para empezar a pintar el mapa.'}
        </p>
      </div>

      {/* Leyenda en runtime */}
      {legend.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Leyenda
            </span>
            <span className="text-[10px] tabular-nums text-slate-400">
              {legend.length} colores · {legend.reduce((a, b) => a + b.count, 0)} regiones
            </span>
          </div>
          <div className="space-y-1">
            {legend.map(({ color, count }) => (
              <LegendRow
                key={color}
                color={color}
                count={count}
                label={paint.labels[color] ?? ''}
                isActive={paint.activeColor === color}
                onActivate={() => setPaintActiveColor(color)}
                onLabel={label => setPaintColorLabel(color, label)}
                onRemove={() => {
                  if (
                    confirm(
                      `¿Despintar las ${count} regiones de este color en este nivel?`,
                    )
                  ) {
                    removePaintColor(ctx, color)
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mapas guardados (snapshots locales). El user puede guardar el
          estado actual con un nombre y restaurarlo después. Persiste en
          localStorage como el resto del state. */}
      <SavedMapsSection />

      {/* Acciones */}
      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <DownloadPngButton
          downloading={downloading}
          setDownloading={setDownloading}
          fileName={paint.title}
          disabled={legend.length === 0}
        />
        <button
          type="button"
          onClick={() => {
            if (legend.length === 0) return
            if (confirm('¿Borrar todas las asignaciones de este nivel?')) {
              clearPaintContext(ctx)
            }
          }}
          disabled={legend.length === 0}
          className="block w-full text-[11px] text-slate-500 dark:text-slate-300 dark:text-slate-400 transition enabled:hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-100 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          Limpiar mapa
        </button>
      </div>
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────

function ColorSwatch({
  color,
  active,
  onClick,
}: {
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Color ${color}`}
      aria-pressed={active}
      title={color.toUpperCase()}
      className={`relative h-6 w-full rounded-sm border transition ${
        active
          ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-1'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-500'
      }`}
      style={{ background: color }}
    >
      {active && (
        <svg
          className="absolute inset-0 m-auto h-3 w-3 drop-shadow"
          viewBox="0 0 16 16"
          fill="none"
          stroke={isLight(color) ? '#0f172a' : '#ffffff'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 8l3 3 7-7" />
        </svg>
      )}
    </button>
  )
}

function LegendRow({
  color,
  count,
  label,
  isActive,
  onActivate,
  onLabel,
  onRemove,
}: {
  color: string
  count: number
  label: string
  isActive: boolean
  onActivate: () => void
  onLabel: (label: string) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition ${
        isActive ? 'bg-slate-900' : 'hover:bg-slate-50'
      }`}
    >
      <button
        type="button"
        onClick={onActivate}
        aria-label="Activar este color"
        className="block h-5 w-5 shrink-0 rounded-sm border border-slate-300"
        style={{ background: color }}
        title={`Activar ${color.toUpperCase()}`}
      />
      <input
        ref={inputRef}
        type="text"
        value={label}
        onChange={e => onLabel(e.target.value)}
        onFocus={onActivate}
        placeholder="Sin etiqueta"
        maxLength={32}
        className={`min-w-0 flex-1 bg-transparent text-[12px] focus:outline-none ${
          isActive ? 'text-white placeholder:text-slate-400' : 'text-slate-800 dark:text-slate-200 placeholder:text-slate-400'
        }`}
        aria-label={`Etiqueta del color ${color}`}
      />
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] tabular-nums ${
          isActive ? 'text-slate-300' : 'text-slate-500'
        }`}
      >
        {count}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Despintar todas las regiones de este color"
        title="Despintar todo"
        className={`shrink-0 rounded p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${
          isActive
            ? 'text-slate-400 dark:text-slate-400 hover:bg-slate-700 hover:text-white'
            : 'text-slate-400 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-700'
        }`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  )
}

// Sección "Mapas guardados". Permite al user guardar el estado actual
// del painter con un nombre custom (snapshot completo de title +
// assignments + labels) y luego cargarlos / renombrarlos / borrarlos.
// Todo vive en localStorage (no requiere backend).
function SavedMapsSection() {
  const savedMaps = useStore(s => s.savedMaps)
  const paint = useStore(s => s.paint)
  const saveMapAs = useStore(s => s.saveMapAs)
  const loadSavedMap = useStore(s => s.loadSavedMap)
  const deleteSavedMap = useStore(s => s.deleteSavedMap)
  const renameSavedMap = useStore(s => s.renameSavedMap)

  // Total de regiones pintadas en este paint (suma de los 3 contextos).
  // Si es 0, no tiene sentido ofrecer "Guardar".
  const totalPainted =
    Object.keys(paint.assignments.ve_states).length +
    Object.keys(paint.assignments.ve_munis).length +
    Object.keys(paint.assignments.countries).length

  function handleSave() {
    // Tomamos el title actual como sugerencia, el user puede ajustarlo.
    const suggested = paint.title || 'Mi mapa'
    const name = window.prompt('Nombre del mapa:', suggested)
    if (name == null) return // canceló
    saveMapAs(name)
  }

  function handleLoad(id: string, name: string) {
    if (totalPainted > 0) {
      if (!confirm(`Cargar "${name}" va a reemplazar tu pintura actual. ¿Continuar?`)) {
        return
      }
    }
    loadSavedMap(id)
  }

  function handleRename(id: string, oldName: string) {
    const newName = window.prompt('Nuevo nombre:', oldName)
    if (newName == null) return
    renameSavedMap(id, newName)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          Mapas guardados
        </span>
        {savedMaps.length > 0 && (
          <span className="text-[10px] tabular-nums text-slate-400">
            {savedMaps.length}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={totalPainted === 0}
        className="block w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-300 transition enabled:hover:border-slate-500 enabled:hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        {totalPainted === 0 ? 'Pintá algo para guardar' : 'Guardar mapa actual'}
      </button>

      {savedMaps.length > 0 && (
        <div className="space-y-1">
          {savedMaps.map(slot => (
            <SavedMapRow
              key={slot.id}
              slot={slot}
              onLoad={() => handleLoad(slot.id, slot.name)}
              onRename={() => handleRename(slot.id, slot.name)}
              onDelete={() => {
                if (confirm(`¿Eliminar "${slot.name}"?`)) {
                  deleteSavedMap(slot.id)
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SavedMapRow({
  slot,
  onLoad,
  onRename,
  onDelete,
}: {
  slot: import('../store').SavedMap
  onLoad: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const total =
    Object.keys(slot.assignments.ve_states).length +
    Object.keys(slot.assignments.ve_munis).length +
    Object.keys(slot.assignments.countries).length

  return (
    <div className="group flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 transition hover:bg-slate-50">
      <button
        type="button"
        onClick={onLoad}
        className="flex min-w-0 flex-1 flex-col items-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        title="Cargar este mapa"
      >
        <span className="truncate text-[12px] font-medium text-slate-800">
          {slot.name}
        </span>
        <span className="truncate text-[10px] text-slate-500">
          {total} {total === 1 ? 'región' : 'regiones'} · {formatDate(slot.savedAt)}
        </span>
      </button>

      <button
        type="button"
        onClick={onRename}
        aria-label="Renombrar"
        title="Renombrar"
        className="shrink-0 rounded p-1 text-slate-400 dark:text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-300 group-hover:opacity-100 focus:opacity-100"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M11 2l3 3-8 8H3v-3z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Eliminar"
        title="Eliminar"
        className="shrink-0 rounded p-1 text-slate-400 dark:text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  )
}

// Formato relativo "hace X" para mapas recientes, fecha corta para más viejos.
function formatDate(ts: number): string {
  const diff = Date.now() - ts
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr
  if (diff < min) return 'hace un momento'
  if (diff < hr) return `hace ${Math.floor(diff / min)} min`
  if (diff < day) return `hace ${Math.floor(diff / hr)} h`
  if (diff < 7 * day) return `hace ${Math.floor(diff / day)} d`
  return new Date(ts).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

// Botón "Descargar PNG". Captura el contenedor del mapa actual y lo
// serializa a imagen vía html-to-image-style con SVG / Leaflet support.
//
// Estrategia: si el mapa es SVG (vista Global), serializamos directo a
// canvas. Si es Leaflet (vista VE), usamos el truco SVG-foreignObject
// para capturar tiles + overlay. Por simplicidad MVP: solo soportamos
// SVG por ahora (vista Global). Para Leaflet mostramos un mensaje.
function DownloadPngButton({
  downloading,
  setDownloading,
  fileName,
  disabled,
}: {
  downloading: boolean
  setDownloading: (v: boolean) => void
  fileName: string
  disabled: boolean
}) {
  function handleClick() {
    setDownloading(true)
    // Buscar el SVG del mapa Global. En vista VE Leaflet usa canvas/tiles
    // y la captura requiere html-to-image (libreria) — out of scope MVP.
    const svg = document.querySelector('.world-map-svg') as SVGSVGElement | null
    if (!svg) {
      alert(
        'Descargar PNG sólo está disponible en vista Mundo por ahora. Para Venezuela usá una captura de pantalla.',
      )
      setDownloading(false)
      return
    }
    const svgStr = new XMLSerializer().serializeToString(svg)
    const w = svg.viewBox.baseVal.width || svg.clientWidth
    const h = svg.viewBox.baseVal.height || svg.clientHeight
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    const SCALE = 2
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w * SCALE
      canvas.height = h * SCALE
      const ctx2 = canvas.getContext('2d')
      if (!ctx2) {
        URL.revokeObjectURL(url)
        setDownloading(false)
        return
      }
      ctx2.fillStyle = '#ffffff'
      ctx2.fillRect(0, 0, canvas.width, canvas.height)
      ctx2.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(out => {
        URL.revokeObjectURL(url)
        if (!out) {
          setDownloading(false)
          return
        }
        const downloadUrl = URL.createObjectURL(out)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `${slugify(fileName)}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(downloadUrl)
        setDownloading(false)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setDownloading(false)
    }
    img.src = url
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || downloading}
      className="block w-full rounded-md bg-slate-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      {downloading ? 'Generando…' : 'Descargar PNG'}
    </button>
  )
}

// ─── Utils ────────────────────────────────────────────────────────────────

// Heurística simple: es "claro" si la luminancia perceptual es alta. Lo
// usamos para decidir el color del checkmark en los swatches activos
// (negro sobre claros, blanco sobre oscuros).
function isLight(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // Coeficientes ITU-R BT.601
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'mapa'
  )
}
