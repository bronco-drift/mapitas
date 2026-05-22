import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CSV_PATH = join(ROOT, 'raw-sources', 'municipios_venezuela_2026.csv')
const ADM2_PATH = join(ROOT, 'data', 'venezuela-adm2-enriched.geojson')
const OUT_PATH = join(ROOT, 'app', 'src', 'data', 'municipal-indicators.json')

function normalize(str) {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Mini CSV parser: respeta comas dentro de comillas
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

console.log('Leyendo CSV...')
const csvText = readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '')
const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0)
const headers = parseCsvLine(lines[0])
const rows = lines.slice(1).map(line => {
  const cols = parseCsvLine(line)
  return Object.fromEntries(headers.map((h, i) => [h, cols[i]]))
})
console.log(`  ${rows.length} filas leídas`)

console.log('Leyendo ADM2 enriquecido...')
const adm2 = JSON.parse(readFileSync(ADM2_PATH, 'utf8'))

// Índices del GeoJSON
const muniByCompound = {}
const muniBySourceID = {}
const muniByParentISO = {}
const munisByParentState = {} // estadoKey → [muniProps...]
for (const f of adm2.features) {
  const { compoundKey, sourceID, parentISO, parentStateKey } = f.properties
  if (compoundKey) muniByCompound[compoundKey] = f.properties
  muniBySourceID[sourceID] = f.properties
  if (parentISO) {
    muniByParentISO[parentISO] = muniByParentISO[parentISO] ?? []
    muniByParentISO[parentISO].push(f.properties)
  }
  if (parentStateKey) {
    munisByParentState[parentStateKey] = munisByParentState[parentStateKey] ?? []
    munisByParentState[parentStateKey].push(f.properties)
  }
}

// Fuzzy match: dentro del mismo estado, busca un muni cuyo nameKey contenga
// o esté contenido en el muniKey del CSV. Maneja prefijos como "Autónomo",
// "Francisco del Carmen", honoríficos, etc.
function compact(s) {
  return s.replace(/\s+/g, '').replace(/^mc/, 'mac')
}

function editDistance1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  if (a === b) return true
  // Levenshtein con cap=1: cualquier diferencia mayor a 1 → false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length === b.length) { i++; j++ }
    else if (a.length > b.length) i++
    else j++
  }
  edits += (a.length - i) + (b.length - j)
  return edits <= 1
}

function fuzzyMatchInState(estadoKey, muniKey, used) {
  const candidates = (munisByParentState[estadoKey] ?? []).filter(
    c => !used.has(c.sourceID),
  )
  const tooGeneric = new Set(['general', 'distrito', 'municipio', 'autonomo'])
  const muniCompact = compact(muniKey)

  // 1) CSV corto contenido en GeoJSON largo (ej. "bruzual" ⊂ "manuel ezequiel bruzual")
  let hit = candidates.find(c => {
    const g = c.nameKey
    return g.includes(muniKey) && muniKey.length >= 4 && !tooGeneric.has(muniKey)
  })
  if (hit) return hit
  // 2) GeoJSON corto contenido en CSV largo
  hit = candidates.find(c => {
    const g = c.nameKey
    return muniKey.includes(g) && g.length >= 4 && !tooGeneric.has(g)
  })
  if (hit) return hit
  // 3) Sin espacios (ej. "mcgregor" vs "mac gregor")
  hit = candidates.find(c => {
    const gC = compact(c.nameKey)
    return gC.length >= 5 && muniCompact.length >= 5 && (gC.includes(muniCompact) || muniCompact.includes(gC))
  })
  if (hit) return hit
  // 4) Edit distance 1 (ej. "urbaneja" vs "urbanejo")
  hit = candidates.find(c => muniKey.length >= 5 && editDistance1(c.nameKey, muniKey))
  if (hit) return hit
  return null
}

// Mapeo estado nombre → ISO (a través del primer municipio del estado)
const stateNameToISO = {}
for (const [iso, munis] of Object.entries(muniByParentISO)) {
  const stateName = munis[0]?.parentState
  if (stateName) stateNameToISO[normalize(stateName)] = iso
}

const num = v => {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(/[,]/g, ''))
  return Number.isFinite(n) ? n : null
}

const indicators = {
  poblacion_2026: {},
  area_km2: {},
  pib_total_mm_usd: {},
  pib_per_capita_usd: {},
  idh_2026: {},
}

// Para agregados estatales: acumular SIEMPRE (matchee o no), basado en columna Estado
const stateAccum = {}
function accumState(iso, pop, area, pib, ppc, idh) {
  stateAccum[iso] = stateAccum[iso] ?? {
    pop: 0, area: 0, pib: 0, weightedPpcNum: 0, weightedIdhNum: 0, totalPopForWeights: 0,
  }
  const s = stateAccum[iso]
  if (pop != null) s.pop += pop
  if (area != null) s.area += area
  if (pib != null) s.pib += pib
  if (pop != null && ppc != null) {
    s.weightedPpcNum += pop * ppc
    s.totalPopForWeights += pop
  }
  if (pop != null && idh != null) {
    s.weightedIdhNum += pop * idh
  }
}

let matched = 0
const unmatched = []
const fuzzyMatches = []
const usedSourceIDs = new Set()

for (const row of rows) {
  const estadoRaw = row['Estado']
  const muniRaw = row['Municipio']
  const pop = num(row['Población Estimada (2026)'])
  const area = num(row['Área (km²)'])
  const pib = num(row['PIB Total (MM USD Est)'])
  const ppc = num(row['PIB Per Cápita (USD Est)'])
  const idh = num(row['IDH Estimado'])

  const estadoKey = normalize(estadoRaw)
  const muniKey = normalize(muniRaw)
  const iso = stateNameToISO[estadoKey]

  // Acumular en agregado estatal (incluso si el muni no matchea — placeholder rows)
  if (iso) accumState(iso, pop, area, pib, ppc, idh)

  // Intentar match por compoundKey, luego fuzzy en el estado
  const compound = `${estadoKey}__${muniKey}`
  let muni = muniByCompound[compound]
  let matchType = 'exact'
  if (muni && usedSourceIDs.has(muni.sourceID)) muni = null
  if (!muni) {
    muni = fuzzyMatchInState(estadoKey, muniKey, usedSourceIDs)
    matchType = muni ? 'fuzzy' : 'none'
  }

  if (muni) {
    matched++
    usedSourceIDs.add(muni.sourceID)
    if (matchType === 'fuzzy') fuzzyMatches.push({ csv: `${estadoRaw} / ${muniRaw}`, geo: muni.name })
    if (pop != null) indicators.poblacion_2026[muni.sourceID] = pop
    if (area != null) indicators.area_km2[muni.sourceID] = area
    if (pib != null) indicators.pib_total_mm_usd[muni.sourceID] = pib
    if (ppc != null) indicators.pib_per_capita_usd[muni.sourceID] = ppc
    if (idh != null) indicators.idh_2026[muni.sourceID] = idh
  } else {
    unmatched.push({ estado: estadoRaw, municipio: muniRaw, compound })
  }
}

// Agregados estatales finales (sumas + promedios ponderados)
const stateAggregates = {
  poblacion_2026: {},
  area_km2: {},
  pib_total_mm_usd: {},
  pib_per_capita_usd: {},
  idh_2026: {},
}
for (const [iso, s] of Object.entries(stateAccum)) {
  stateAggregates.poblacion_2026[iso] = s.pop
  stateAggregates.area_km2[iso] = s.area
  stateAggregates.pib_total_mm_usd[iso] = s.pib
  stateAggregates.pib_per_capita_usd[iso] = s.totalPopForWeights > 0 ? s.weightedPpcNum / s.totalPopForWeights : null
  stateAggregates.idh_2026[iso] = s.totalPopForWeights > 0 ? s.weightedIdhNum / s.totalPopForWeights : null
}

// Espejado VE-Y (Delta Amacuro) → VE-GE (Guayana Esequiba) cuando el CSV no
// trae datos para el Esequibo. Es la entidad más comparable: frontera,
// indígenas, baja densidad, contigua geográficamente.
let mirroredFromDeltaAmacuro = false
for (const key of Object.keys(stateAggregates)) {
  if (stateAggregates[key]['VE-GE'] == null && stateAggregates[key]['VE-Y'] != null) {
    stateAggregates[key]['VE-GE'] = stateAggregates[key]['VE-Y']
    mirroredFromDeltaAmacuro = true
  }
}

// También espejar al muni Esequibo. Como en el GeoJSON el estado se representa
// como un único municipio (no hay subdivisión oficial reconocida), le asignamos
// los mismos valores del agregado estatal (que ya fue espejado de VE-Y).
const esequiboMuni = adm2.features.find(f => f.properties.parentISO === 'VE-GE')
if (esequiboMuni) {
  const sourceID = esequiboMuni.properties.sourceID
  for (const key of Object.keys(indicators)) {
    const stateVal = stateAggregates[key]['VE-GE']
    if (stateVal != null && indicators[key][sourceID] == null) {
      indicators[key][sourceID] = stateVal
    }
  }
  console.log(`Esequibo muni espejado desde agregado estatal VE-GE`)
}

// Para municipios no matcheados (nombres placeholder), inyectar el valor del agregado estatal
// para que igual reciban color al pintar nivel municipios.
let inherited = 0
for (const f of adm2.features) {
  const sourceID = f.properties.sourceID
  const parentISO = f.properties.parentISO
  if (!parentISO) continue
  for (const key of ['poblacion_2026','area_km2','pib_total_mm_usd','pib_per_capita_usd','idh_2026']) {
    if (indicators[key][sourceID] == null) {
      const stateVal = stateAggregates[key][parentISO]
      if (stateVal != null) {
        // No sobrescribir: solo marcar como heredado. Usamos un objeto separado.
      }
    }
  }
}

// Para herencia, NO modificamos el indicador municipal — eso lo decide el frontend
// según presencia de data[sourceID]. Solo exportamos los datos crudos.

mkdirSync(dirname(OUT_PATH), { recursive: true })
const output = {
  version: 1,
  source: 'municipios_venezuela_2026.csv',
  generatedAt: new Date().toISOString(),
  stats: {
    totalRows: rows.length,
    matchedMunis: matched,
    unmatchedMunis: unmatched.length,
    statesCovered: Object.keys(stateAccum).length,
  },
  indicators,
  stateAggregates,
  unmatched: unmatched.slice(0, 30),
}

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))

console.log('')
console.log('=== Resumen ===')
console.log(`Matched: ${matched} de ${rows.length} filas`)
console.log(`   exactos: ${matched - fuzzyMatches.length}`)
console.log(`   fuzzy: ${fuzzyMatches.length}`)
console.log(`Unmatched: ${unmatched.length}`)
console.log(`Estados cubiertos por agregados: ${Object.keys(stateAccum).length} de 26`)
console.log(`Esequibo espejado desde Delta Amacuro: ${mirroredFromDeltaAmacuro ? 'sí' : 'no (ya tenía datos)'}`)
console.log('')
if (fuzzyMatches.length > 0) {
  console.log('Sample fuzzy matches:')
  fuzzyMatches.slice(0, 10).forEach(f => console.log(`  - ${f.csv} → ${f.geo}`))
  console.log('')
}
console.log('Top 10 unmatched:')
unmatched.slice(0, 10).forEach(u => console.log('  -', u.compound))
console.log('')
console.log(`Archivo generado: ${OUT_PATH}`)
