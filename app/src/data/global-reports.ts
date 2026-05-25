// Catálogo de reportes para la vista Global.
//
// Esto es el análogo de `indicators.ts` (que cataloga reportes VE) pero
// para el mapa mundial. Cada entrada describe un reporte navegable desde
// el panel del tab Datos cuando la vista activa es Global.
//
// Categorías hoy:
//   - 'diaspora'  · 3 reportes sobre migrantes venezolanos (default histórico)
//   - 'demografia' · 1 reporte (población total)
//   - 'economia'   · 1 reporte (PIB per cápita USD)
//   - 'desarrollo' · 1 reporte (IDH)
//
// A medida que agreguemos data mundial (esperanza de vida, % alfabetización,
// densidad, emisiones, etc.) se irán sumando reportes a las categorías
// existentes — la UI ya soporta arbitrariamente muchos por categoría.
//
// Aclaración técnica: cada reporte tiene un `mode` que apunta a la lógica
// de pintado en `applyDiaspora` (apply-indicator.ts). Para los modos
// 'poblacion' / 'pib_pc' / 'idh', el valor se lee directamente del feature
// del geojson (las props se mergean en loadDiasporaData desde
// world-indicators.json). Para los 3 modos de diáspora, la lógica usa los
// campos migrantes_ve / poblacion_total / is_origin del geojson.
//
// Para agregar un reporte:
//   1. Si reusa un mode existente: agregás una entrada acá y listo.
//   2. Si es lógica nueva: agregás el mode a GlobalMetric en
//      apply-indicator.ts, actualizás applyDiaspora con esa lógica, y
//      lo enlazás acá vía `mode`. Si el valor viene de un campo nuevo,
//      sumalo a world-indicators.json y a DiasporaProps en types.ts.

import type { GlobalMetric } from '../lib/apply-indicator'

export type GlobalReportCategory = 'diaspora' | 'demografia' | 'economia' | 'desarrollo'

export const GLOBAL_CATEGORY_LABELS: Record<GlobalReportCategory, string> = {
  diaspora: 'Diáspora venezolana',
  demografia: 'Demografía',
  economia: 'Economía',
  desarrollo: 'Desarrollo humano',
}

// Orden de aparición en el panel. Diáspora primero (es la vista insignia
// de Mapitas en modo Global), después comparativos generales por país.
export const GLOBAL_CATEGORY_ORDER: GlobalReportCategory[] = [
  'diaspora',
  'demografia',
  'economia',
  'desarrollo',
]

export type GlobalReport = {
  id: string
  label: string
  // Texto corto para el segmented control (cuando hay pocos reportes en una
  // categoría es lindo tenerlos como tabs; cuando crecen pasan a lista vertical).
  short: string
  description: string
  category: GlobalReportCategory
  year: string // string en lugar de number: algunos cubren rangos ("2022–2025")
  source: string
  unit: string // "habitantes" | "%" | "USD" | "IDH" | etc.
  // Modo que aplica el merge en el geojson. Cada modo tiene su lógica
  // específica en applyDiaspora (rango, color, fórmula).
  mode: GlobalMetric
  // Nota opcional: aclaraciones sobre metodología, sesgos, limitaciones.
  note?: string
}

export const GLOBAL_REPORTS: GlobalReport[] = [
  // ─── Diáspora venezolana ────────────────────────────────────────────────
  {
    id: 'migrantes_recibidos',
    label: 'Migrantes recibidos',
    short: 'Recibidos',
    description:
      'Migrantes venezolanos recibidos por país. Venezuela queda fuera del rango (es el origen, no un receptor) y se pinta granate.',
    category: 'diaspora',
    year: '2022–2025',
    source: 'R4V (OIM + ACNUR) · cifras oficiales de gobiernos receptores',
    unit: 'habitantes',
    mode: 'migrantes',
    note: 'Subestiman porque no contemplan migrantes en situación irregular.',
  },
  {
    id: 'venezolanos_en_el_mundo',
    label: 'Venezolanos en el mundo',
    short: 'Total',
    description:
      'Total de venezolanos viviendo en cada país: residentes en VE + diáspora. ~35.9M en total.',
    category: 'diaspora',
    year: '2024',
    source: 'UN World Population Prospects + R4V',
    unit: 'habitantes',
    mode: 'venezolanos',
  },
  {
    id: 'porcentaje_local',
    label: 'Venezolanos sobre población local',
    short: '% local',
    description:
      'Porcentaje de venezolanos sobre la población total del país. Revela dónde la presencia venezolana es más densa relativa al tamaño del receptor.',
    category: 'diaspora',
    year: '2024',
    source: 'R4V / UN Population Prospects',
    unit: '%',
    mode: 'porcentaje',
  },

  // ─── Demografía mundial ─────────────────────────────────────────────────
  {
    id: 'poblacion_pais',
    label: 'Población por país',
    short: 'Población',
    description:
      'Habitantes totales por país. Permite comparar tamaño absoluto de cada Estado en el mapa.',
    category: 'demografia',
    year: '2024',
    source: 'ONU · World Population Prospects',
    unit: 'habitantes',
    mode: 'poblacion',
  },

  // ─── Economía mundial ───────────────────────────────────────────────────
  {
    id: 'pib_per_capita_pais',
    label: 'PIB per cápita',
    short: 'PIB pc',
    description:
      'Producto Interno Bruto per cápita en USD nominal. Indicador estándar de tamaño económico medio por habitante.',
    category: 'economia',
    year: '2023',
    source: 'Banco Mundial · World Development Indicators',
    unit: 'USD',
    mode: 'pib_pc',
    note:
      'Para Venezuela: estimación FMI/WEO. El Banco Mundial dejó de publicar PIB venezolano en 2014 por opacidad oficial.',
  },

  // ─── Desarrollo humano ──────────────────────────────────────────────────
  {
    id: 'idh_pais',
    label: 'Índice de Desarrollo Humano',
    short: 'IDH',
    description:
      'IDH compuesto por esperanza de vida, años de escolaridad e ingreso. Rango 0 a 1; cuanto más alto, mejor desarrollo humano relativo.',
    category: 'desarrollo',
    year: '2022',
    source: 'PNUD · Informe sobre Desarrollo Humano 2023/2024',
    unit: 'IDH',
    mode: 'idh',
  },
]

// Lookup helpers análogos a los de indicators.ts
export function getGlobalReport(id: string): GlobalReport | undefined {
  return GLOBAL_REPORTS.find(r => r.id === id)
}

export function getGlobalReportByMode(mode: GlobalMetric): GlobalReport | undefined {
  return GLOBAL_REPORTS.find(r => r.mode === mode)
}
