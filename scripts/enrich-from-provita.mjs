import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as turf from '@turf/turf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'data', 'provita')
const OUT = join(ROOT, 'data')

mkdirSync(OUT, { recursive: true })

const STATE_ISO = {
  Amazonas: 'VE-Z',
  Anzoátegui: 'VE-B',
  Apure: 'VE-C',
  Aragua: 'VE-D',
  Barinas: 'VE-E',
  Bolívar: 'VE-F',
  Carabobo: 'VE-G',
  Cojedes: 'VE-H',
  'Delta Amacuro': 'VE-Y',
  'Distrito Capital': 'VE-A',
  Falcón: 'VE-I',
  Guárico: 'VE-J',
  'La Guaira': 'VE-X',
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
  'Dependencias Federales': 'VE-W',
  'Guayana Esequiba': 'VE-GE',
}

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

function titleCase(str) {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Toma un feature crudo "ESTADO BOLIVARIANO MIRANDA" y devuelve metadata
// {name, nombreOficial, iso} o null si no es un estado oficial.
function processStateName(raw) {
  if (!raw) return null
  const n = raw.trim()

  // Esequibo: usar SOLO "ESTADO GUAYANA ESEQUIBA" (post-Ley 2024)
  if (n === 'ESTADO GUAYANA ESEQUIBA') {
    return { name: 'Guayana Esequiba', nombreOficial: 'Estado Guayana Esequiba', iso: 'VE-GE' }
  }
  // Descartar la variante antigua con 385 sub-polígonos
  if (/GUAYANA ESEQUIBA \(Zona en Reclamaci/i.test(n)) return null

  if (/^DISTRITO CAPITAL/i.test(n)) {
    return { name: 'Distrito Capital', nombreOficial: 'Distrito Capital', iso: 'VE-A' }
  }

  if (/^ESTADO /i.test(n)) {
    let core = n.replace(/^ESTADO /i, '').trim()
    const hasBol = /^BOLIVARIANO /i.test(core)
    if (hasBol) core = core.replace(/^BOLIVARIANO /i, '').trim()
    const name = titleCase(core)
    const iso = STATE_ISO[name]
    if (!iso) return null
    const nombreOficial = hasBol ? `Estado Bolivariano ${name}` : `Estado ${name}`
    return { name, nombreOficial, iso }
  }

  return null
}

function processIslandName(raw) {
  if (!raw) return null
  if (/^(DEPENDENCIA FEDERAL|ARCHIPI[ÉE]LAGO|ISLA[S]?) /i.test(raw)) {
    return { rawDetail: titleCase(raw) }
  }
  return null
}

function processMuniName(raw) {
  if (!raw) return null
  const n = raw.trim()
  if (n === 'GUAYANA ESEQUIBA') {
    return { name: 'Guayana Esequiba', nombreOficial: 'Estado Guayana Esequiba', forceIso: 'VE-GE' }
  }
  if (!/^Municipio /i.test(n)) return null
  let core = n.replace(/^Municipio /i, '')
  core = core.replace(/^Bolivariano /i, '')
  core = core.replace(/^Indígena Bolivariano /i, '')
  core = core.replace(/^Turístico /i, '')
  core = core.replace(/^Autónomo /i, '')
  core = core.replace(/^Indígena /i, '')
  return { name: core.trim(), nombreOficial: n }
}

// Concatenar geometrías sin fusionar (mantiene bordes internos visibles)
function concatGeometries(features) {
  const polygons = []
  for (const f of features) {
    if (!f.geometry) continue
    if (f.geometry.type === 'Polygon') polygons.push(f.geometry.coordinates)
    else if (f.geometry.type === 'MultiPolygon') polygons.push(...f.geometry.coordinates)
  }
  if (polygons.length === 0) return null
  if (polygons.length === 1) return { type: 'Polygon', coordinates: polygons[0] }
  return { type: 'MultiPolygon', coordinates: polygons }
}

// Hace union geométrico real (elimina bordes compartidos entre sub-polígonos).
// turf.union toma 2 features a la vez — los acumulamos iterativamente.
function unionGeometries(features) {
  const valid = features.filter(f => f.geometry)
  if (valid.length === 0) return null
  if (valid.length === 1) return valid[0].geometry
  let merged = turf.feature(valid[0].geometry)
  for (let i = 1; i < valid.length; i++) {
    try {
      const next = turf.feature(valid[i].geometry)
      const fc = turf.featureCollection([merged, next])
      const u = turf.union(fc)
      if (u && u.geometry) merged = u
    } catch {
      // si falla un union puntual, seguimos con el merged actual
    }
  }
  return merged.geometry
}

// =============================================================
// FASE 1: ADM1
// =============================================================
console.log('Leyendo Provita estados...')
const provitaEstados = JSON.parse(readFileSync(join(SRC, 'provita-estados.geojson'), 'utf8'))
console.log(`  ${provitaEstados.features.length} features crudos`)

// Recolectar estados oficiales (1 feature por estado)
const stateFeatures = []
// Islas para Dependencias Federales
const islandFeatures = []
// Sobreposiciones y nulls
const overlapFeatures = []

for (const f of provitaEstados.features) {
  const raw = f.properties.NAM
  const stateMeta = processStateName(raw)
  if (stateMeta) {
    stateFeatures.push({ ...f, _meta: stateMeta })
    continue
  }
  const isle = processIslandName(raw)
  if (isle) {
    islandFeatures.push({ ...f, _detail: isle.rawDetail })
    continue
  }
  if (raw == null || /Sobreposici/i.test(raw)) {
    overlapFeatures.push(f)
  }
}

console.log(`  Estados oficiales: ${stateFeatures.length}`)
console.log(`  Islas / Dependencias: ${islandFeatures.length}`)
console.log(`  Sobreposición / null: ${overlapFeatures.length}`)

// Construir ADM1 base
const adm1Map = new Map() // iso → {name, nombreOficial, iso, features:[]}
for (const f of stateFeatures) {
  const m = f._meta
  if (!adm1Map.has(m.iso)) {
    adm1Map.set(m.iso, { ...m, features: [] })
  }
  adm1Map.get(m.iso).features.push(f)
}

// Dependencias Federales: agrupar todas las islas
if (islandFeatures.length > 0) {
  adm1Map.set('VE-W', {
    name: 'Dependencias Federales',
    nombreOficial: 'Dependencias Federales',
    iso: 'VE-W',
    features: islandFeatures,
  })
}

// Asignar cada Sobreposición/null al estado más cercano por point-in-nearest-state
// (esto rellena los huecos en el mapa)
console.log('\nAsignando zonas sin nombre a estado vecino...')
let assignedOverlap = 0
for (const f of overlapFeatures) {
  if (!f.geometry) continue
  let point
  try { point = turf.pointOnFeature(f) } catch { continue }
  // Buscar el estado más cercano (point-in-polygon → si no, distancia centroide)
  let assigned = null
  for (const entry of adm1Map.values()) {
    if (entry.iso === 'VE-GE' || entry.iso === 'VE-W') continue
    for (const stateF of entry.features) {
      try {
        if (turf.booleanPointInPolygon(point, stateF)) {
          assigned = entry
          break
        }
      } catch {}
    }
    if (assigned) break
  }
  if (!assigned) {
    // Fallback: distancia mínima
    let minDist = Infinity
    let nearest = null
    for (const entry of adm1Map.values()) {
      if (entry.iso === 'VE-GE' || entry.iso === 'VE-W') continue
      for (const stateF of entry.features) {
        try {
          const d = turf.distance(point, turf.centroid(stateF))
          if (d < minDist) {
            minDist = d
            nearest = entry
          }
        } catch {}
      }
    }
    assigned = nearest
  }
  if (assigned) {
    assigned.features.push(f)
    assignedOverlap++
  }
}
console.log(`  ${assignedOverlap} zonas asignadas`)

// Construir features finales ADM1
const adm1Features = []
for (const entry of adm1Map.values()) {
  // Dependencias Federales: las islas son entidades físicas separadas → concat (no union)
  // Resto de estados: union real para eliminar bordes internos entre sub-polígonos
  const t0 = Date.now()
  const geometry = entry.iso === 'VE-W'
    ? concatGeometries(entry.features)
    : unionGeometries(entry.features)
  const ms = Date.now() - t0
  if (entry.features.length > 1) console.log(`  union ${entry.name}: ${entry.features.length} → ${ms}ms`)
  if (!geometry) continue
  adm1Features.push({
    type: 'Feature',
    properties: {
      name: entry.name,
      nombreOficial: entry.nombreOficial,
      iso: entry.iso,
      nameKey: normalize(entry.name),
      isDisputed: entry.iso === 'VE-GE',
      sourceID: `prov_${entry.iso}`,
      sourceFeatures: entry.features.length,
    },
    geometry,
  })
}

writeFileSync(
  join(OUT, 'venezuela-adm1-enriched.geojson'),
  JSON.stringify({ type: 'FeatureCollection', crs: provitaEstados.crs, features: adm1Features }),
)
console.log(`\nADM1 OK: ${adm1Features.length} entidades`)
adm1Features.forEach(f =>
  console.log(`  ${f.properties.iso}  ${f.properties.name.padEnd(28)} (${f.properties.sourceFeatures} polígonos)`),
)

// =============================================================
// FASE 2: ADM2
// =============================================================
console.log('\nLeyendo Provita municipios...')
const provitaMunis = JSON.parse(readFileSync(join(SRC, 'provita-municipios.geojson'), 'utf8'))
console.log(`  ${provitaMunis.features.length} features crudos`)

// Separar Municipios reales vs Sobreposición/Sin Jurisdicción
const muniRawFeatures = []
const muniOverlapFeatures = []
for (const f of provitaMunis.features) {
  const n = f.properties.nam
  const m = processMuniName(n)
  if (m) {
    muniRawFeatures.push({ ...f, _meta: m })
  } else if (n) {
    // Sobreposición o Sin Jurisdicción
    muniOverlapFeatures.push(f)
  }
}
console.log(`  Municipios reales: ${muniRawFeatures.length}`)
console.log(`  Sobreposición / Sin Jurisdicción: ${muniOverlapFeatures.length}`)

// Spatial join cada muni → estado padre (usando los polígonos limpios de ADM1)
const stateCentroids = adm1Features
  .map(s => {
    try { return { state: s, centroid: turf.centroid(s) } } catch { return null }
  })
  .filter(Boolean)

function findParentState(point) {
  for (const state of adm1Features) {
    try {
      if (turf.booleanPointInPolygon(point, state)) {
        return { name: state.properties.name, iso: state.properties.iso, method: 'pip' }
      }
    } catch {}
  }
  let minDist = Infinity
  let nearest = null
  for (const { state, centroid } of stateCentroids) {
    const d = turf.distance(point, centroid)
    if (d < minDist) {
      minDist = d
      nearest = state
    }
  }
  if (!nearest) return null
  return { name: nearest.properties.name, iso: nearest.properties.iso, method: `nearest (${minDist.toFixed(0)}km)` }
}

// Agrupar por compoundKey
const muniGroups = new Map()
let matched = 0, matchedByDist = 0
const unmatched = []

for (const f of muniRawFeatures) {
  const m = f._meta
  let parent
  if (m.forceIso) {
    parent = { name: m.name, iso: m.forceIso, method: 'forced' }
  } else {
    let point
    try { point = turf.pointOnFeature(f) } catch { unmatched.push(m.name); continue }
    parent = findParentState(point)
  }
  if (!parent) { unmatched.push(m.name); continue }
  matched++
  if (parent.method.startsWith('nearest')) matchedByDist++

  const parentKey = normalize(parent.name)
  const nameKey = normalize(m.name)
  const compoundKey = `${parentKey}__${nameKey}`
  if (!muniGroups.has(compoundKey)) {
    muniGroups.set(compoundKey, {
      name: m.name,
      nombreOficial: m.nombreOficial,
      parent,
      parentKey,
      nameKey,
      features: [],
    })
  }
  muniGroups.get(compoundKey).features.push(f)
}

// Asignar Sobreposición de Municipios al muni más cercano
console.log('\nAsignando zonas de Sobreposición a muni vecino...')
let muniOverlapAssigned = 0
for (const f of muniOverlapFeatures) {
  let point
  try { point = turf.pointOnFeature(f) } catch { continue }
  // Buscar muni que contiene el punto, o el más cercano
  let nearestKey = null
  let minDist = Infinity
  for (const [k, g] of muniGroups.entries()) {
    for (const mf of g.features) {
      try {
        if (turf.booleanPointInPolygon(point, mf)) {
          nearestKey = k
          minDist = 0
          break
        }
        const d = turf.distance(point, turf.centroid(mf))
        if (d < minDist) {
          minDist = d
          nearestKey = k
        }
      } catch {}
    }
    if (minDist === 0) break
  }
  if (nearestKey) {
    muniGroups.get(nearestKey).features.push(f)
    muniOverlapAssigned++
  }
}
console.log(`  ${muniOverlapAssigned} zonas asignadas`)

const adm2Features = []
for (const [compoundKey, g] of muniGroups.entries()) {
  // Para munis con sobreposiciones asignadas, hacemos union para fusionar bordes.
  // Para munis con 1 feature, es el mismo Polygon.
  const geometry = g.features.length > 1 ? unionGeometries(g.features) : concatGeometries(g.features)
  if (!geometry) continue
  adm2Features.push({
    type: 'Feature',
    properties: {
      name: g.name,
      nombreOficial: g.nombreOficial,
      nameKey: g.nameKey,
      parentState: g.parent.name,
      parentISO: g.parent.iso,
      parentStateKey: g.parentKey,
      compoundKey,
      sourceID: `prov_${compoundKey}`,
      sourceFeatures: g.features.length,
    },
    geometry,
  })
}

writeFileSync(
  join(OUT, 'venezuela-adm2-enriched.geojson'),
  JSON.stringify({ type: 'FeatureCollection', crs: provitaMunis.crs, features: adm2Features }),
)

const byState = {}
adm2Features.forEach(f => {
  const k = f.properties.parentState
  byState[k] = (byState[k] || 0) + 1
})

console.log(`\nADM2 OK: ${adm2Features.length} municipios únicos`)
console.log(`   pip exactos: ${matched - matchedByDist}, fallback distancia: ${matchedByDist}`)
console.log(`   huérfanos: ${unmatched.length}`)
console.log('\nMunicipios por estado:')
Object.entries(byState)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`  ${s.padEnd(28)} ${n}`))
