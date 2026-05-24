// Estimación de PIB municipal y estatal venezolano por metodología Mapitas.
//
// El BCV no publica cuentas regionales (estados/munis). Las únicas
// estimaciones documentadas son trabajos académicos puntuales (ej. UCAB
// con ENCOVI + censo 2011 + ajustes CEPAL). Acá implementamos un modelo
// reproducible para los 335 munis usando solo proxies que sí tenemos
// con cobertura completa.
//
// METODOLOGÍA
//
// Para cada muni se calcula un "peso económico" relativo combinando 4
// factores. El PIB nacional (parámetro PIB_NACIONAL_USD_MM) se distribuye
// entre los munis proporcional a esos pesos.
//
//   peso_muni = poblacion × f_urbano × f_idh × f_sector
//
//   1. población — proxy directo del tamaño económico
//   2. f_urbano — actividad económica formal correlaciona con urbanidad
//   3. f_idh — desarrollo del estado donde está el muni (proxy de
//      productividad / acceso a servicios)
//   4. f_sector — peso por estado según sector económico dominante
//      (capital nacional, petróleo, minería, industria)
//
// El f_sector es la parte subjetiva del modelo — está basado en
// conocimiento general de la economía venezolana, no en datos del BCV
// (que no los publica). Es lo que permite que Caracas concentre ~40%
// del PIB nacional como en la realidad observada.
//
// LIMITACIONES HONESTAS
//
//   - Todos los munis dentro de un mismo estado petrolero llevan el
//     mismo f_sector. No diferenciamos los munis donde efectivamente
//     hay refinerías o pozos vs los que no.
//   - PIB_NACIONAL_USD_MM es un parámetro (default 100B). Las
//     estimaciones del FMI/BM/FocusEconomics varían entre $80B y $130B
//     para Venezuela 2024-2026. Si cambia, ajustar la constante y
//     reflota.
//   - Munis con población muy chica (Esequibo, Dep. Federales) reciben
//     PIB proporcional pero los valores absolutos son inciertos.
//
// REGENERAR
//
// Es código TypeScript ejecutado al import (no script offline). Si se
// cambia PIB_NACIONAL_USD_MM o cualquier peso, recompilá la app:
//   `npm run build`

import masterMunisRaw from './master-municipalities.json'
import masterStatesRaw from './master-states.json'

type MuniRecord = {
  id: string
  parent_iso: string
  poblacion_2021?: number
  porcentaje_urbano_2021?: number
}
type StateRecord = {
  iso: string
  idh?: number
}

const munis = masterMunisRaw as Record<string, MuniRecord>
const states = masterStatesRaw as Record<string, StateRecord>

// PIB nacional venezolano de referencia. Punto medio de estimaciones FMI/BM
// 2024-2026 (~$80B-$130B USD). Parametrizable: si cambian las estimaciones,
// modificar acá y reflotar.
export const PIB_NACIONAL_USD_MM = 100_000

// Factor sectorial por estado. Refleja sectores económicos dominantes que
// el modelo demográfico-IDH no captura: hidrocarburos, minería pesada,
// industria automotriz/química, concentración metropolitana.
//
// Sin datos del BCV estos pesos son juicios cualitativos basados en:
// - estados petroleros conocidos (PDVSA opera en Zulia, Anzoátegui,
//   Monagas, Falcón)
// - estado minero-siderúrgico (Bolívar: SIDOR, hierro, oro)
// - estados industriales históricos (Carabobo: Valencia automotriz;
//   Aragua: Maracay manufactura)
// - concentración metropolitana (Distrito Capital + ejes de servicios:
//   Miranda y La Guaira)
// Pesos calibrados para que Caracas-area (DC + Miranda + La Guaira) llegue
// a ~37% del PIB nacional (cerca del ~40% real observado en la literatura).
// PIB per cápita resultante de Libertador (Caracas): ~$10.700, coherente.
const SECTOR_WEIGHTS: Record<string, number> = {
  'VE-A': 4.50, // Distrito Capital — gobierno + servicios + comercio premium
  'VE-M': 1.80, // Miranda — zona metropolitana Caracas (Altos, Petare, Baruta)
  'VE-X': 1.60, // La Guaira — puerto + costa metropolitana
  'VE-V': 1.55, // Zulia — petróleo (Cuenca del Maracaibo)
  'VE-B': 1.50, // Anzoátegui — petróleo (Faja del Orinoco norte)
  'VE-N': 1.45, // Monagas — petróleo (Faja del Orinoco norte-este)
  'VE-I': 1.40, // Falcón — refinería Paraguaná + petróleo
  'VE-F': 1.35, // Bolívar — minería + acero (SIDOR, hierro, oro)
  'VE-G': 1.35, // Carabobo — industria automotriz, química, puerto
  'VE-S': 1.20, // Táchira — comercio fronterizo Colombia
  'VE-D': 1.20, // Aragua — industria manufacturera (Maracay)
  'VE-O': 1.10, // Nueva Esparta — turismo (Margarita)
  'VE-W': 0.80, // Dep. Federales — sin actividad económica significativa
  'VE-GE': 0.80, // Esequibo — actividad limitada (territorio reclamado)
}

// Función f_urbano: el % de población en cabecera correlaciona con
// actividad económica formal. Más urbano → más servicios, comercio,
// industria. Más rural → más agricultura de subsistencia o informalidad.
function fUrbano(porcentaje: number | undefined): number {
  if (porcentaje == null) return 1.0
  if (porcentaje >= 80) return 1.30
  if (porcentaje >= 50) return 1.10
  if (porcentaje >= 30) return 0.95
  return 0.80
}

// Función f_idh: normaliza el IDH del estado al rango [0.85, 1.15] para
// usarlo como multiplicador. IDH bajo (~0.65) → 0.85; IDH alto (~0.80)
// → 1.15. Da algo de variabilidad por desarrollo sin dominar la fórmula.
function fIdh(idhEstado: number | undefined): number {
  if (idhEstado == null) return 1.0
  const IDH_MIN = 0.65
  const IDH_MAX = 0.80
  const clipped = Math.max(IDH_MIN, Math.min(IDH_MAX, idhEstado))
  const t = (clipped - IDH_MIN) / (IDH_MAX - IDH_MIN) // 0 a 1
  return 0.85 + t * (1.15 - 0.85) // 0.85 a 1.15
}

function fSector(iso: string): number {
  return SECTOR_WEIGHTS[iso] ?? 1.0
}

// Calcula peso económico de un muni. Si falta población, peso 0 (no
// distribuye PIB a munis sin datos).
function pesoEconomicoMuni(sid: string): number {
  const m = munis[sid]
  if (!m || !m.poblacion_2021) return 0
  const s = states[m.parent_iso]
  return (
    m.poblacion_2021 *
    fUrbano(m.porcentaje_urbano_2021) *
    fIdh(s?.idh) *
    fSector(m.parent_iso)
  )
}

// Calcula y exporta el PIB municipal y estatal estimado.
function computeMapitasPIB() {
  // 1) Peso de cada muni
  const pesos: Record<string, number> = {}
  let totalPesos = 0
  for (const sid of Object.keys(munis)) {
    const peso = pesoEconomicoMuni(sid)
    pesos[sid] = peso
    totalPesos += peso
  }

  // 2) PIB muni en MM USD (distribución del nacional)
  const pibMunicipalMM: Record<string, number> = {}
  for (const [sid, peso] of Object.entries(pesos)) {
    if (peso > 0) {
      pibMunicipalMM[sid] = (peso / totalPesos) * PIB_NACIONAL_USD_MM
    }
  }

  // 3) PIB per cápita muni en USD
  const pibPerCapitaMuni: Record<string, number> = {}
  for (const [sid, pibMM] of Object.entries(pibMunicipalMM)) {
    const pob = munis[sid]?.poblacion_2021
    if (pob && pob > 0) {
      pibPerCapitaMuni[sid] = (pibMM * 1_000_000) / pob
    }
  }

  // 4) PIB estatal = suma de PIB de munis del estado
  const pibEstatalMM: Record<string, number> = {}
  const pobEstatalPorMunis: Record<string, number> = {}
  for (const [sid, pibMM] of Object.entries(pibMunicipalMM)) {
    const iso = munis[sid]?.parent_iso
    if (!iso) continue
    pibEstatalMM[iso] = (pibEstatalMM[iso] ?? 0) + pibMM
    pobEstatalPorMunis[iso] =
      (pobEstatalPorMunis[iso] ?? 0) + (munis[sid]?.poblacion_2021 ?? 0)
  }

  // 5) PIB per cápita estatal en USD
  const pibPerCapitaEstatal: Record<string, number> = {}
  for (const [iso, pibMM] of Object.entries(pibEstatalMM)) {
    const pob = pobEstatalPorMunis[iso]
    if (pob > 0) {
      pibPerCapitaEstatal[iso] = (pibMM * 1_000_000) / pob
    }
  }

  return { pibMunicipalMM, pibPerCapitaMuni, pibEstatalMM, pibPerCapitaEstatal }
}

const result = computeMapitasPIB()

export const PIB_MAPITAS_MUNICIPAL_MM = result.pibMunicipalMM
export const PIB_MAPITAS_PER_CAPITA_MUNI = result.pibPerCapitaMuni
export const PIB_MAPITAS_ESTATAL_MM = result.pibEstatalMM
export const PIB_MAPITAS_PER_CAPITA_ESTATAL = result.pibPerCapitaEstatal
