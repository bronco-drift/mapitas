// Cosecha info de Wikipedia/Wikidata para los 24 estados + 335 munis VE:
//   - Bandera oficial (SVG, propiedad P41 de Wikidata)
//   - Escudo oficial (SVG, propiedad P94 de Wikidata)
//   - Descripción corta en español
//
// Por qué Wikidata y no scraping HTML:
//   - 1 query SPARQL devuelve TODAS las munis con URLs estructuradas
//   - URLs apuntan directo a Commons (sin parsear HTML)
//   - Es la fuente recomendada por Wikipedia para datos estructurados
//
// Output:
//   - app/public/data/flags/state/<ISO>.svg
//   - app/public/data/flags/muni/<sourceID>.svg
//   - app/public/data/shields/state/<ISO>.svg
//   - app/public/data/shields/muni/<sourceID>.svg
//   - app/src/data/wiki-info.json (descripciones + flags de cobertura)

import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Q-IDs de Wikidata
const MUNI_TYPE = 'Q3327920' // municipio de Venezuela
const STATE_TYPE = 'Q501094' // estado de Venezuela

const OUT_FLAGS_STATE = join(ROOT, 'app', 'public', 'data', 'flags', 'state')
const OUT_FLAGS_MUNI = join(ROOT, 'app', 'public', 'data', 'flags', 'muni')
const OUT_SHIELDS_STATE = join(ROOT, 'app', 'public', 'data', 'shields', 'state')
const OUT_SHIELDS_MUNI = join(ROOT, 'app', 'public', 'data', 'shields', 'muni')
const OUT_JSON = join(ROOT, 'app', 'src', 'data', 'wiki-info.json')

const UA = 'Mapitas/1.0 (https://github.com/bronco-drift/mapitas; marceldatos@gmail.com)'

// ─── Helpers ─────────────────────────────────────────────────────────────

async function sparql(query) {
  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      'Accept': 'application/sparql-results+json',
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'query=' + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error(`SPARQL ${res.status}`)
  return res.json()
}

function normalize(s) {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '')
}

async function downloadFile(url, dest) {
  // Cache: skip si ya existe y >100 bytes
  if (existsSync(dest) && statSync(dest).size > 100) {
    return { skipped: true, size: statSync(dest).size }
  }
  // Retry con backoff exponencial para 429 (Too Many Requests).
  // Commons throttle a ~1 req/s; arrancamos en 600ms y subimos si falla.
  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.status === 429) {
        const wait = 2000 * Math.pow(2, attempt) // 2s, 4s, 8s, 16s
        await new Promise(r => setTimeout(r, wait))
        lastErr = new Error('HTTP 429')
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      writeFileSync(dest, buf)
      return { size: buf.length }
    } catch (err) {
      lastErr = err
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw lastErr ?? new Error('download failed')
}

// Wikidata URLs vienen como http://commons.wikimedia.org/wiki/Special:FilePath/<file>.
// Pasamos ?width=N para obtener un thumbnail PNG optimizado en lugar del
// original (que puede ser SVG vectorial de 3MB+ o PNG de 8MB). Para banderas
// usamos 800px (cubren el polígono completo del estado/muni). Para escudos
// 320px (solo se muestran en hover/modal).
// Resultado: ~30-80KB por archivo en lugar de hasta 8MB.
function thumbnailUrl(commonsUrl, width) {
  return `${commonsUrl}?width=${width}`
}

// Los thumbnails siempre vienen en PNG (Wikipedia los rasteriza), así que
// usamos extensión .png para todos los assets descargados.
const FLAG_WIDTH = 800
const SHIELD_WIDTH = 320

// ─── 1. Cargar master ────────────────────────────────────────────────────

const masterMunis = JSON.parse(
  readFileSync(join(ROOT, 'app', 'src', 'data', 'master-municipalities.json'), 'utf8'),
)
const masterStates = JSON.parse(
  readFileSync(join(ROOT, 'app', 'src', 'data', 'master-states.json'), 'utf8'),
)

// Lookup por nombre+estado normalizados
const muniLookup = new Map()
for (const m of Object.values(masterMunis)) {
  const k = normalize(m.name) + '|' + normalize(m.parent_state)
  muniLookup.set(k, m.id)
}

const stateLookup = new Map()
for (const s of Object.values(masterStates)) {
  // Algunos estados tienen "Estado X" como label en Wikidata, otros solo "X".
  // Mapeamos por nombre simple normalizado.
  stateLookup.set(normalize(s.name), s.iso)
}

// ─── 2. Queries SPARQL ───────────────────────────────────────────────────

console.log('Query Wikidata: estados...')
const stateData = await sparql(`
  SELECT ?item ?itemLabel ?flag ?coat ?desc WHERE {
    ?item wdt:P31 wd:${STATE_TYPE} .
    OPTIONAL { ?item wdt:P41 ?flag . }
    OPTIONAL { ?item wdt:P94 ?coat . }
    OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "es") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  }
`)
console.log(`  ${stateData.results.bindings.length} estados en Wikidata`)

console.log('Query Wikidata: municipios...')
const muniData = await sparql(`
  SELECT ?item ?itemLabel ?stateLabel ?flag ?coat ?desc WHERE {
    ?item wdt:P31 wd:${MUNI_TYPE} .
    OPTIONAL { ?item wdt:P131 ?state . }
    OPTIONAL { ?item wdt:P41 ?flag . }
    OPTIONAL { ?item wdt:P94 ?coat . }
    OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "es") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
  }
`)
console.log(`  ${muniData.results.bindings.length} munis en Wikidata`)

// ─── 3. Match contra master ──────────────────────────────────────────────

const matchedStates = []
const unmatchedStates = []
for (const r of stateData.results.bindings) {
  const wdName = r.itemLabel.value.replace(/^Estado\s+/i, '')
  const iso = stateLookup.get(normalize(wdName))
  if (iso) {
    matchedStates.push({
      iso,
      wdName,
      wdItem: r.item.value,
      flag: r.flag?.value,
      coat: r.coat?.value,
      desc: r.desc?.value,
    })
  } else {
    unmatchedStates.push(wdName)
  }
}
console.log(`Estados matched: ${matchedStates.length}/${stateData.results.bindings.length}`)
if (unmatchedStates.length) console.log(`  Sin match: ${unmatchedStates.join(', ')}`)

const matchedMunis = []
const unmatchedMunis = []
for (const r of muniData.results.bindings) {
  const wdName = r.itemLabel.value.replace(/^Municipio\s+/i, '')
  const wdState = (r.stateLabel?.value || '').replace(/^Estado\s+/i, '')
  const k = normalize(wdName) + '|' + normalize(wdState)
  const sourceID = muniLookup.get(k)
  if (sourceID) {
    matchedMunis.push({
      sourceID,
      wdName,
      wdState,
      wdItem: r.item.value,
      flag: r.flag?.value,
      coat: r.coat?.value,
      desc: r.desc?.value,
    })
  } else {
    unmatchedMunis.push(`${wdName} (${wdState})`)
  }
}
console.log(`Munis matched: ${matchedMunis.length}/${muniData.results.bindings.length}`)
if (unmatchedMunis.length <= 20) {
  console.log(`  Sin match: ${unmatchedMunis.join(', ')}`)
} else {
  console.log(`  Sin match: ${unmatchedMunis.length} (ver wiki-raw/unmatched-munis.json)`)
}

// ─── 4. Download images ──────────────────────────────────────────────────

mkdirSync(OUT_FLAGS_STATE, { recursive: true })
mkdirSync(OUT_FLAGS_MUNI, { recursive: true })
mkdirSync(OUT_SHIELDS_STATE, { recursive: true })
mkdirSync(OUT_SHIELDS_MUNI, { recursive: true })

async function downloadAll(items, level) {
  let flagOk = 0
  let flagFail = 0
  let coatOk = 0
  let coatFail = 0
  for (const item of items) {
    const id = level === 'state' ? item.iso : item.sourceID
    const flagDir = level === 'state' ? OUT_FLAGS_STATE : OUT_FLAGS_MUNI
    const coatDir = level === 'state' ? OUT_SHIELDS_STATE : OUT_SHIELDS_MUNI

    if (item.flag) {
      try {
        const dest = join(flagDir, `${id}.png`)
        await downloadFile(thumbnailUrl(item.flag, FLAG_WIDTH), dest)
        flagOk++
      } catch (err) {
        console.warn(`  flag ${id}: ${err.message}`)
        flagFail++
      }
    }
    if (item.coat) {
      try {
        const dest = join(coatDir, `${id}.png`)
        await downloadFile(thumbnailUrl(item.coat, SHIELD_WIDTH), dest)
        coatOk++
      } catch (err) {
        console.warn(`  coat ${id}: ${err.message}`)
        coatFail++
      }
    }
    // Delay respetuoso entre descargas. Commons throttle a ~1 req/s,
    // 600ms da margen. Skipped (cacheados) van sin delay.
    if ((item.flag || item.coat)) await new Promise(r => setTimeout(r, 600))
  }
  return { flagOk, flagFail, coatOk, coatFail }
}

console.log('\nDescargando estados...')
const stateStats = await downloadAll(matchedStates, 'state')
console.log(`  Banderas: ${stateStats.flagOk} ok · ${stateStats.flagFail} fail`)
console.log(`  Escudos: ${stateStats.coatOk} ok · ${stateStats.coatFail} fail`)

console.log('\nDescargando municipios... (esto toma ~5 min con delays respetuosos)')
const muniStats = await downloadAll(matchedMunis, 'muni')
console.log(`  Banderas: ${muniStats.flagOk} ok · ${muniStats.flagFail} fail`)
console.log(`  Escudos: ${muniStats.coatOk} ok · ${muniStats.coatFail} fail`)

// ─── 5. Generar wiki-info.json ───────────────────────────────────────────

const wikiInfo = {
  _meta: {
    source: 'Wikidata + Wikimedia Commons',
    fetched_at: new Date().toISOString().slice(0, 10),
    states_matched: matchedStates.length,
    munis_matched: matchedMunis.length,
    states_with_flag: matchedStates.filter(s => s.flag).length,
    states_with_shield: matchedStates.filter(s => s.coat).length,
    munis_with_flag: matchedMunis.filter(m => m.flag).length,
    munis_with_shield: matchedMunis.filter(m => m.coat).length,
    munis_with_description: matchedMunis.filter(m => m.desc).length,
  },
  states: {},
  munis: {},
}

for (const s of matchedStates) {
  wikiInfo.states[s.iso] = {
    name: s.wdName,
    description: s.desc ?? null,
    hasFlag: !!s.flag,
    hasShield: !!s.coat,
    wikidata: s.wdItem,
  }
}
for (const m of matchedMunis) {
  wikiInfo.munis[m.sourceID] = {
    name: m.wdName,
    state: m.wdState,
    description: m.desc ?? null,
    hasFlag: !!m.flag,
    hasShield: !!m.coat,
    wikidata: m.wdItem,
  }
}

mkdirSync(dirname(OUT_JSON), { recursive: true })
writeFileSync(OUT_JSON, JSON.stringify(wikiInfo, null, 2))

// Reporte de unmatched para debug manual
mkdirSync(join(ROOT, 'data', 'wiki-raw'), { recursive: true })
writeFileSync(
  join(ROOT, 'data', 'wiki-raw', 'unmatched-munis.json'),
  JSON.stringify(unmatchedMunis, null, 2),
)

console.log('\n═══════════════════════════════════════════════════════')
console.log('RESUMEN')
console.log('═══════════════════════════════════════════════════════')
console.log(`Estados: ${wikiInfo._meta.states_matched}/${stateData.results.bindings.length} matched`)
console.log(`  Con bandera: ${wikiInfo._meta.states_with_flag}`)
console.log(`  Con escudo:  ${wikiInfo._meta.states_with_shield}`)
console.log(`Munis:   ${wikiInfo._meta.munis_matched}/${muniData.results.bindings.length} matched`)
console.log(`  Con bandera: ${wikiInfo._meta.munis_with_flag}`)
console.log(`  Con escudo:  ${wikiInfo._meta.munis_with_shield}`)
console.log(`  Con descripción: ${wikiInfo._meta.munis_with_description}`)
console.log(`\nUnmatched munis: ${unmatchedMunis.length} → ver data/wiki-raw/unmatched-munis.json`)
console.log(`Output: ${OUT_JSON}`)
