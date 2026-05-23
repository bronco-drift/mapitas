// Aplica los 5 fixes al adm2 detectados al cruzar contra el Excel/INE/Wiki.
// Lee el enriched original, escribe la versión corregida en su lugar, y
// regenera el topojson. Idempotente: si los fixes ya están aplicados, no hace
// daño (verifica antes de cambiar).
//
// Fixes:
//   1. Vargas duplicado bajo Miranda → eliminar (legacy pre-1998)
//   2. Páez con parentISO=VE-E (Barinas) → mover a VE-C (Apure) por centroide
//   3. Heres → renombrar a "Angostura del Orinoco" (rename oficial 2017)
//   4. Raúl Leoni → renombrar a "Bolivariano Angostura" (rename oficial 2014)
//   5. Panamericanp → corregir a "Panamericano" (typo del adm2)

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ADM2_PATH = join(ROOT, 'app', 'public', 'data', 'venezuela-adm2-enriched.geojson')
const ADM2_PATH_MIRROR = join(ROOT, 'data', 'venezuela-adm2-enriched.geojson')
const TOPO_PATH = join(ROOT, 'app', 'public', 'data', 'venezuela-adm2.topojson')

const geo = JSON.parse(readFileSync(ADM2_PATH, 'utf8'))
console.log(`Cargado adm2: ${geo.features.length} features\n`)

// Catálogo en memoria por sourceID + nombre+iso para ediciones
const fixes = []

// FIX 1: eliminar Vargas duplicado bajo Miranda (legacy)
// Hay dos "Vargas": uno bajo VE-M (legacy geoBoundaries), otro bajo VE-X
// (correcto, agregado manualmente). Conservamos el de VE-X.
const beforeCount = geo.features.length
geo.features = geo.features.filter(f => {
  const p = f.properties
  if (p.name === 'Vargas' && p.parentISO === 'VE-M') {
    fixes.push(`[1] Eliminado: Vargas duplicado bajo Miranda (sourceID ${p.sourceID})`)
    return false
  }
  return true
})

// FIX 2: Páez bajo Barinas (VE-E) en realidad es Páez de Apure (centroide en Guasdualito)
for (const f of geo.features) {
  const p = f.properties
  if (p.name === 'Páez' && p.parentISO === 'VE-E') {
    p.parentISO = 'VE-C'
    p.parentState = 'Apure'
    p.parentStateKey = 'apure'
    p.compoundKey = 'apure__paez'
    fixes.push(`[2] Movido: Páez (sourceID ${p.sourceID}) de VE-E → VE-C (Apure)`)
  }
}

// FIX 3 + 4: renames de Bolívar. Preservamos el nombre histórico en nombreOficial
// para que quede rastro de la procedencia del polígono.
for (const f of geo.features) {
  const p = f.properties
  if (p.name === 'Heres' && p.parentISO === 'VE-F') {
    p.nombreOficial = 'Municipio Angostura del Orinoco (ex Heres)'
    p.name = 'Angostura del Orinoco'
    p.nameKey = 'angostura del orinoco'
    p.compoundKey = 'bolivar__angostura del orinoco'
    fixes.push(`[3] Rename: Heres → Angostura del Orinoco (Bolívar)`)
  }
  if (p.name === 'Raúl Leoni' && p.parentISO === 'VE-F') {
    p.nombreOficial = 'Municipio Bolivariano Angostura (ex Raúl Leoni)'
    p.name = 'Bolivariano Angostura'
    p.nameKey = 'bolivariano angostura'
    p.compoundKey = 'bolivar__bolivariano angostura'
    fixes.push(`[4] Rename: Raúl Leoni → Bolivariano Angostura (Bolívar)`)
  }
}

// FIX 5: typo "Panamericanp" en Táchira
for (const f of geo.features) {
  const p = f.properties
  if (p.name === 'Panamericanp' && p.parentISO === 'VE-S') {
    p.name = 'Panamericano'
    p.nameKey = 'panamericano'
    p.compoundKey = 'tachira__panamericano'
    if (p.nombreOficial?.includes('Panamericanp')) {
      p.nombreOficial = p.nombreOficial.replace('Panamericanp', 'Panamericano')
    }
    fixes.push(`[5] Typo: Panamericanp → Panamericano (Táchira)`)
  }
}

if (fixes.length === 0) {
  console.log('Nada que arreglar — el adm2 ya está limpio.')
  process.exit(0)
}

console.log('Fixes aplicados:')
for (const f of fixes) console.log('  ' + f)
console.log(`\nFeatures: ${beforeCount} → ${geo.features.length}`)

// Escribir tanto en app/public/data como en data/ (el mirror que usaban otros scripts viejos)
writeFileSync(ADM2_PATH, JSON.stringify(geo))
writeFileSync(ADM2_PATH_MIRROR, JSON.stringify(geo))
console.log(`\nEscrito enriched: ${ADM2_PATH}`)

// Regenerar topojson. Usamos mapshaper porque ya está en deps.
// Comando: mapshaper IN -o format=topojson OUT
const mapshaperBin = join(ROOT, 'node_modules', '.bin', 'mapshaper')
const cmd = `"${mapshaperBin}" "${ADM2_PATH}" -o format=topojson "${TOPO_PATH}"`
console.log(`\nRegenerando topojson...`)
try {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT })
  console.log(`Topojson regenerado: ${TOPO_PATH}`)
} catch (err) {
  console.error(`\nMapshaper falló: ${err.message}`)
  console.error('El enriched está OK pero el topojson sigue con datos viejos.')
  process.exit(1)
}
