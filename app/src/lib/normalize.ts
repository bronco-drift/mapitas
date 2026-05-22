// Alias para nombres históricos / coloquiales → nombre oficial
const ALIASES: Record<string, string> = {
  vargas: 'la guaira',
  esequibo: 'guayana esequiba',
  'zona en reclamacion': 'guayana esequiba',
  caracas: 'distrito capital',
}

export function normalize(str: string | null | undefined): string {
  if (!str) return ''
  const base = String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return ALIASES[base] ?? base
}

// Normalización agresiva: además quita prefijos comunes ("Estado", "Edo.", "Mun.")
// Se usa solo como fallback cuando el match exacto falla.
export function normalizeStripped(str: string | null | undefined): string {
  return normalize(str)
    .replace(/\b(edo|estado|mun|municipio|dtto)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function fuzzyMatchKey(query: string, candidates: string[]): string | null {
  if (!query) return null
  const q = normalize(query)
  if (!q) return null
  const exact = candidates.find(c => c === q)
  if (exact) return exact
  const stripped = normalizeStripped(query)
  if (stripped) {
    const exactStripped = candidates.find(c => c === stripped)
    if (exactStripped) return exactStripped
  }
  return candidates.find(c => c.includes(q) || q.includes(c)) ?? null
}
