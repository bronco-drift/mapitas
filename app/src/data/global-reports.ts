// Catálogo de reportes para la vista Global.
//
// Esto es el análogo de `indicators.ts` (que cataloga reportes VE) pero
// para el mapa mundial. Cada entrada describe un reporte navegable desde
// el panel del tab Datos cuando la vista activa es Global.
//
// Hoy hay 3 reportes en una sola categoría (Diáspora venezolana). A medida
// que agregamos data mundial (Banco Mundial, PNUD, CEPAL, WHO, OIM, etc.)
// se irán sumando categorías nuevas: demografía mundial, desarrollo, etc.
//
// Aclaración técnica: los 3 reportes actuales NO leen data del geojson de
// la misma forma (uno cuenta migrantes_ve, otro suma con población origen,
// otro calcula ratio). Cada uno tiene su lógica en `applyDiaspora`. El
// campo `mode` acá conecta el reporte con su lógica de pintado. Cuando
// se sumen reportes "estándar" (un solo número por país), se podrá usar
// un mode genérico que sólo lee data[iso_a3].
//
// Para agregar un reporte:
//   1. Si reusa un mode existente (migrantes/venezolanos/porcentaje):
//      agregás una entrada acá y listo.
//   2. Si es lógica nueva: agregás un mode a DiasporaMode en
//      apply-indicator.ts, actualizás applyDiaspora con esa lógica, y
//      lo enlazás acá vía `mode`.

import type { DiasporaMode } from '../lib/apply-indicator'

export type GlobalReportCategory = 'diaspora'

export const GLOBAL_CATEGORY_LABELS: Record<GlobalReportCategory, string> = {
  diaspora: 'Diáspora venezolana',
  // Cuando agreguemos más reportes mundiales:
  // demografia: 'Demografía mundial',
  // desarrollo: 'Desarrollo humano',
  // economia:   'Economía mundial',
  // ambiente:   'Ambiente y clima',
  // migracion:  'Migración global',
}

export const GLOBAL_CATEGORY_ORDER: GlobalReportCategory[] = ['diaspora']

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
  unit: string // "habitantes" | "%" | etc.
  // Modo que aplica el merge en el geojson. Cada modo tiene su lógica
  // específica en applyDiaspora (rango, color, fórmula).
  mode: DiasporaMode
  // Nota opcional: aclaraciones sobre metodología, sesgos, limitaciones.
  note?: string
}

export const GLOBAL_REPORTS: GlobalReport[] = [
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
]

// Lookup helpers análogos a los de indicators.ts
export function getGlobalReport(id: string): GlobalReport | undefined {
  return GLOBAL_REPORTS.find(r => r.id === id)
}

export function getGlobalReportByMode(mode: DiasporaMode): GlobalReport | undefined {
  return GLOBAL_REPORTS.find(r => r.mode === mode)
}
