// Reasigna el Esequibo en `world-outlines-50m.geojson` de Guyana a Venezuela.
//
// Por qué: el basemap "Contornos países" y "Cosmos" (vista VE nivel país)
// usan este geojson. Natural Earth dibuja el Esequibo como parte de
// Guyana (postura internacional de facto), pero para Mapitas Venezuela el
// contorno tiene que incluir el Esequibo (postura oficial de VE, igual que
// el adm0 que usamos para los polígonos del propio país).
//
// Estrategia (sin importar Esequibo de otra fuente, usando solo turf):
//   1. Calcular el "delta Esequibo" como `adm0_VE - VE_outlines`. Eso da
//      exactamente la zona que VE reclama y el world-outlines no le asigna.
//   2. Nuevo VE = VE_outlines ∪ delta.
//   3. Nuevo Guyana = Guyana_outlines - delta.
//
// Idempotente: si se corre dos veces, la segunda no cambia nada
// (delta = ∅ porque VE_outlines ya incluye el Esequibo).
//
// Regenerar: `node scripts/fix-world-outlines-esequibo.mjs`

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature as topoFeature } from 'topojson-client'
import * as turf from '@turf/turf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const OUTLINES_PATH = resolve(ROOT, 'app/public/data/world-outlines-50m.geojson')
const ADM0_PATH = resolve(ROOT, 'app/public/data/venezuela-adm0.topojson')

async function main() {
  console.log('Leyendo world-outlines-50m.geojson…')
  const outlines = JSON.parse(await readFile(OUTLINES_PATH, 'utf8'))

  console.log('Leyendo venezuela-adm0.topojson…')
  const topo = JSON.parse(await readFile(ADM0_PATH, 'utf8'))
  const objKey = Object.keys(topo.objects)[0]
  const adm0FC = topoFeature(topo, topo.objects[objKey])
  const adm0VE = adm0FC.features[0]
  if (!adm0VE) {
    throw new Error('No se pudo extraer VE del adm0')
  }

  const veIdx = outlines.features.findIndex(
    f => f.properties?.iso_a3 === 'VEN' || f.properties?.ISO_A3 === 'VEN',
  )
  const guyIdx = outlines.features.findIndex(
    f => f.properties?.iso_a3 === 'GUY' || f.properties?.ISO_A3 === 'GUY',
  )
  if (veIdx < 0 || guyIdx < 0) {
    throw new Error(`No se encontraron VE (${veIdx}) o GUY (${guyIdx}) en outlines`)
  }
  const ve = outlines.features[veIdx]
  const guy = outlines.features[guyIdx]

  console.log(`VE en outlines: ${ve.geometry.type}, GUY: ${guy.geometry.type}`)

  // 1) Delta Esequibo = lo que VE adm0 tiene y VE outlines NO. Si es ∅,
  // ya está aplicado el fix; salimos sin tocar nada.
  console.log('Calculando delta Esequibo (adm0_VE - VE_outlines)…')
  const fc = turf.featureCollection([adm0VE, ve])
  const delta = turf.difference(fc)
  if (!delta) {
    console.log('✓ VE outlines ya incluye el Esequibo (delta vacío). Nada que hacer.')
    return
  }

  // Quitar slivers minúsculos del delta (mismatches de geometría entre
  // Natural Earth 50m y nuestro adm0 enriquecido). Conservamos solo el
  // polígono principal del Esequibo (> 10000 km²).
  const cleanedDelta = filterSmallPolygons(delta, 10000)
  if (!cleanedDelta) {
    console.log('✓ Delta sin polígonos significativos tras filtrar slivers. Salimos.')
    return
  }
  const deltaArea = turf.area(cleanedDelta) / 1_000_000
  console.log(`  Delta área: ${deltaArea.toFixed(0)} km² (Esequibo ≈ 159.500 km²)`)

  // 2) Nuevo VE = VE ∪ Esequibo
  console.log('Calculando nuevo VE (unión con Esequibo)…')
  const newVeGeom = turf.union(turf.featureCollection([ve, cleanedDelta]))
  if (!newVeGeom) throw new Error('union VE falló')

  // 3) Nuevo Guyana = Guyana - Esequibo
  console.log('Calculando nuevo Guyana (diferencia con Esequibo)…')
  const newGuyGeom = turf.difference(turf.featureCollection([guy, cleanedDelta]))
  if (!newGuyGeom) throw new Error('difference Guyana falló')

  // Reemplazar geometrías preservando properties
  outlines.features[veIdx] = { ...ve, geometry: newVeGeom.geometry }
  outlines.features[guyIdx] = { ...guy, geometry: newGuyGeom.geometry }

  console.log(`Escribiendo outlines actualizado…`)
  await writeFile(OUTLINES_PATH, JSON.stringify(outlines))

  const newVeArea = turf.area(outlines.features[veIdx]) / 1_000_000
  const newGuyArea = turf.area(outlines.features[guyIdx]) / 1_000_000
  console.log(`✓ Listo:`)
  console.log(`  VE nueva área:  ${newVeArea.toFixed(0)} km² (esperado ≈ 1.075.000 incluyendo Esequibo)`)
  console.log(`  GUY nueva área: ${newGuyArea.toFixed(0)} km² (esperado ≈ 55.000 sin Esequibo)`)
  console.log(`  → ${OUTLINES_PATH}`)
}

// Filtra slivers de un Polygon/MultiPolygon: descarta polígonos cuya área
// es menor al threshold (km²). Si todos los polígonos son pequeños,
// devuelve null.
function filterSmallPolygons(feature, minAreaKm2) {
  const minM2 = minAreaKm2 * 1_000_000
  if (feature.geometry.type === 'Polygon') {
    const area = turf.area(feature)
    return area >= minM2 ? feature : null
  }
  if (feature.geometry.type === 'MultiPolygon') {
    const keptCoords = feature.geometry.coordinates.filter(polyCoords => {
      const poly = turf.polygon(polyCoords)
      return turf.area(poly) >= minM2
    })
    if (keptCoords.length === 0) return null
    if (keptCoords.length === 1) {
      return turf.polygon(keptCoords[0], feature.properties)
    }
    return turf.multiPolygon(keptCoords, feature.properties)
  }
  return feature
}

main().catch(err => {
  console.error('ERROR:', err.message)
  console.error(err.stack)
  process.exit(1)
})
