import municipalData from './municipal-indicators.json'

// Indicadores pre-cargados. Pueden ser:
//   - 'state': data keyed por código ISO 3166-2. Estado-nivel; al ver municipios
//     se hereda al parentISO.
//   - 'municipality': data keyed por sourceID del muni. Trae también
//     stateAggregate por ISO (sum / promedio ponderado) para la vista estatal.

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
}

// ---- Indicadores estatales (legacy, aproximaciones) ----

const POBLACION_2024: Indicator = {
  id: 'poblacion_2024',
  label: 'Población (estado)',
  description: 'Población total estimada por entidad',
  unit: 'habitantes',
  format: 'number',
  year: 2024,
  source: 'INE Venezuela (proyecciones)',
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

// ---- Indicadores municipales (CSV 2026) ----

type MunicipalJson = {
  indicators: Record<string, Record<string, number>>
  stateAggregates: Record<string, Record<string, number>>
}
const muni = municipalData as MunicipalJson

const POBLACION_2026: Indicator = {
  id: 'poblacion_2026',
  label: 'Población 2026',
  description: 'Población estimada por municipio',
  unit: 'habitantes',
  format: 'number',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  data: muni.indicators.poblacion_2026,
  stateAggregate: muni.stateAggregates.poblacion_2026,
}

const AREA: Indicator = {
  id: 'area_km2',
  label: 'Área',
  description: 'Superficie territorial',
  unit: 'km²',
  format: 'number',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  aggregation: 'municipality',
  data: muni.indicators.area_km2,
  stateAggregate: muni.stateAggregates.area_km2,
}

const PIB_TOTAL: Indicator = {
  id: 'pib_total',
  label: 'PIB total',
  description: 'Producto Interno Bruto total estimado',
  unit: 'MM USD',
  format: 'number',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  data: muni.indicators.pib_total_mm_usd,
  stateAggregate: muni.stateAggregates.pib_total_mm_usd,
}

const PIB_PER_CAPITA: Indicator = {
  id: 'pib_per_capita',
  label: 'PIB per cápita',
  description: 'PIB por habitante estimado',
  unit: 'USD',
  format: 'currency',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muni.indicators.pib_per_capita_usd,
  stateAggregate: muni.stateAggregates.pib_per_capita_usd,
}

const IDH_2026: Indicator = {
  id: 'idh_2026',
  label: 'IDH 2026',
  description: 'Índice de Desarrollo Humano municipal estimado',
  unit: 'índice 0–1',
  format: 'decimal',
  year: 2026,
  source: 'Estimaciones municipales 2026',
  note: 'Datos estimados · validar contra fuente oficial',
  aggregation: 'municipality',
  nationalAggregation: 'mean',
  data: muni.indicators.idh_2026,
  stateAggregate: muni.stateAggregates.idh_2026,
}

export const INDICATORS: Indicator[] = [
  POBLACION_2026,
  IDH_2026,
  PIB_PER_CAPITA,
  PIB_TOTAL,
  AREA,
  POBLACION_2024,
  HOMICIDIOS,
]

export function getIndicator(id: string): Indicator | undefined {
  return INDICATORS.find(i => i.id === id)
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
