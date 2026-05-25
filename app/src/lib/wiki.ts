// Helpers para construir queries y URLs hacia Wikipedia desde features
// del mapa (países en vista Global, estados/munis VE en vista Venezuela).
//
// Vive separado del componente WikiModal porque otras partes del UI
// también lo usan (botón "Más info" del ControlPanel, futuro hover modal,
// etc.) — y porque el lint de react-refresh no permite exportar funciones
// no-componente desde un archivo .tsx que ya exporta un componente.

type SelectedLike = {
  name: string
  nombreOficial?: string | null
  parentState?: string | null
  iso?: string | null
}

// Decide el query para fetcher Wikipedia. Cobertura:
//   - País (vista Global)         → name (ej. "Colombia")
//   - Estado VE (iso 'VE-X')      → nombreOficial ?? name. Si el nombre es
//                                   ambiguo (Bolívar, Sucre), Wikipedia
//                                   devuelve disambig y WikiModal cae al
//                                   botón "Buscar en Wikipedia".
//   - Muni VE (parentState != null) → "{nombre}, {estado padre}" para
//                                   desambiguar nombres genéricos (en VE
//                                   hay 14 munis "Libertador").
export function wikiQueryFor(selected: SelectedLike): string {
  if (selected.parentState) {
    return `${selected.nombreOficial ?? selected.name}, ${selected.parentState}`
  }
  return selected.nombreOficial ?? selected.name
}

// URL de búsqueda directa en Wikipedia (es.wikipedia.org). Usada como
// fallback cuando el lookup directo falla (404 o disambiguation).
export function wikiSearchUrl(query: string): string {
  return `https://es.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`
}

// URL del endpoint REST summary. Devuelve título, descripción, extract,
// thumbnail y URL canónica. CORS abierto, sin API key.
export function wikiSummaryUrl(query: string): string {
  return `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
}
