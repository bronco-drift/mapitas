// Parsea la tabla principal del Anexo de Wikipedia con los 335 municipios
// de Venezuela (población 2021, área, densidad). Cruzamos contra adm2 para
// asignar sourceID y generamos un JSON listo para indicators.ts.
//
// Fuente: https://es.wikipedia.org/wiki/Anexo:Municipios_de_Venezuela_por_población_y_área
// El HTML viene de una guardada local hecha por el usuario.

import { load as loadHTML } from 'cheerio'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const HTML_FILE = join(
  ROOT,
  'Anexo_Municipios de Venezuela por población y área - Wikipedia, la enciclopedia libre.html',
)
const OUT_DIR = join(ROOT, 'data', 'sources')

// Estado label (Wikipedia) → ISO 3166-2:VE. Algunos vienen como
// "Distrito Capital", "Vargas" (alias de La Guaira), etc.
const STATE_TO_ISO = {
  'Distrito Capital': 'VE-A',
  Amazonas: 'VE-Z',
  Anzoátegui: 'VE-B',
  Apure: 'VE-C',
  Aragua: 'VE-D',
  Barinas: 'VE-E',
  Bolívar: 'VE-F',
  Carabobo: 'VE-G',
  Cojedes: 'VE-H',
  'Delta Amacuro': 'VE-Y',
  Falcón: 'VE-I',
  Guárico: 'VE-J',
  Lara: 'VE-K',
  Mérida: 'VE-L',
  Miranda: 'VE-M',
  Monagas: 'VE-N',
  'Nueva Esparta': 'VE-O',
  Portuguesa: 'VE-P',
  Sucre: 'VE-R',
  Táchira: 'VE-S',
  Trujillo: 'VE-T',
  Yaracuy: 'VE-U',
  Zulia: 'VE-V',
  'La Guaira': 'VE-X',
  Vargas: 'VE-X', // alias histórico
  'Dependencias Federales': 'VE-W',
}

// Wikipedia formatea miles con espacio (a veces non-breaking U+00A0)
// y decimales con punto. "2 277 972" o "5260.90".
function parseNumber(text) {
  if (!text) return null
  const cleaned = String(text).replace(/[\s  ]/g, '').replace(/,/g, '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function normalize(s) {
  let v = String(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
  const STRIP_PREFIX = [
    'general',
    'sir',
    'lic.',
    'lic',
    'dr.',
    'dr',
    'doctor',
    'bolivariano',
    'bolivariana',
    'indigena',
    'indígena',
    'municipio',
    'el',
    'la',
    'los',
    'las',
    'de la',
    'de los',
    'del',
    'de',
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

function main() {
  console.log('Leyendo HTML de Wikipedia...')
  const html = readFileSync(HTML_FILE, 'utf8')
  const $ = loadHTML(html)
  console.log(`HTML cargado: ${(html.length / 1024).toFixed(0)} KB`)

  // Wikipedia particiona los 335 municipios en 4 sub-tablas por rango de
  // población (>100k, 50-100k, 25-50k, <25k). Todas tienen la misma estructura
  // de columnas: N.º | Municipio | Capital | Entidad federal | Pob total |
  // Pob capital | Superficie | Densidad
  // Las identificamos por sus headers comunes y mergeamos los entries.
  const matchingTables = []
  $('table.wikitable').each((_, t) => {
    const headers = $(t).find('thead th').map((_, h) => $(h).text().trim()).get().join(' | ')
    if (
      headers.includes('Municipio') &&
      headers.includes('Superficie') &&
      headers.includes('Densidad')
    ) {
      matchingTables.push(t)
    }
  })
  if (matchingTables.length === 0) throw new Error('No encontré tablas de municipios')

  const totalRows = matchingTables.reduce((sum, t) => sum + $(t).find('tbody > tr').length, 0)
  console.log(`Tablas de municipios: ${matchingTables.length} (total ${totalRows} filas)\n`)

  const entries = []
  for (const table of matchingTables) {
    $(table).find('tbody > tr').each((_, tr) => {
    const tds = $(tr).find('> td')
    if (tds.length < 5) return

    // Columna 1 (N.º) — omitida; columna 2: municipio (link con title o text)
    const muniLink = $(tds[1]).find('a').first()
    const muniName = muniLink.text().trim() || $(tds[1]).text().trim()

    // Columna 3: capital (omitido por ahora)
    // Columna 4: Entidad federal. El estado viene como link después de bandera.
    // Usamos el último <a> dentro de la celda como nombre del estado, o el text final.
    const stateAnchors = $(tds[3]).find('a')
    const stateName = stateAnchors.length
      ? $(stateAnchors[stateAnchors.length - 1]).text().trim()
      : $(tds[3]).text().trim().split(/\s+/).slice(-1)[0]

    // Columnas 5-8: población total · población capital · superficie · densidad
    // Cuando población total === población capital, hay un colspan=2 que
    // colapsa esas columnas. Detectamos por colspan.
    const colspan = parseInt($(tds[4]).attr('colspan') ?? '1', 10)
    let popTotal, popCapital, superficie, densidad
    if (colspan === 2) {
      popTotal = parseNumber($(tds[4]).text())
      popCapital = popTotal
      superficie = parseNumber($(tds[5]).text())
      densidad = parseNumber($(tds[6]).text())
    } else {
      popTotal = parseNumber($(tds[4]).text())
      popCapital = parseNumber($(tds[5]).text())
      superficie = parseNumber($(tds[6]).text())
      densidad = parseNumber($(tds[7]).text())
    }

    entries.push({
      municipio: muniName,
      estado: stateName,
      iso: STATE_TO_ISO[stateName] ?? null,
      poblacion2021: popTotal,
      poblacionCapital2021: popCapital,
      areaKm2: superficie,
      densidad,
    })
    })
  }

  // Quick sanity
  const isoFound = entries.filter(e => e.iso).length
  console.log(`${isoFound}/${entries.length} con ISO de estado válido`)
  if (isoFound < entries.length) {
    const sinIso = entries.filter(e => !e.iso).map(e => e.estado)
    console.log(`  Estados sin ISO: ${[...new Set(sinIso)].join(', ')}`)
  }

  // Cargar adm2 catalog y matchear
  const adm2 = JSON.parse(
    readFileSync(join(ROOT, 'app', 'public', 'data', 'venezuela-adm2-enriched.geojson'), 'utf8'),
  )
  const catByIso = {}
  for (const f of adm2.features) {
    const p = f.properties
    if (!catByIso[p.parentISO]) catByIso[p.parentISO] = []
    catByIso[p.parentISO].push({
      sourceID: p.sourceID,
      name: p.name,
      nombreOficial: p.nombreOficial,
      normalized: normalize(p.name),
      normalizedOficial: p.nombreOficial ? normalize(p.nombreOficial) : null,
    })
  }

  const ALIASES = {
    arthurmcgregor: 'arthurmacgregor',
    mariobricenoiragorri: 'mariobricenoiragorry',
    anzoatequi: 'anzoategui',
    ricauter: 'ricaurte',
    paosanjuanbautista: 'paodesanjuanbautista',
    tinaquillo: 'falcon',
    panamericano: 'panamericanp',
    jesusmariasemprun: 'jesusmariasemprum',
  }

  // Bucket por estado para diagnóstico
  const muniByState = {}
  let totalMatched = 0
  const unmatched = []

  // Resultado: keyed por sourceID, con los 3 indicadores
  const result = {} // sourceID → { name, parentISO, poblacion2021, areaKm2, densidad }

  for (const e of entries) {
    if (!e.iso) {
      unmatched.push({ ...e, reason: 'sin ISO de estado' })
      continue
    }
    const catalog = catByIso[e.iso] ?? []
    const norm = normalize(e.municipio)
    const aliasNorm = ALIASES[norm] ?? norm
    let match = catalog.find(c => c.normalized === aliasNorm)
    if (!match) match = catalog.find(c => c.normalizedOficial === aliasNorm)
    if (!match)
      match = catalog.find(
        c =>
          (c.normalized.length >= 4 &&
            (c.normalized.includes(aliasNorm) || aliasNorm.includes(c.normalized))) ||
          (c.normalizedOficial &&
            c.normalizedOficial.length >= 4 &&
            (c.normalizedOficial.includes(aliasNorm) ||
              aliasNorm.includes(c.normalizedOficial))),
      )

    if (!muniByState[e.iso]) muniByState[e.iso] = { matched: 0, total: 0 }
    muniByState[e.iso].total++

    if (match) {
      muniByState[e.iso].matched++
      totalMatched++
      result[match.sourceID] = {
        name: match.name,
        parentISO: e.iso,
        wikiName: e.municipio,
        poblacion2021: e.poblacion2021,
        areaKm2: e.areaKm2,
        densidad: e.densidad,
      }
    } else {
      unmatched.push({ ...e, reason: 'sin match en adm2' })
    }
  }

  console.log(`\nMatched: ${totalMatched}/${entries.length} municipios contra adm2`)
  for (const iso of Object.keys(muniByState).sort()) {
    const m = muniByState[iso]
    if (m.matched < m.total) {
      const stateName =
        Object.entries(STATE_TO_ISO).find(([, v]) => v === iso)?.[0] ?? iso
      console.log(`  ${iso} ${stateName}: ${m.matched}/${m.total}`)
    }
  }

  // Pre-computar agregados por estado para la vista País/Estados.
  // Población: suma. Área: suma. Densidad: pob/área (ponderada implícita).
  const stateAggregates = {
    poblacion2021: {},
    areaKm2: {},
    densidad: {},
  }
  const acc = {}
  for (const muni of Object.values(result)) {
    const iso = muni.parentISO
    if (!acc[iso]) acc[iso] = { pob: 0, area: 0 }
    if (typeof muni.poblacion2021 === 'number') acc[iso].pob += muni.poblacion2021
    if (typeof muni.areaKm2 === 'number') acc[iso].area += muni.areaKm2
  }
  for (const [iso, a] of Object.entries(acc)) {
    if (a.pob > 0) stateAggregates.poblacion2021[iso] = a.pob
    if (a.area > 0) stateAggregates.areaKm2[iso] = a.area
    if (a.pob > 0 && a.area > 0) {
      // Densidad estatal: hab/km² ponderado
      stateAggregates.densidad[iso] = +(a.pob / a.area).toFixed(2)
    }
  }

  // Escribir JSON: estructura conveniente para indicators.ts
  const output = {
    municipios: result,
    stateAggregates,
  }
  writeFileSync(join(OUT_DIR, 'wiki-municipios.json'), JSON.stringify(output, null, 2))
  if (unmatched.length) {
    writeFileSync(
      join(ROOT, 'data', 'ine-raw', 'wiki-unmatched-municipalities.json'),
      JSON.stringify(unmatched, null, 2),
    )
  }
  console.log(
    `\nEscrito: data/sources/wiki-municipios.json (${Object.keys(result).length} munis · ${Object.keys(stateAggregates.poblacion2021).length} estados)`,
  )
}

main()
