// Construye los archivos servibles para la vista "mundo" del producto.
// Incluye TODOS los países (Natural Earth 110m, ~177 features) y enriquece
// cada uno con la cifra R4V de migrantes venezolanos cuando aplica.
//
// Por qué el mundo completo y no solo LATAM:
//   - Permite zoom-out global para ver receptores extra-LATAM (USA, España)
//   - Sienta la base para futuros indicadores globales (ENCOVI internacional,
//     IDH PNUD por país, indicadores OMS, etc.)
//   - Los países sin cifras quedan visualmente como referencia (gris)
//
// Inputs:
//   - data/diaspora-raw/ne_110m_countries.geojson (Natural Earth, world)
//   - data/sources/diaspora-receivers.json (cifras R4V por ISO_A3)
//
// Outputs:
//   - app/public/data/world-countries.geojson (mapa servible)
//   - app/src/data/diaspora-receivers.json (cifras planas para el front)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const NE_PATH = join(ROOT, 'data', 'diaspora-raw', 'ne_110m_countries.geojson')
const RECEIVERS_PATH = join(ROOT, 'data', 'sources', 'diaspora-receivers.json')
const OUT_GEOJSON = join(ROOT, 'app', 'public', 'data', 'world-countries.geojson')
const OUT_DATA = join(ROOT, 'app', 'src', 'data', 'diaspora-receivers.json')

// Países a EXCLUIR del mapa. Antártida y Fiji generan artefactos visuales
// porque cruzan el antimeridiano (Leaflet los renderiza como bandas largas).
// Mantenemos todo lo demás, incluyendo islas chicas y territorios.
const EXCLUDE = new Set(['ATA', 'FJI'])

const ne = JSON.parse(readFileSync(NE_PATH, 'utf8'))
const receivers = JSON.parse(readFileSync(RECEIVERS_PATH, 'utf8'))

const enriched = {
  type: 'FeatureCollection',
  features: [],
}
const withCifras = []

for (const f of ne.features) {
  // Natural Earth usa ADM0_A3 e ISO_A3. Algunos países con ISO_A3='-99'
  // (territorios disputados, ej. Esequibo) se identifican por ADM0_A3.
  const isoA3 = f.properties.ISO_A3 !== '-99' ? f.properties.ISO_A3 : f.properties.ADM0_A3
  if (EXCLUDE.has(isoA3)) continue

  const rec = receivers[isoA3] // null para países sin cifras R4V
  const total = rec?.total ?? null

  enriched.features.push({
    type: 'Feature',
    geometry: f.geometry,
    properties: {
      iso_a3: isoA3,
      name: rec?.name ?? f.properties.NAME_LONG ?? f.properties.NAME,
      continent: f.properties.CONTINENT ?? null,
      region: f.properties.REGION_UN ?? null,
      // Cifra principal: migrantes venezolanos recibidos. null para países
      // que no son receptores R4V documentados (la mayoría del mundo).
      migrantes_ve: total,
      as_of: rec?.as_of ?? null,
      source: rec?.source ?? null,
    },
  })

  if (typeof total === 'number') withCifras.push(isoA3)
}

console.log(`Países incluidos: ${enriched.features.length} (de ${ne.features.length} en Natural Earth)`)
console.log(`Con cifra de migrantes VE: ${withCifras.length} (${withCifras.join(', ')})`)

mkdirSync(dirname(OUT_GEOJSON), { recursive: true })
writeFileSync(OUT_GEOJSON, JSON.stringify(enriched))
console.log(`\nEscritos:`)
console.log(`  ${OUT_GEOJSON} (${(readFileSync(OUT_GEOJSON).length / 1024).toFixed(1)}KB)`)

// Output 2: data plana para el front (Record<iso, { total, as_of, source }>)
const flatData = {}
for (const [iso, rec] of Object.entries(receivers)) {
  if (iso.startsWith('_')) continue
  flatData[iso] = {
    name: rec.name,
    total: rec.total,
    as_of: rec.as_of,
    source: rec.source,
    url: rec.url,
    note: rec.note,
  }
}
writeFileSync(OUT_DATA, JSON.stringify(flatData, null, 2))
console.log(`  ${OUT_DATA} (${Object.keys(flatData).length} países con cifras)`)

// Total agregado para mostrar como contexto
const totalRegional = Object.values(flatData).reduce((acc, r) => acc + (r.total ?? 0), 0)
console.log(`\nTotal sumado: ${totalRegional.toLocaleString('es-VE')} migrantes en ${Object.keys(flatData).length} países`)
console.log(`Total regional R4V estimado: 6,700,000 (RMNA 2024)`)
console.log(`Total global ACNUR: 7,900,000 (2024)`)
