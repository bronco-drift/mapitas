// Procesa los .xls del INE y genera dos JSONs listos para consumir:
//   - app/src/data/ine-population-states.json:
//       { "VE-A": { "name": "Distrito Capital", "byYear": { "2000": ..., ... } } }
//   - app/src/data/ine-population-municipalities.json:
//       { "<sourceID>": { "name": ..., "parentISO": "VE-Z", "byYear": { ... } } }
//
// Los nombres de municipios del INE se matchean contra el GeoJSON adm2 para
// asignar el sourceID correcto. Diferencias de tildes / mayúsculas / "El " se
// normalizan. Cualquier no-match queda reportado para revisión manual.

import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RAW_DIR = join(ROOT, 'data', 'ine-raw')
const OUT_DIR = join(ROOT, 'data', 'sources')

// Mismo listado que el fetcher — tenerlo aquí también es duplicación pero
// permite correr el process aislado sin re-descargar.
const FILES = [
  { file: 'Nacional-1.xls', iso: null, kind: 'national', name: 'Nacional' },
  { file: 'Distrito-Capital-1.xls', iso: 'VE-A', name: 'Distrito Capital' },
  { file: 'Estado-Amazonas-1.xls', iso: 'VE-Z', name: 'Amazonas' },
  { file: 'Estado-Anzoategui-1.xls', iso: 'VE-B', name: 'Anzoátegui' },
  { file: 'Estado-Apure-1.xls', iso: 'VE-C', name: 'Apure' },
  { file: 'Estado-Aragua-1.xls', iso: 'VE-D', name: 'Aragua' },
  { file: 'Estado-Barinas-1.xls', iso: 'VE-E', name: 'Barinas' },
  { file: 'Estado-Bolivar-1.xls', iso: 'VE-F', name: 'Bolívar' },
  { file: 'Estado-Carabobo-1.xls', iso: 'VE-G', name: 'Carabobo' },
  { file: 'Estado-Cojedes-1.xls', iso: 'VE-H', name: 'Cojedes' },
  { file: 'Estado-Delta-Amacuro-1.xls', iso: 'VE-Y', name: 'Delta Amacuro' },
  { file: 'Estado-Falcon-1.xls', iso: 'VE-I', name: 'Falcón' },
  { file: 'Estado-Guarico-1.xls', iso: 'VE-J', name: 'Guárico' },
  { file: 'Estado-Lara-1.xls', iso: 'VE-K', name: 'Lara' },
  { file: 'Estado-Merida-1.xls', iso: 'VE-L', name: 'Mérida' },
  { file: 'Estado-Miranda-1.xls', iso: 'VE-M', name: 'Miranda' },
  { file: 'Estado-Monagas-1.xls', iso: 'VE-N', name: 'Monagas' },
  { file: 'Estado-Nueva-Esparta-1.xls', iso: 'VE-O', name: 'Nueva Esparta' },
  { file: 'Estado-Portuguesa-1.xls', iso: 'VE-P', name: 'Portuguesa' },
  { file: 'Estado-Sucre-1.xls', iso: 'VE-R', name: 'Sucre' },
  { file: 'Estado-Tachira-1.xls', iso: 'VE-S', name: 'Táchira' },
  { file: 'Estado-Trujillo-1.xls', iso: 'VE-T', name: 'Trujillo' },
  { file: 'Estado-Yaracuy-1.xls', iso: 'VE-U', name: 'Yaracuy' },
  { file: 'Estado-Zulia-1.xls', iso: 'VE-V', name: 'Zulia' },
  { file: 'Estado-La-Guaira-1.xls', iso: 'VE-X', name: 'La Guaira' },
  { file: 'Dependencias-Federales-1.xls', iso: 'VE-W', name: 'Dependencias Federales' },
]

// Mapeo de nombres de estado del INE al ISO 3166-2:VE.
// Algunos del archivo nacional vienen con espacios al inicio.
const STATE_NAME_TO_ISO = {
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

/**
 * Encuentra la fila de header (donde los años están en columnas), devuelve
 * { headerRow, yearCols } o null si no la encuentra.
 */
function findYearHeader(rows) {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i]
    const yearCols = []
    for (let c = 1; c < row.length; c++) {
      const v = row[c]
      if (typeof v === 'number' && v >= 1990 && v <= 2100) {
        yearCols.push({ col: c, year: v })
      }
    }
    if (yearCols.length >= 10) return { headerRow: i, yearCols }
  }
  return null
}

/**
 * Parsea un .xls de proyección de población. Retorna lista de entidades con
 * sus valores anuales: [{ rawName, byYear }].
 * Para Nacional → cada entidad es un estado.
 * Para Estado-X → cada entidad es un municipio.
 *
 * El criterio para "es una fila de dato real":
 *   - col[0] es string no vacío
 *   - tiene al menos 5 columnas con números (años con valores)
 *   - NO está en {Total, Hombres, Mujeres, Estado:, Fuente:, Nota:}
 *
 * Además, en archivos por estado, hay 3 secciones (Total, Hombres, Mujeres)
 * cada una con la misma lista de municipios. Solo tomamos la PRIMERA aparición
 * de cada nombre, que es la sección Total.
 */
function parseFile(filename) {
  const path = join(RAW_DIR, filename)
  const wb = XLSX.read(readFileSync(path))
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const header = findYearHeader(rows)
  if (!header) throw new Error(`${filename}: no encontré header con años`)

  const SKIP = new Set([
    'Total',
    'Hombres',
    'Mujeres',
    'Estado:',
    'Municipio:',
    'Municipio y Sexo',
  ])
  const SKIP_PREFIX = ['Fuente', 'Nota', 'Elaboración']

  const seen = new Set()
  const out = []
  for (let i = header.headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    const raw = String(row[0] ?? '').trim()
    if (!raw) continue
    if (SKIP.has(raw)) continue
    if (SKIP_PREFIX.some(p => raw.startsWith(p))) continue
    // Confirmar que la fila tiene datos numéricos
    const byYear = {}
    let numCount = 0
    for (const { col, year } of header.yearCols) {
      const v = row[col]
      if (typeof v === 'number') {
        byYear[year] = v
        numCount++
      }
    }
    if (numCount < 5) continue
    if (seen.has(raw)) continue // sección H o M ya repetida
    seen.add(raw)
    out.push({ rawName: raw, byYear })
  }
  return out
}

// Normalización para matching laxo. Quita tildes, prefijos honoríficos
// ("General", "Lic."), modificadores ("Bolivariano/a", "Indígena") y conectores
// ("de la", "del"). Esto cubre las diferencias entre nomenclatura del INE y
// la del adm2 (geoBoundaries/IGVSB).
function normalize(s) {
  let v = String(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
  // Quitar prefijos honoríficos / modificadores. Los aplicamos en loop porque
  // algunos vienen combinados (ej. "Indigena Bolivariano Guajira").
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
  console.log('Parseando archivos INE...\n')

  // 1) Procesar el archivo nacional para data estatal
  const nationalEntries = parseFile('Nacional-1.xls')
  console.log(`Nacional: ${nationalEntries.length} entradas`)

  const stateData = {}
  const unmatchedStates = []
  for (const e of nationalEntries) {
    const iso = STATE_NAME_TO_ISO[e.rawName]
    if (!iso) {
      unmatchedStates.push(e.rawName)
      continue
    }
    stateData[iso] = { name: e.rawName, byYear: e.byYear }
  }
  console.log(`Estados matched: ${Object.keys(stateData).length}/${nationalEntries.length}`)
  if (unmatchedStates.length) {
    console.log(`  Sin match: ${unmatchedStates.join(', ')}`)
  }

  // 2) Procesar cada archivo por estado para data municipal
  // Cargamos el adm2 GeoJSON enriched para tener el catálogo oficial de
  // municipios y poder asignar sourceID correcto.
  const adm2Path = join(ROOT, 'app', 'public', 'data', 'venezuela-adm2-enriched.geojson')
  let adm2Catalog = null
  try {
    adm2Catalog = JSON.parse(readFileSync(adm2Path, 'utf8'))
  } catch {
    console.log('  (adm2 geojson no disponible — usando keys normalizados)')
  }

  // Catálogo: por parentISO → [{ sourceID, name }]
  const catByIso = {}
  if (adm2Catalog) {
    for (const f of adm2Catalog.features) {
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
  }

  const muniData = {}
  const unmatchedMunis = []
  let totalMatched = 0
  let totalMunisFromIne = 0

  // Alias manual normalizado → nombre canónico del adm2 (también normalizado).
  // Cubre discrepancias entre INE y adm2 (typos en alguno de los dos, "Mc" vs
  // "Mac", "i" vs "y" en finales, capital de municipio en lugar del nombre del
  // municipio). Los gaps reales del adm2 (Páez de Apure, Ocumare de la Costa,
  // Angostura, Guajira) NO se resuelven acá — quedan sin match porque el adm2
  // no tiene ese polígono.
  const ALIASES = {
    'arthurmcgregor': 'arthurmacgregor', // Anzoátegui: Mc → Mac
    'mariobricenoiragorri': 'mariobricenoiragorry', // Aragua: -i → -y
    'anzoatequi': 'anzoategui', // Cojedes: typo INE
    'ricauter': 'ricaurte', // Cojedes: typo INE
    'paosanjuanbautista': 'paodesanjuanbautista', // Cojedes: "de" interior
    'tinaquillo': 'falcon', // Cojedes: el INE usa la capital, adm2 el muni
    'panamericano': 'panamericanp', // Táchira: typo adm2
    'jesusmariasemprun': 'jesusmariasemprum', // Zulia: typo adm2 (n→m al final)
  }

  // Algunos archivos del INE están mal publicados o corresponden a otra
  // categoría (edad/sexo en vez de municipios). Detectamos por el título.
  const missingMuniData = []
  for (const f of FILES) {
    if (f.kind === 'national') continue

    // Pre-check: el archivo declara su contenido en la fila 0
    const path = join(RAW_DIR, f.file)
    let titleRow0 = ''
    try {
      const wb = XLSX.read(readFileSync(path))
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const r = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      titleRow0 = String(r[0]?.[0] ?? '').toLowerCase()
    } catch {}
    const isMunicipal =
      titleRow0.includes('municipio') || titleRow0.includes('parroquia')
    if (!isMunicipal) {
      console.log(
        `  ${f.name.padEnd(25)} SKIP — no es por municipios (título: "${titleRow0.slice(0, 60)}")`,
      )
      missingMuniData.push(f.name)
      continue
    }

    let entries
    try {
      entries = parseFile(f.file)
    } catch (err) {
      console.log(`  ${f.name.padEnd(25)} ERROR: ${err.message}`)
      continue
    }
    totalMunisFromIne += entries.length

    const stateUnmatched = []
    const catalog = catByIso[f.iso] ?? []
    let matchedHere = 0

    for (const e of entries) {
      const norm = normalize(e.rawName)
      const aliasNorm = ALIASES[norm] ?? norm
      let match = catalog.find(c => c.normalized === aliasNorm)
      if (!match) match = catalog.find(c => c.normalizedOficial === aliasNorm)
      // Match por contención (Atures matchea con "El Municipio Atures")
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

      if (match) {
        muniData[match.sourceID] = {
          name: match.name,
          parentISO: f.iso,
          ineName: e.rawName,
          byYear: e.byYear,
        }
        matchedHere++
        totalMatched++
      } else {
        stateUnmatched.push(e.rawName)
        unmatchedMunis.push({ iso: f.iso, state: f.name, name: e.rawName })
      }
    }
    const status = stateUnmatched.length === 0 ? 'OK' : `${stateUnmatched.length} sin match`
    console.log(
      `  ${f.name.padEnd(25)} ${entries.length} INE → ${matchedHere} matched · ${status}`,
    )
    if (stateUnmatched.length > 0 && stateUnmatched.length <= 8) {
      console.log(`      sin match: ${stateUnmatched.join(' · ')}`)
    }
  }

  // Caso especial: Distrito Capital y La Guaira. El INE publica parroquias,
  // no municipios. Como cada uno tiene UN solo municipio, derivamos el total
  // municipal del total estatal (que sí tenemos). Asignamos al sourceID del
  // único municipio.
  const SINGLE_MUNI_STATES = ['VE-A', 'VE-X']
  for (const iso of SINGLE_MUNI_STATES) {
    const state = stateData[iso]
    if (!state) continue
    const catalog = catByIso[iso] ?? []
    if (catalog.length !== 1) {
      console.log(`  AVISO: ${iso} tiene ${catalog.length} munis en adm2 (esperado 1)`)
      continue
    }
    const muni = catalog[0]
    muniData[muni.sourceID] = {
      name: muni.name,
      parentISO: iso,
      ineName: '(derivado del total estatal)',
      byYear: { ...state.byYear },
    }
    totalMatched++
    console.log(`  + Derivado: ${state.name} → ${muni.name} (1 muni, datos del total estatal)`)
  }

  console.log(
    `\nTotal: ${totalMatched}/${totalMunisFromIne} municipios matched contra adm2`,
  )
  if (missingMuniData.length) {
    console.log(`Estados sin data municipal del INE: ${missingMuniData.join(', ')}`)
  }

  // 3) Guardar JSONs
  writeFileSync(
    join(OUT_DIR, 'ine-population-states.json'),
    JSON.stringify(stateData, null, 2),
  )
  writeFileSync(
    join(OUT_DIR, 'ine-population-municipalities.json'),
    JSON.stringify(muniData, null, 2),
  )
  if (unmatchedMunis.length) {
    writeFileSync(
      join(ROOT, 'data', 'ine-raw', 'unmatched-municipalities.json'),
      JSON.stringify(unmatchedMunis, null, 2),
    )
  }

  console.log(`\nEscritos:`)
  console.log(`  data/sources/ine-population-states.json (${Object.keys(stateData).length} estados)`)
  console.log(`  data/sources/ine-population-municipalities.json (${Object.keys(muniData).length} municipios)`)
  if (unmatchedMunis.length) {
    console.log(`  data/ine-raw/unmatched-municipalities.json (${unmatchedMunis.length} sin match)`)
  }
}

main()
