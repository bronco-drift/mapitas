// Consolida las 4 fuentes (Excel del user, Wikipedia HTML procesado, INE,
// CSV sintético) en un master único de municipios. Cada campo trazado a su
// fuente. Single source of truth para indicators.ts.
//
// Reglas de prevalencia por indicador (de mejor a peor calidad):
//   poblacion_2021  →  Excel  >  Wiki
//   poblacion_2026  →  INE
//   poblacion_2050  →  INE (proyección)
//   area_km2        →  Excel  >  Wiki  >  sintético
//   densidad        →  Excel  >  Wiki
//   capital         →  Excel  (única fuente)
//   idh             →  sintético  (única fuente, marcado como estimación)
//   pib_total       →  sintético  (idem)
//   pib_per_capita  →  sintético  (idem)
//
// Outputs:
//   data/master/municipalities.json   master indexed by sourceID con trace por campo
//   data/master/states.json           agregados estatales con trace
//   data/master/municipalities.csv    versión flat sin trace
//   data/master/states.csv            idem para estados
//   data/master/coverage-report.json  cobertura por indicador por estado

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const ADM2_PATH = join(ROOT, 'app', 'public', 'data', 'venezuela-adm2-enriched.geojson')
const ADM1_PATH = join(ROOT, 'app', 'public', 'data', 'venezuela-adm1-enriched.geojson')

const EXCEL_TSV = join(ROOT, 'data', 'excel-municipios-2021.tsv')
const WIKI_JSON = join(ROOT, 'data', 'sources', 'wiki-municipios.json')
const INE_MUNI = join(ROOT, 'data', 'sources', 'ine-population-municipalities.json')
const INE_STATE = join(ROOT, 'data', 'sources', 'ine-population-states.json')
const MUNICIPAL_CSV = join(ROOT, 'data', 'sources', 'municipal-indicators.json')
const SOURCE_CV = join(ROOT, 'data', 'sources', 'sourcecv.json')
const SPECIAL_OVERRIDES = join(ROOT, 'data', 'sources', 'special-entities-overrides.json')

const OUT_DIR = join(ROOT, 'data', 'master')
mkdirSync(OUT_DIR, { recursive: true })

// ─── Helpers unificados (normalize + aliases que estaban dispersos) ─────────

function normalize(s) {
  let v = String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
  v = v.replace(/\s*[-–]\s*[a-z\s]+$/i, '') // sufijo " - Estado"
  const STRIP = [
    'autonomo', 'general', 'sir', 'lic.', 'lic', 'dr.', 'dr', 'doctor',
    'bolivariano', 'bolivariana', 'indigena', 'indígena',
    'municipio', 'el', 'la', 'los', 'las', 'de la', 'de los', 'del', 'de',
  ]
  let changed = true
  while (changed) {
    changed = false
    for (const p of STRIP) {
      const re = new RegExp(`^${p}\\s+`, 'i')
      if (re.test(v)) { v = v.replace(re, ''); changed = true }
    }
  }
  return v.replace(/[^a-z0-9]+/g, '')
}

// Aliases canonicalizados a la representación POST-normalize. Resuelven los
// pocos casos donde fuentes externas usan grafías que normalize no unifica.
const ALIASES = {
  arthurmcgregor: 'arthurmacgregor',          // Anzoátegui: Mc → Mac
  mariobricenoiragorri: 'mariobricenoiragorry', // Aragua: -i → -y
  santababara: 'santabarbara',                 // Monagas: typo Excel
  anzoatequi: 'anzoategui',                    // Cojedes: typo INE
  ricauter: 'ricaurte',                        // Cojedes: typo INE
  paosanjuanbautista: 'paodesanjuanbautista',
  tinaquillo: 'falcon',                        // Cojedes: capital ↔ muni
  jesusmariasemprun: 'jesusmariasemprum',      // Zulia: typo
  // Renames de Bolívar (post-fix del adm2 los nombres oficiales ya son los nuevos)
  heres: 'angosturadelorinoco',
  raulleoni: 'bolivarianoangostura',
}

const STATE_TO_ISO = {
  'Distrito Capital': 'VE-A', Amazonas: 'VE-Z', Anzoátegui: 'VE-B', Apure: 'VE-C',
  Aragua: 'VE-D', Barinas: 'VE-E', Bolívar: 'VE-F', Carabobo: 'VE-G', Cojedes: 'VE-H',
  'Delta Amacuro': 'VE-Y', Falcón: 'VE-I', Guárico: 'VE-J', Lara: 'VE-K', Mérida: 'VE-L',
  Miranda: 'VE-M', Monagas: 'VE-N', 'Nueva Esparta': 'VE-O', Portuguesa: 'VE-P',
  Sucre: 'VE-R', Táchira: 'VE-S', Trujillo: 'VE-T', Yaracuy: 'VE-U', Zulia: 'VE-V',
  'La Guaira': 'VE-X', Vargas: 'VE-X',
  'Dependencias Federales': 'VE-W', 'Guayana Esequiba': 'VE-GE',
  'Zona en Reclamación': 'VE-GE',
}

const slug = s => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '')

const parseNumber = v => {
  if (v == null || v === '') return null
  const cleaned = String(v).replace(/[\s ]/g, '').replace(/,/g, '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

// ─── Cargar catálogos ─────────────────────────────────────────────────────

const adm2 = JSON.parse(readFileSync(ADM2_PATH, 'utf8'))
const adm1 = JSON.parse(readFileSync(ADM1_PATH, 'utf8'))

// Catálogo de munis por estado para matching eficiente
const muniCatByIso = {}
for (const f of adm2.features) {
  const p = f.properties
  if (!p.parentISO) continue
  if (!muniCatByIso[p.parentISO]) muniCatByIso[p.parentISO] = []
  muniCatByIso[p.parentISO].push({
    sourceID: p.sourceID,
    name: p.name,
    nombreOficial: p.nombreOficial,
    norm: normalize(p.name),
    normOf: p.nombreOficial ? normalize(p.nombreOficial) : null,
  })
}

const stateNames = {}
for (const f of adm1.features) {
  stateNames[f.properties.iso] = f.properties.name
}

function matchMuni(rawName, iso) {
  if (!iso) return null
  const cat = muniCatByIso[iso] ?? []
  const norm = normalize(rawName)
  const aliased = ALIASES[norm] ?? norm
  let m = cat.find(c => c.norm === aliased)
  if (!m) m = cat.find(c => c.normOf === aliased)
  if (!m) m = cat.find(c =>
    (c.norm.length >= 4 && (c.norm.includes(aliased) || aliased.includes(c.norm))) ||
    (c.normOf && c.normOf.length >= 4 && (c.normOf.includes(aliased) || aliased.includes(c.normOf))),
  )
  return m ?? null
}

// ─── Inicializar master con identidad de cada muni ─────────────────────────

const master = {} // sourceID → { identity, indicators: { field → { value, source } } }
for (const f of adm2.features) {
  const p = f.properties
  const stateSlug = slug(p.parentState ?? '')
  master[p.sourceID] = {
    id: p.sourceID,
    external_id: stateSlug ? `ve_${stateSlug}_${slug(p.name)}` : `ve_${slug(p.name)}`,
    name: p.name,
    nombre_oficial: p.nombreOficial ?? null,
    parent_iso: p.parentISO ?? null,
    parent_state: p.parentState ?? null,
    indicators: {},
  }
}

// Setter que respeta precedencia: si el campo ya está cargado de una fuente
// con mayor prioridad, no sobreescribe (pero deja `also` con las otras fuentes
// para trace).
function setField(sourceID, field, value, source, year) {
  if (value == null || !Number.isFinite(Number(value)) && typeof value !== 'string') return
  const m = master[sourceID]
  if (!m) return
  if (!m.indicators[field]) {
    m.indicators[field] = { value, source, year, also: [] }
  } else {
    m.indicators[field].also.push({ source, value, year })
  }
}

// ─── 1. Fuente Excel del user (TSV) — máxima prioridad para 2021 + capital ─

const excelRows = readFileSync(EXCEL_TSV, 'utf8').split(/\r?\n/).slice(1)
let excelMatched = 0
const excelUnmatched = []
for (const line of excelRows) {
  if (!line.trim()) continue
  const cols = line.split('\t')
  const [muni, capital, estadoRaw, pob, capPob, sup, dens] = cols
  if (!muni || estadoRaw === 'Zona en Reclamación') continue
  const iso = STATE_TO_ISO[estadoRaw]
  const m = matchMuni(muni, iso)
  if (!m) {
    excelUnmatched.push({ excel: muni, estado: estadoRaw })
    continue
  }
  excelMatched++
  if (capital?.trim()) setField(m.sourceID, 'capital', capital.trim(), 'Excel', 2021)
  setField(m.sourceID, 'poblacion_2021', parseNumber(pob), 'Excel/INE', 2021)
  setField(m.sourceID, 'poblacion_capital_2021', parseNumber(capPob), 'Excel/INE', 2021)
  setField(m.sourceID, 'area_km2', parseNumber(sup), 'Excel/INE', 2021)
  setField(m.sourceID, 'densidad', parseNumber(dens), 'Excel/INE', 2021)
}

// ─── 2. INE — autoridad para población 2010/2020/2026/2050 ──────────────────

const ineMunis = JSON.parse(readFileSync(INE_MUNI, 'utf8'))
for (const [sid, rec] of Object.entries(ineMunis)) {
  if (!master[sid]) continue
  const y = rec.byYear ?? {}
  for (const year of [2010, 2020, 2026, 2050]) {
    if (y[String(year)] != null) {
      setField(sid, `poblacion_${year}`, y[String(year)], 'INE', year)
    }
  }
}

// ─── 3. Wiki HTML (procesado antes) — fallback para 2021/área/densidad ─────

const wiki = JSON.parse(readFileSync(WIKI_JSON, 'utf8'))
for (const [sid, rec] of Object.entries(wiki.municipios ?? {})) {
  if (!master[sid]) continue
  if (rec.poblacion2021 != null) setField(sid, 'poblacion_2021', rec.poblacion2021, 'Wiki', 2021)
  if (rec.areaKm2 != null) setField(sid, 'area_km2', rec.areaKm2, 'Wiki', 2021)
  if (rec.densidad != null) setField(sid, 'densidad', rec.densidad, 'Wiki', 2021)
}

// ─── 4. Sintético (CSV original del usuario) — solo IDH/PIB ────────────────

const muni = JSON.parse(readFileSync(MUNICIPAL_CSV, 'utf8'))
for (const sid of Object.keys(master)) {
  if (muni.indicators.idh_2026?.[sid] != null)
    setField(sid, 'idh', muni.indicators.idh_2026[sid], 'sintético', 2026)
  if (muni.indicators.pib_total_mm_usd?.[sid] != null)
    setField(sid, 'pib_total_mm_usd', muni.indicators.pib_total_mm_usd[sid], 'sintético', 2026)
  if (muni.indicators.pib_per_capita_usd?.[sid] != null)
    setField(sid, 'pib_per_capita_usd', muni.indicators.pib_per_capita_usd[sid], 'sintético', 2026)
}

// ─── 5. Source CV (Excel del user) — % urbano por muni + IDH histórico ────
// Para munis: porcentaje de población viviendo en la capital del muni.
// Para estados (se aplica más abajo): IDH 1990/2000/2010/2020 + cambio.
// La data del user viene de fuentes oficiales (UCAB/PNUD recopilados).
let sourcecv = null
try {
  sourcecv = JSON.parse(readFileSync(SOURCE_CV, 'utf8'))
  for (const [sid, rec] of Object.entries(sourcecv.municipios ?? {})) {
    if (!master[sid]) continue
    if (rec.porcentaje_urbano_2021 != null) {
      setField(sid, 'porcentaje_urbano_2021', rec.porcentaje_urbano_2021, 'Source CV', 2021)
    }
  }
} catch (err) {
  console.log(`(source CV no disponible: ${err.message})`)
}

// Campos manejados a nivel muni en el master flat.
const FIELDS = [
  'poblacion_2010', 'poblacion_2020', 'poblacion_2026', 'poblacion_2050',
  'poblacion_2021', 'poblacion_capital_2021', 'porcentaje_urbano_2021',
  'area_km2', 'densidad', 'capital',
  'idh', 'pib_total_mm_usd', 'pib_per_capita_usd',
]

// Campos que viven SOLO a nivel estado (no se agregan desde munis).
// Vienen directos de Source CV o de overrides.
const STATE_ONLY_FIELDS = [
  'idh_1990', 'idh_2000', 'idh_2010', 'idh_2020', 'idh_cambio_2010_2020',
]

const totalMunis = Object.keys(master).length

// ─── Agregados estatales (suma para totales, mean ponderado para tasas) ────

const stateAcc = {}
for (const m of Object.values(master)) {
  const iso = m.parent_iso
  if (!iso) continue
  if (!stateAcc[iso]) stateAcc[iso] = { name: stateNames[iso] ?? iso, count: 0, fields: {} }
  stateAcc[iso].count++
  for (const [field, v] of Object.entries(m.indicators)) {
    if (typeof v.value !== 'number') continue
    if (!stateAcc[iso].fields[field]) stateAcc[iso].fields[field] = { sum: 0, count: 0, sumWeights: 0, sumWeighted: 0 }
    const acc = stateAcc[iso].fields[field]
    acc.sum += v.value
    acc.count++
    const pob = m.indicators.poblacion_2021?.value
    if (typeof pob === 'number') {
      acc.sumWeighted += v.value * pob
      acc.sumWeights += pob
    }
  }
}

// Aplicar regla por indicador (sum vs weighted mean)
const WEIGHTED_MEAN_FIELDS = new Set([
  'densidad', 'idh', 'pib_per_capita_usd', 'porcentaje_urbano_2021',
])
const states = {}
for (const [iso, acc] of Object.entries(stateAcc)) {
  states[iso] = {
    iso,
    name: acc.name,
    muni_count: acc.count,
    indicators: {},
  }
  for (const [field, a] of Object.entries(acc.fields)) {
    if (a.count === 0) continue
    let value
    if (WEIGHTED_MEAN_FIELDS.has(field) && a.sumWeights > 0) {
      value = a.sumWeighted / a.sumWeights
    } else {
      value = a.sum
    }
    states[iso].indicators[field] = { value: Math.round(value * 100) / 100, coverage: a.count }
  }
}

// Inyectar campos state-only del Source CV (no son agregados desde munis,
// son data directa a nivel estado: IDH histórico oficial).
if (sourcecv?.estados) {
  for (const [iso, rec] of Object.entries(sourcecv.estados)) {
    if (!states[iso]) {
      states[iso] = { iso, name: rec.name, muni_count: 0, indicators: {} }
    }
    for (const field of STATE_ONLY_FIELDS) {
      if (rec[field] != null) {
        states[iso].indicators[field] = { value: rec[field], coverage: 1 }
      }
    }
  }
}

// ─── 6. Special entities overrides (Esequibo + Dep. Federales) ────────────
// Para entidades que las fuentes regulares no cubren bien (territorio en
// disputa, archipiélagos), aplicamos overrides manuales contrastados con
// fuentes web. Cada valor declara su procedencia en el JSON.
//
// Estos overrides se aplican TANTO al state como al único muni de cada
// entidad (ambos son 1:1 con su estado, así que comparten valores donde
// corresponda). Override pisa cualquier valor previo del pipeline.
try {
  const overrides = JSON.parse(readFileSync(SPECIAL_OVERRIDES, 'utf8'))
  let overrideCount = 0
  for (const [iso, fields] of Object.entries(overrides)) {
    if (iso.startsWith('_')) continue
    // Asegurar que el state exista
    if (!states[iso]) {
      states[iso] = { iso, name: stateNames[iso] ?? iso, muni_count: 0, indicators: {} }
    }
    // Encontrar el muni espejo (parent_iso === iso) si existe — caso Esequibo
    // y DepFed, donde estado y muni son la misma entidad geográfica.
    const mirrorMuni = Object.values(master).find(m => m.parent_iso === iso)
    for (const [field, payload] of Object.entries(fields)) {
      if (field === '_meta') continue
      if (!payload || typeof payload !== 'object') continue
      const { value, source } = payload
      if (value == null) continue
      // Aplicar al state
      states[iso].indicators[field] = { value, coverage: 1, override: true, source }
      // Y al muni espejo, solo si el campo corresponde a nivel muni
      // (no aplicar idh_1990 etc., que son state-only)
      if (mirrorMuni && !STATE_ONLY_FIELDS.includes(field)) {
        mirrorMuni.indicators[field] = {
          value,
          source: source ?? 'override',
          year: undefined,
          also: [],
        }
      }
      overrideCount++
    }
  }
  console.log(`\nOverrides aplicados: ${overrideCount} valores (Esequibo + Dep. Federales)`)
} catch (err) {
  console.log(`(special overrides no disponibles: ${err.message})`)
}

// ─── Cobertura por indicador (calculada después de TODOS los pasos del
// pipeline, incluido el de overrides, para reflejar el estado final). ──────
const coverage = {}
for (const field of FIELDS) {
  let n = 0
  for (const m of Object.values(master)) if (m.indicators[field]) n++
  coverage[field] = { covered: n, total: totalMunis, pct: ((n / totalMunis) * 100).toFixed(1) }
}

// ─── Escribir outputs ──────────────────────────────────────────────────────

writeFileSync(join(OUT_DIR, 'municipalities.json'), JSON.stringify(master, null, 2))
writeFileSync(join(OUT_DIR, 'states.json'), JSON.stringify(states, null, 2))

// CSV flat (sin trace, listo para Excel)
function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
const muniCsvCols = ['id', 'external_id', 'name', 'nombre_oficial', 'parent_iso', 'parent_state', ...FIELDS]
let csv = muniCsvCols.join(',') + '\n'
for (const m of Object.values(master)) {
  const row = [m.id, m.external_id, m.name, m.nombre_oficial, m.parent_iso, m.parent_state]
  for (const f of FIELDS) row.push(m.indicators[f]?.value ?? '')
  csv += row.map(csvEscape).join(',') + '\n'
}
writeFileSync(join(OUT_DIR, 'municipalities.csv'), csv)

// El CSV de estados incluye TANTO los agregados de munis (FIELDS) como
// los campos state-only directos (STATE_ONLY_FIELDS, ej. IDH histórico).
const STATE_FIELDS = [...FIELDS, ...STATE_ONLY_FIELDS]
const stateCsvCols = ['iso', 'name', 'muni_count', ...STATE_FIELDS]
let scsv = stateCsvCols.join(',') + '\n'
for (const s of Object.values(states)) {
  const row = [s.iso, s.name, s.muni_count]
  for (const f of STATE_FIELDS) row.push(s.indicators[f]?.value ?? '')
  scsv += row.map(csvEscape).join(',') + '\n'
}
writeFileSync(join(OUT_DIR, 'states.csv'), scsv)

writeFileSync(join(OUT_DIR, 'coverage-report.json'), JSON.stringify({ coverage, excelUnmatched, generatedAt: new Date().toISOString() }, null, 2))

// ─── Versión flat optimizada para runtime de la app ────────────────────────
// El master completo lleva trace por campo. La app no lo necesita, solo
// los valores. Generamos un JSON mucho más liviano que se importa en
// indicators.ts via Vite.

const APP_DATA = join(ROOT, 'app', 'src', 'data')

const flatMunis = {}
for (const m of Object.values(master)) {
  const row = {
    id: m.id,
    external_id: m.external_id,
    name: m.name,
    parent_iso: m.parent_iso,
    parent_state: m.parent_state,
  }
  for (const [field, v] of Object.entries(m.indicators)) {
    row[field] = v.value
  }
  flatMunis[m.id] = row
}

const flatStates = {}
for (const s of Object.values(states)) {
  const row = {
    iso: s.iso,
    name: s.name,
    muni_count: s.muni_count,
  }
  for (const [field, v] of Object.entries(s.indicators)) {
    row[field] = v.value
  }
  flatStates[s.iso] = row
}

writeFileSync(join(APP_DATA, 'master-municipalities.json'), JSON.stringify(flatMunis))
writeFileSync(join(APP_DATA, 'master-states.json'), JSON.stringify(flatStates))
console.log(`  app/src/data/master-municipalities.json (flat, runtime)`)
console.log(`  app/src/data/master-states.json          (flat, runtime)`)

// ─── Reporte humano ────────────────────────────────────────────────────────

console.log(`\n=== MASTER GENERADO ===`)
console.log(`Municipios en master: ${totalMunis}`)
console.log(`Excel matched: ${excelMatched}/${excelRows.filter(l => l.trim()).length}`)
if (excelUnmatched.length) {
  console.log(`Excel unmatched: ${excelUnmatched.length}`)
  for (const u of excelUnmatched.slice(0, 10)) console.log(`  · ${u.estado} / ${u.excel}`)
}
console.log(`\nCobertura por indicador:`)
for (const [field, c] of Object.entries(coverage)) {
  const bar = '█'.repeat(Math.round(c.pct / 5))
  console.log(`  ${field.padEnd(22)} ${String(c.covered).padStart(3)}/${c.total}  ${c.pct.padStart(5)}%  ${bar}`)
}
console.log(`\nOutputs:`)
console.log(`  data/master/municipalities.json  (full trace)`)
console.log(`  data/master/states.json          (agregados)`)
console.log(`  data/master/municipalities.csv   (flat)`)
console.log(`  data/master/states.csv           (flat)`)
console.log(`  data/master/coverage-report.json (audit)`)
