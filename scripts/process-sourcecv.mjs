// Parsea el Excel "Municipios de Venezuela con raw munic con capital de
// municipio hab habcapi y reportes estadales" (que llamamos source CV)
// y genera data/sources/sourcecv.json con:
//   - municipios: keyed por sourceID con poblacion_capital_2021 y porcentaje_urbano_2021
//   - estados:    keyed por iso con IDH 1990/2000/2010/2020 + cambio 2010-2020
//
// El archivo de entrada vive en data/sourceCV-input.xlsx (renombrado desde
// el nombre largo original que dejó el user en la raíz).

import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const IN_XLSX = join(ROOT, 'data', 'sourceCV-input.xlsx')
const OUT_JSON = join(ROOT, 'data', 'sources', 'sourcecv.json')
const ADM2_PATH = join(ROOT, 'app', 'public', 'data', 'venezuela-adm2-enriched.geojson')

mkdirSync(dirname(OUT_JSON), { recursive: true })

// ── Helpers ────────────────────────────────────────────────────────────────

const STATE_TO_ISO = {
  'Distrito Capital': 'VE-A', Amazonas: 'VE-Z', Anzoátegui: 'VE-B', Apure: 'VE-C',
  Aragua: 'VE-D', Barinas: 'VE-E', Bolívar: 'VE-F', Carabobo: 'VE-G', Cojedes: 'VE-H',
  'Delta Amacuro': 'VE-Y', Falcón: 'VE-I', Guárico: 'VE-J', Lara: 'VE-K', Mérida: 'VE-L',
  Miranda: 'VE-M', Monagas: 'VE-N', 'Nueva Esparta': 'VE-O', Portuguesa: 'VE-P',
  Sucre: 'VE-R', Táchira: 'VE-S', Trujillo: 'VE-T', Yaracuy: 'VE-U', Zulia: 'VE-V',
  'La Guaira': 'VE-X', Vargas: 'VE-X',
  'Dependencias Federales': 'VE-W',
  'Guayana Esequiba': 'VE-GE', 'Zona en Reclamación': 'VE-GE',
}

function normalize(s) {
  let v = String(s ?? '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim()
  v = v.replace(/\s*[-–]\s*[a-z\s]+$/i, '') // sufijo " - Estado"
  const STRIP = ['autonomo', 'general', 'sir', 'lic.', 'lic', 'dr.', 'dr', 'doctor',
    'bolivariano', 'bolivariana', 'indigena', 'indígena', 'municipio',
    'el', 'la', 'los', 'las', 'de la', 'de los', 'del', 'de']
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

const ALIASES = {
  arthurmcgregor: 'arthurmacgregor',
  mariobricenoiragorri: 'mariobricenoiragorry',
  santababara: 'santabarbara',
  anzoatequi: 'anzoategui',
  ricauter: 'ricaurte',
  paosanjuanbautista: 'paodesanjuanbautista',
  tinaquillo: 'falcon',
  jesusmariasemprun: 'jesusmariasemprum',
  heres: 'angosturadelorinoco',
  raulleoni: 'bolivarianoangostura',
}

function parseNumber(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const cleaned = String(v).replace(/[\s ]/g, '').replace(/,/g, '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

// ── Cargar adm2 y armar catálogo de matching ─────────────────────────────

const adm2 = JSON.parse(readFileSync(ADM2_PATH, 'utf8'))
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

// ── Procesar el archivo ──────────────────────────────────────────────────

console.log('Leyendo Excel...')
const wb = XLSX.read(readFileSync(IN_XLSX))

// 1) Hoja "RAW Municip" → población de la capital + % urbano
const rawSheet = wb.Sheets['RAW Municip']
const rawRows = XLSX.utils.sheet_to_json(rawSheet, { header: 1, defval: '' })
//   cols: N.º | Municipio | Capital | Entidad federal | Población (2021) | Capital(pob) | Superficie | Densidad

const municipios = {} // sourceID → { capital, poblacion_2021, poblacion_capital_2021, porcentaje_urbano_2021 }
let muniMatched = 0
const muniUnmatched = []
for (let i = 1; i < rawRows.length; i++) {
  const r = rawRows[i]
  const muniName = r[1]
  const capitalName = r[2]
  const estado = r[3]
  const pobTotal = parseNumber(r[4])
  const pobCapital = parseNumber(r[5])
  if (!muniName || estado === 'Zona en Reclamación') continue
  const iso = STATE_TO_ISO[estado]
  const m = matchMuni(muniName, iso)
  if (!m) {
    muniUnmatched.push({ excel: muniName, estado })
    continue
  }
  muniMatched++
  const pct = pobTotal && pobCapital ? (pobCapital / pobTotal) * 100 : null
  municipios[m.sourceID] = {
    name: m.name,
    parent_iso: iso,
    capital: capitalName ?? null,
    poblacion_2021: pobTotal,
    poblacion_capital_2021: pobCapital,
    porcentaje_urbano_2021: pct != null ? Math.round(pct * 100) / 100 : null,
  }
}
console.log(`Municipios matched: ${muniMatched}/${rawRows.length - 1}`)
if (muniUnmatched.length > 0 && muniUnmatched.length <= 10) {
  console.log('Sin match:', muniUnmatched.map(u => `${u.estado}/${u.excel}`).join(' · '))
}

// 2) Hoja 8 → IDH estatal histórico 1990, 2000, 2010, 2020 + cambio 2010-2020
const idhSheet = wb.Sheets['Hoja 8']
const idhRows = XLSX.utils.sheet_to_json(idhSheet, { header: 1, defval: '' })
//   cols: N.º | Entidad | IDH 1990 | IDH 2000 | IDH 2010 | IDH 2020 | Cambio 2010-2020

const estados = {} // iso → { idh_1990, idh_2000, idh_2010, idh_2020, idh_cambio_2010_2020 }
let stateMatched = 0
for (let i = 1; i < idhRows.length; i++) {
  const r = idhRows[i]
  const estado = r[1]
  if (!estado) continue
  const iso = STATE_TO_ISO[estado]
  if (!iso) {
    console.log(`  Estado sin ISO: "${estado}"`)
    continue
  }
  stateMatched++
  estados[iso] = {
    name: estado,
    idh_1990: parseNumber(r[2]),
    idh_2000: parseNumber(r[3]),
    idh_2010: parseNumber(r[4]),
    idh_2020: parseNumber(r[5]),
    idh_cambio_2010_2020: parseNumber(r[6]),
  }
}
console.log(`Estados con IDH: ${stateMatched}`)

// 3) Escribir JSON
writeFileSync(OUT_JSON, JSON.stringify({ municipios, estados }, null, 2))
console.log(`\nEscrito: ${OUT_JSON}`)
console.log(`  ${Object.keys(municipios).length} municipios`)
console.log(`  ${Object.keys(estados).length} estados`)
