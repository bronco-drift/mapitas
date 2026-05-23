// Catálogo de indicadores que la app muestra como opciones de mapeo.
//
// La data viene del master consolidado en data/master/, exportado en versión
// flat a app/src/data/master-municipalities.json y master-states.json.
//
// Regenerar: `node scripts/build-master.mjs` (consolida 4 fuentes con
// precedencia explícita por campo). El master tiene los valores ya elegidos
// por calidad — INE para serie 2010-2050, Excel/Wiki para 2021, sintético
// solo donde es la única fuente (IDH, PIB).
//
// Los 2 indicadores `aggregation: 'state'` (Población 2024 legacy y Homicidios
// OVV) no viven en el master porque son data hardcoded a nivel estado.

import masterMunisRaw from './master-municipalities.json'
import masterStatesRaw from './master-states.json'

type MasterMuniRecord = {
  id: string
  external_id: string
  name: string
  parent_iso: string
  parent_state: string
  poblacion_2010?: number
  poblacion_2020?: number
  poblacion_2026?: number
  poblacion_2050?: number
  poblacion_2021?: number
  area_km2?: number
  densidad?: number
  capital?: string
  idh?: number
  pib_total_mm_usd?: number
  pib_per_capita_usd?: number
}
type MasterStateRecord = {
  iso: string
  name: string
  muni_count: number
  poblacion_2010?: number
  poblacion_2020?: number
  poblacion_2026?: number
  poblacion_2050?: number
  poblacion_2021?: number
  area_km2?: number
  densidad?: number
  idh?: number
  pib_total_mm_usd?: number
  pib_per_capita_usd?: number
}

const munis = masterMunisRaw as Record<string, MasterMuniRecord>
const states = masterStatesRaw as Record<string, MasterStateRecord>

type NumericMuniField = keyof Omit<MasterMuniRecord, 'id' | 'external_id' | 'name' | 'parent_iso' | 'parent_state' | 'capital'>
type NumericStateField = keyof Omit<MasterStateRecord, 'iso' | 'name' | 'muni_count'>

function muniField(field: NumericMuniField): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [sid, m] of Object.entries(munis)) {
    const v = m[field]
    if (typeof v === 'number') out[sid] = v
  }
  return out
}

function stateField(field: NumericStateField): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [iso, s] of Object.entries(states)) {
    const v = s[field]
    if (typeof v === 'number') out[iso] = v
  }
  return out
}

// ─── Tipo público ─────────────────────────────────────────────────────────

export type IndicatorAggregation = 'state' | 'municipality'

export type Indicator = {
  id: string
  label: string
  description: string
  unit: string
  format: 'number' | 'decimal' | 'rate' | 'currency'
  year: number
  source: string
  note?: string
  aggregation: IndicatorAggregation
  // Cuando aggregation='state': keyed por ISO (ej. VE-V).
  // Cuando aggregation='municipality': keyed por sourceID del muni.
  data: Record<string, number>
  // Solo para aggregation='municipality': agregado por ISO, precomputado.
  stateAggregate?: Record<string, number>
  // Para nivel país: cómo agregar los valores estatales.
  // 'sum' (default): suma — sirve para Población, Área, PIB total
  // 'mean': promedio — sirve para IDH, tasas, ratios
  nationalAggregation?: 'sum' | 'mean'
  // Si true, los munis sin data específica heredan el stateAggregate del
  // estado padre. Sin esta flag, quedan gris (honestidad de datos).
  inheritFromState?: boolean
}

// ─── Indicadores del master (data trazada) ────────────────────────────────

const POBLACION_INE_2026: Indicator = {
  id: 'poblacion_ine_2026',
  label: 'Población 2026',
  description: 'Proyección oficial INE basada en censo 2011',
  unit: 'habitantes',
  format: 'number',
  year: 2026,
  source: 'INE Venezuela (proyecciones)',
  note: 'Lara, Nueva Esparta y Dep. Federales sin desglose municipal en la publicación INE',
  aggregation: 'municipality',
  data: muniField('poblacion_2026'),
  stateAggregate: stateField('poblacion_2026'),
}

const POBLACION_INE_2050: Indicator = {
  id: 'poblacion_ine_2050',
  label: 'Proyección 2050',
  description: 'Proyección poblacional al año 2050 del INE',
  unit: 'habitantes',
  format: 'number',
  year: 2050,
  source: 'INE Venezuela (proyecciones)',
  note: 'Proyección de largo plazo · referencia censo 2011',
  aggregation: 'municipality',
  data: muniField('poblacion_2050'),
  stateAggregate: stateField('poblacion_2050'),
}

const POBLACION_2021: Indicator = {
  id: 'poblacion_wiki_2021',
  label: 'Población 2021',
  description: 'Población municipal según INE 2021',
  unit: 'habitantes',
  format: 'number',
  year: 2021,
  source: 'INE 2021 (vía Wikipedia / planilla del proyecto)',
  aggregation: 'municipality',
  data: muniField('poblacion_2021'),
  stateAggregate: stateField('poblacion_2021'),
}

const AREA: Indicator = {
  id: 'area_wiki',
  label: 'Área',
  description: 'Superficie territorial',
  unit: 'km²',
  format: 'number',
  year: 2021,
  source: 'INE 2021 / IGVSB',
  aggregation: 'municipality',
  data: muniField('area_km2'),
  stateAggregate: stateField('area_km2'),
}

const DENSIDAD: Indicator = {
  id: 'densidad_wiki',
  label: 'Densidad',
  description: 'Habitantes por km²',
  unit: 'hab/km²',
  format: 'rate',
  year: 2021,
  source: 'INE 2021 (calculado pob / área)',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muniField('densidad'),
  stateAggregate: stateField('densidad'),
}

// Los siguientes vienen del CSV sintético original — eran la única fuente
// disponible para PIB/IDH municipal en Venezuela. Marcamos honestamente que
// son estimaciones, y la cobertura es parcial (~46% de los munis).

const IDH: Indicator = {
  id: 'idh_2026',
  label: 'IDH (estimado)',
  description: 'Índice de Desarrollo Humano municipal estimado',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 2026,
  source: 'Estimaciones del proyecto (sintético)',
  note: 'Cobertura parcial · no hay fuente oficial pública de IDH municipal en Venezuela',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muniField('idh'),
  stateAggregate: stateField('idh'),
}

const PIB_TOTAL: Indicator = {
  id: 'pib_total',
  label: 'PIB total (estimado)',
  description: 'Producto Interno Bruto total estimado',
  unit: 'MM USD',
  format: 'number',
  year: 2026,
  source: 'Estimaciones del proyecto (sintético)',
  note: 'Cobertura parcial · BCV no publica cuentas regionales municipales',
  aggregation: 'municipality',
  data: muniField('pib_total_mm_usd'),
  stateAggregate: stateField('pib_total_mm_usd'),
}

const PIB_PER_CAPITA: Indicator = {
  id: 'pib_per_capita',
  label: 'PIB per cápita (estimado)',
  description: 'PIB por habitante estimado',
  unit: 'USD',
  format: 'currency',
  year: 2026,
  source: 'Estimaciones del proyecto (sintético)',
  note: 'Cobertura parcial · no hay fuente oficial pública de PIB municipal',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muniField('pib_per_capita_usd'),
  stateAggregate: stateField('pib_per_capita_usd'),
}

// ─── Indicadores estatales (hardcoded, no viven en el master) ─────────────

const POBLACION_2024: Indicator = {
  id: 'poblacion_2024',
  label: 'Población 2024 · est. estatal',
  description: 'Aproximación estatal preexistente — números redondos',
  unit: 'habitantes',
  format: 'number',
  year: 2024,
  source: 'Estimaciones preexistentes (aproximación estatal)',
  note: 'Aproximaciones redondas · ver Población 2026 para data oficial',
  aggregation: 'state',
  data: {
    'VE-A': 1_900_000, 'VE-B': 1_500_000, 'VE-C': 550_000, 'VE-D': 1_500_000,
    'VE-E': 850_000, 'VE-F': 1_400_000, 'VE-G': 2_300_000, 'VE-H': 350_000,
    'VE-Y': 180_000, 'VE-W': 3_000, 'VE-I': 950_000, 'VE-J': 750_000,
    'VE-X': 350_000, 'VE-K': 1_800_000, 'VE-L': 900_000, 'VE-M': 2_700_000,
    'VE-N': 950_000, 'VE-O': 500_000, 'VE-P': 900_000, 'VE-R': 850_000,
    'VE-S': 1_200_000, 'VE-T': 700_000, 'VE-U': 600_000, 'VE-V': 3_700_000,
    'VE-Z': 180_000, 'VE-GE': 130_000,
  },
}

const HOMICIDIOS: Indicator = {
  id: 'homicidios',
  label: 'Tasa de homicidios',
  description: 'Homicidios por cada 100.000 habitantes',
  unit: 'por 100k',
  format: 'rate',
  year: 2023,
  source: 'OVV (Observatorio Venezolano de Violencia)',
  note: 'Datos ilustrativos · referencia OVV 2023',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: {
    'VE-A': 36, 'VE-B': 27, 'VE-C': 25, 'VE-D': 41, 'VE-E': 18, 'VE-F': 49,
    'VE-G': 32, 'VE-H': 16, 'VE-Y': 23, 'VE-W': 5, 'VE-I': 20, 'VE-J': 28,
    'VE-X': 18, 'VE-K': 23, 'VE-L': 14, 'VE-M': 30, 'VE-N': 27, 'VE-O': 17,
    'VE-P': 17, 'VE-R': 38, 'VE-S': 17, 'VE-T': 16, 'VE-U': 16, 'VE-V': 25,
    'VE-Z': 22, 'VE-GE': 22,
  },
}

// ─── Catálogo público ─────────────────────────────────────────────────────

export const INDICATORS: Indicator[] = [
  POBLACION_INE_2026,
  POBLACION_INE_2050,
  POBLACION_2021,
  AREA,
  DENSIDAD,
  IDH,
  PIB_PER_CAPITA,
  PIB_TOTAL,
  POBLACION_2024,
  HOMICIDIOS,
]

// Mapeo de IDs deprecados → IDs canónicos. Mantiene retro-compatibilidad
// con la persistencia (localStorage) de users que tenían seleccionados
// indicadores que ya no existen como separados.
//   poblacion_2026 era el sintético → ahora apunta a la versión INE
//   area_km2 era el sintético       → ahora apunta a Área (Excel/Wiki)
const LEGACY_ID_ALIAS: Record<string, string> = {
  poblacion_2026: 'poblacion_ine_2026',
  area_km2: 'area_wiki',
}

export function getIndicator(id: string): Indicator | undefined {
  const canonical = LEGACY_ID_ALIAS[id] ?? id
  return INDICATORS.find(i => i.id === canonical)
}

// ─── Cobertura del indicador a un nivel dado ──────────────────────────────
// Sirve para mostrar en la UI si el indicador aplica al nivel actual y
// cuántas entidades quedan sin data. Se calcula en O(N) sobre las keys del
// indicator.data — barato porque son al sumo ~340 entradas.

export type IndicatorCoverage = {
  covered: number       // entidades con valor numérico
  total: number         // total de entidades a ese nivel (estados=26 o munis=336)
  missing: number       // total - covered
  applies: boolean      // si el indicador es informativo al nivel actual
  reason?: string       // si no aplica, explicación corta
}

export function getIndicatorCoverage(
  indicator: Indicator,
  level: 'adm0' | 'adm1' | 'adm2',
  totals: { adm1Count: number; adm2Count: number },
): IndicatorCoverage {
  // País: siempre 1 valor (un agregado nacional), no tiene sentido medir
  // cobertura. Aplica.
  if (level === 'adm0') {
    return { covered: 1, total: 1, missing: 0, applies: true }
  }

  if (level === 'adm1') {
    // En vista estados, contamos contra los 26 estados.
    // state aggregation -> usa indicator.data directo
    // municipality aggregation -> usa stateAggregate precomputado
    const data =
      indicator.aggregation === 'state'
        ? indicator.data
        : (indicator.stateAggregate ?? {})
    const covered = Object.values(data).filter(v => typeof v === 'number').length
    return {
      covered,
      total: totals.adm1Count,
      missing: totals.adm1Count - covered,
      applies: true,
    }
  }

  // level === 'adm2' (municipios)
  if (indicator.aggregation === 'state') {
    // Un indicador estatal puede heredarse a sus munis (todos del mismo
    // estado quedan del mismo color), pero eso no es informativo a nivel muni.
    // Lo marcamos como "no aplica" para que la UI lo deshabilite.
    return {
      covered: 0,
      total: totals.adm2Count,
      missing: totals.adm2Count,
      applies: false,
      reason: 'Solo a nivel estado',
    }
  }
  const covered = Object.values(indicator.data).filter(v => typeof v === 'number').length
  return {
    covered,
    total: totals.adm2Count,
    missing: totals.adm2Count - covered,
    applies: true,
  }
}

export function formatIndicatorValue(value: number, indicator: Indicator): string {
  if (indicator.format === 'decimal') return value.toFixed(3)
  if (indicator.format === 'rate') return value.toFixed(1)
  if (indicator.format === 'currency') {
    return value.toLocaleString('es-VE', { maximumFractionDigits: 0 })
  }
  // number
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(2) + ' M'
  if (value >= 1_000) return value.toLocaleString('es-VE', { maximumFractionDigits: 0 })
  return value.toLocaleString('es-VE', { maximumFractionDigits: 1 })
}
