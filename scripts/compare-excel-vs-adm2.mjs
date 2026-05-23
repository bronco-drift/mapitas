// Cruza el TSV que pegó el user (excel-municipios-2021.tsv) contra el adm2.
// Reporta por estado:
//   - munis en Excel que no están en adm2  (gaps reales del shapefile)
//   - munis en adm2 que no están en Excel  (sobrantes — duplicados o extras)
//   - matched
// Y exporta el diff a JSON.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TSV_PATH = join(ROOT, 'data', 'excel-municipios-2021.tsv')
const ADM2_PATH = join(ROOT, 'app', 'public', 'data', 'venezuela-adm2-enriched.geojson')

// Excel usa "Vargas" como estado pero adm2 usa "La Guaira"
const STATE_ALIAS = {
  Vargas: 'La Guaira',
  'Zona en Reclamación': 'Zona en Reclamación', // se ignora
}

function normalize(s) {
  let v = String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

  // Limpiar sufijos "- Estado" que el Excel usa para desambiguar homónimos
  // (ej. "Bolívar - Aragua" → "Bolívar")
  v = v.replace(/\s*[-–]\s*[a-z\s]+$/i, '')

  const STRIP_PREFIX = [
    'autonomo', 'general', 'sir', 'lic.', 'lic', 'dr.', 'dr', 'doctor',
    'bolivariano', 'bolivariana', 'indigena', 'indígena',
    'municipio', 'el', 'la', 'los', 'las',
    'de la', 'de los', 'del', 'de',
  ]
  let changed = true
  while (changed) {
    changed = false
    for (const p of STRIP_PREFIX) {
      const re = new RegExp(`^${p}\\s+`, 'i')
      if (re.test(v)) {
        v = v.replace(re, '')
        changed = true
      }
    }
  }
  return v.replace(/[^a-z0-9]+/g, '')
}

// Parse TSV
const tsv = readFileSync(TSV_PATH, 'utf8')
const lines = tsv.split(/\r?\n/).filter(l => l.trim())
const excelMunis = []
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t')
  const muni = cols[0]?.trim()
  const capital = cols[1]?.trim()
  const estadoRaw = cols[2]?.trim()
  const pob2021 = cols[3]?.trim()
  const sup = cols[5]?.trim()
  const dens = cols[6]?.trim()
  if (!muni) continue
  const estado = STATE_ALIAS[estadoRaw] ?? estadoRaw
  excelMunis.push({
    raw: muni,
    norm: normalize(muni),
    capital,
    estado,
    estadoRaw,
    pob2021,
    sup,
    dens,
  })
}
console.log(`Excel: ${excelMunis.length} filas (incluye "Zona en Reclamación" si está)`)

// Cargar adm2 y agrupar por estado
const adm2 = JSON.parse(readFileSync(ADM2_PATH, 'utf8'))
const adm2ByState = {}
for (const f of adm2.features) {
  const state = f.properties.parentState
  if (!state) continue
  if (!adm2ByState[state]) adm2ByState[state] = []
  adm2ByState[state].push({
    sourceID: f.properties.sourceID,
    name: f.properties.name,
    norm: normalize(f.properties.name),
    normOficial: normalize(f.properties.nombreOficial ?? ''),
  })
}
const totalAdm2 = adm2.features.filter(f => f.properties.parentState).length
console.log(`adm2: ${totalAdm2} municipios (con parentState)\n`)

// Agrupar Excel por estado para comparación
const excelByState = {}
for (const e of excelMunis) {
  if (e.estado === 'Zona en Reclamación') continue
  if (!excelByState[e.estado]) excelByState[e.estado] = []
  excelByState[e.estado].push(e)
}

// Reportar diferencias por estado
const allStates = new Set([...Object.keys(excelByState), ...Object.keys(adm2ByState)])
const diffReport = {}

console.log('=== DIFF POR ESTADO ===\n')
let totalMatched = 0
let totalExcelOnly = 0
let totalAdm2Only = 0

for (const state of [...allStates].sort()) {
  const exc = excelByState[state] ?? []
  const adm = adm2ByState[state] ?? []

  // Match: para cada del Excel, buscar en adm2 por nombre normalizado
  const matched = []
  const excelOnly = []
  const adm2Matched = new Set()

  for (const e of exc) {
    const candidates = adm.filter(a => !adm2Matched.has(a.sourceID))
    let m = candidates.find(a => a.norm === e.norm)
    if (!m) m = candidates.find(a => a.normOficial === e.norm)
    if (!m)
      m = candidates.find(
        a =>
          (a.norm.length >= 4 && (a.norm.includes(e.norm) || e.norm.includes(a.norm))) ||
          (a.normOficial.length >= 4 &&
            (a.normOficial.includes(e.norm) || e.norm.includes(a.normOficial))),
      )

    if (m) {
      matched.push({ excel: e.raw, adm2: m.name, sourceID: m.sourceID })
      adm2Matched.add(m.sourceID)
    } else {
      excelOnly.push(e.raw)
    }
  }
  const adm2Only = adm.filter(a => !adm2Matched.has(a.sourceID)).map(a => a.name)

  totalMatched += matched.length
  totalExcelOnly += excelOnly.length
  totalAdm2Only += adm2Only.length

  if (excelOnly.length || adm2Only.length) {
    console.log(`${state}  (Excel: ${exc.length} · adm2: ${adm.length} · matched: ${matched.length})`)
    if (excelOnly.length) console.log(`  Excel solo: ${excelOnly.join(' · ')}`)
    if (adm2Only.length) console.log(`  adm2 solo:  ${adm2Only.join(' · ')}`)
    console.log()
  }

  diffReport[state] = {
    excel_total: exc.length,
    adm2_total: adm.length,
    matched: matched.length,
    excel_only: excelOnly,
    adm2_only: adm2Only,
  }
}

console.log(`\n=== TOTALES ===`)
console.log(`Matched:    ${totalMatched}`)
console.log(`Solo Excel: ${totalExcelOnly}  (gaps reales del adm2)`)
console.log(`Solo adm2:  ${totalAdm2Only}   (posibles duplicados / extras en shapefile)`)

writeFileSync(join(ROOT, 'data', 'excel-vs-adm2-diff.json'), JSON.stringify(diffReport, null, 2))
console.log(`\nReporte completo: data/excel-vs-adm2-diff.json`)
