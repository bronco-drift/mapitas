// Modal con info de Wikipedia para el feature seleccionado.
//
// Por qué la REST API de Wikipedia y no la API tradicional MediaWiki:
//   - Endpoint summary devuelve título, descripción, extract (~2 oraciones),
//     thumbnail y URL canónica en un solo GET. Suficiente para una preview.
//   - CORS abierto: no necesita backend proxy.
//   - Sin API key.
//   - es.wikipedia para mantener coherencia con el idioma del producto.
//
// Caché en sessionStorage:
//   - Una visita típica abre Wiki de 3-5 features por sesión. Cachear evita
//     refetches al volver a clickear el mismo país/estado/muni.
//   - sessionStorage (no localStorage) para que se limpie al cerrar el tab.
//     Wikipedia se actualiza; mejor no servir contenido stale entre sesiones.
//
// Búsqueda:
//   - Para munis con nombre genérico (Libertador, Sucre, etc.), el query
//     incluye el estado padre: "Libertador, Distrito Capital".
//   - Si Wiki devuelve type='disambiguation', mostramos botón a Special:Search
//     en lugar del extract (sería un párrafo "tal cosa puede referirse a...").
//   - 404 → muestra link a búsqueda como fallback.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { wikiSearchUrl, wikiSummaryUrl } from '../lib/wiki'

type WikiSummary = {
  title: string
  displaytitle?: string
  description?: string
  extract: string
  thumbnail?: { source: string; width: number; height: number }
  content_urls?: { desktop?: { page?: string } }
  type?: string // 'standard' | 'disambiguation' | 'no-extract' | ...
}

type State =
  | { kind: 'loading' }
  | { kind: 'success'; data: WikiSummary }
  | { kind: 'disambiguation'; data: WikiSummary }
  | { kind: 'error'; reason: 'not_found' | 'network' }

const CACHE_KEY = 'mapitas:wiki-cache-v1'
type CacheEntry =
  | { ok: true; data: WikiSummary; kind: 'success' | 'disambiguation' }
  | { ok: false }

function readCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeCache(query: string, entry: CacheEntry) {
  try {
    const cache = readCache()
    cache[query] = entry
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // sessionStorage lleno o no disponible: que cada modal refetchee es
    // tolerable. No vale la pena propagar el error al UI.
  }
}

async function fetchWikiSummary(query: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(wikiSummaryUrl(query), {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as WikiSummary
  } catch {
    return null
  }
}

// Lookup inicial síncrono desde el cache. Si hay hit, evitamos la
// transición loading → success que causaba el lint react-hooks/set-state-in-effect.
// Si no hay cache, arrancamos en 'loading' y el effect dispara el fetch.
function initialStateFor(query: string): State {
  const cache = readCache()
  const cached = cache[query]
  if (!cached) return { kind: 'loading' }
  if (cached.ok) return { kind: cached.kind, data: cached.data }
  return { kind: 'error', reason: 'not_found' }
}

export function WikiModal({
  query,
  subtitle,
  onClose,
}: {
  query: string
  subtitle?: string
  onClose: () => void
}) {
  const [state, setState] = useState<State>(() => initialStateFor(query))

  useEffect(() => {
    // Solo fetcheamos cuando arrancamos en loading (cache miss). Si ya
    // veníamos con success/disambig/error inicial del cache, no hay nada
    // pendiente que hacer.
    if (state.kind !== 'loading') return
    let alive = true
    fetchWikiSummary(query).then(data => {
      if (!alive) return
      if (!data) {
        writeCache(query, { ok: false })
        setState({ kind: 'error', reason: 'not_found' })
        return
      }
      if (data.type === 'disambiguation') {
        writeCache(query, { ok: true, data, kind: 'disambiguation' })
        setState({ kind: 'disambiguation', data })
        return
      }
      writeCache(query, { ok: true, data, kind: 'success' })
      setState({ kind: 'success', data })
    })
    return () => {
      alive = false
    }
    // Sólo cuando cambia el query (montaje + cualquier remount con query nuevo).
    // state.kind no va en deps porque queremos disparar el fetch exactamente
    // una vez por query, no en cada transición de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Cerrar con Escape para que sea descartable rápido (UX desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const searchUrl = wikiSearchUrl(query)

  const node = (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wiki-modal-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/70"
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={onClose}
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

        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          Wikipedia
        </div>

        {state.kind === 'loading' && (
          <>
            <h2
              id="wiki-modal-title"
              className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100"
            >
              {query}
            </h2>
            {subtitle && (
              <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{subtitle}</div>
            )}
            <div className="mt-7 space-y-2.5">
              <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-9/12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-10/12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </>
        )}

        {state.kind === 'success' && (
          <>
            <div className="mt-2 flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2
                  id="wiki-modal-title"
                  className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100"
                >
                  {state.data.displaytitle?.replace(/<[^>]*>/g, '') ?? state.data.title}
                </h2>
                {state.data.description && (
                  <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    {state.data.description}
                  </div>
                )}
                {subtitle && (
                  <div className="mt-0.5 text-[11px] italic text-slate-400 dark:text-slate-500">{subtitle}</div>
                )}
              </div>
              {state.data.thumbnail && (
                <img
                  src={state.data.thumbnail.source}
                  alt=""
                  loading="lazy"
                  className="h-20 w-20 shrink-0 rounded-md object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                />
              )}
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-slate-700 dark:text-slate-300">
              {state.data.extract}
            </p>

            {state.data.content_urls?.desktop?.page && (
              <a
                href={state.data.content_urls.desktop.page}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 dark:text-slate-300 underline-offset-4 hover:text-slate-900 dark:hover:text-slate-100 hover:underline"
              >
                Leer artículo completo
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                  aria-hidden
                >
                  <path d="M6 3h7v7M13 3 7 9M11 11v2H3V5h2" />
                </svg>
              </a>
            )}
          </>
        )}

        {state.kind === 'disambiguation' && (
          <>
            <h2
              id="wiki-modal-title"
              className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100"
            >
              {query}
            </h2>
            {subtitle && (
              <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{subtitle}</div>
            )}
            <p className="mt-5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              Hay varios artículos en Wikipedia con este nombre. Buscalo
              directamente para elegir el correcto.
            </p>
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 dark:text-slate-300 underline-offset-4 hover:text-slate-900 dark:hover:text-slate-100 hover:underline"
            >
              Buscar en Wikipedia
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden
              >
                <path d="M6 3h7v7M13 3 7 9M11 11v2H3V5h2" />
              </svg>
            </a>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <h2
              id="wiki-modal-title"
              className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100"
            >
              {query}
            </h2>
            {subtitle && (
              <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{subtitle}</div>
            )}
            <p className="mt-5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              No encontramos un artículo con este nombre exacto en Wikipedia
              en español.
            </p>
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 dark:text-slate-300 underline-offset-4 hover:text-slate-900 dark:hover:text-slate-100 hover:underline"
            >
              Buscar en Wikipedia
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
                aria-hidden
              >
                <path d="M6 3h7v7M13 3 7 9M11 11v2H3V5h2" />
              </svg>
            </a>
          </>
        )}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
