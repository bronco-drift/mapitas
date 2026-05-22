import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as turf from '@turf/turf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const adm1 = JSON.parse(
  readFileSync(join(ROOT, 'data', 'venezuela-adm1-enriched.geojson'), 'utf8'),
)

console.log(`Uniendo ${adm1.features.length} estados en un polígono país...`)
const t0 = Date.now()

let merged = turf.feature(adm1.features[0].geometry)
for (let i = 1; i < adm1.features.length; i++) {
  try {
    const next = turf.feature(adm1.features[i].geometry)
    const u = turf.union(turf.featureCollection([merged, next]))
    if (u && u.geometry) merged = u
  } catch (e) {
    console.warn(`  ! union falló en ${adm1.features[i].properties.name}: ${e.message}`)
  }
}

const ms = Date.now() - t0
console.log(`Union completo en ${ms}ms`)

const adm0 = {
  type: 'FeatureCollection',
  crs: adm1.crs,
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Venezuela',
        nombreOficial: 'República Bolivariana de Venezuela',
        iso: 'VE',
        nameKey: 'venezuela',
        sourceID: 'ven-adm0',
      },
      geometry: merged.geometry,
    },
  ],
}

const outRoot = join(ROOT, 'data', 'venezuela-adm0-enriched.geojson')
const outPublic = join(ROOT, 'app', 'public', 'data', 'venezuela-adm0-enriched.geojson')
writeFileSync(outRoot, JSON.stringify(adm0))
copyFileSync(outRoot, outPublic)

const sizeKB = JSON.stringify(adm0).length / 1024
console.log(`ADM0 OK: 1 feature (Venezuela), ${sizeKB.toFixed(0)} KB`)
console.log(`  → ${outRoot}`)
console.log(`  → ${outPublic}`)
