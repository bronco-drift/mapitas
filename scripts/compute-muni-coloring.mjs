// Computa el "map coloring" para los municipios venezolanos.
//
// Objetivo: asignar a cada muni un color de una paleta pequeña (6 colores)
// de modo que NINGÚN PAR DE MUNIS VECINOS comparta color. Es el clásico
// problema de coloreado de grafos. Por el teorema de los 4 colores cualquier
// mapa planar se puede colorear con 4, pero usamos 6 para margen y para
// que la heurística greedy converja sin perfectionismo.
//
// Cómo se detecta "vecindad": en TopoJSON los polígonos comparten ARCS.
// Dos munis con un arc común son vecinos (comparten frontera). Esto es
// mucho más rápido y robusto que hacer intersect espacial con turf.
//
// Output: app/src/data/muni-coloring.json con `{ sourceID: colorIdx }`,
// donde colorIdx ∈ [0, 5]. Los colores reales viven en runtime (el
// JSON es solo "qué muni va con qué slot").
//
// Regenerar después de cambiar la geometría adm2: `node scripts/compute-muni-coloring.mjs`

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const TOPOJSON_PATH = resolve(ROOT, 'app/public/data/venezuela-adm2.topojson')
const OUTPUT_PATH = resolve(ROOT, 'app/src/data/muni-coloring.json')

const N_COLORS = 6

async function main() {
  const topo = JSON.parse(await readFile(TOPOJSON_PATH, 'utf8'))
  const objKey = Object.keys(topo.objects)[0]
  const geometries = topo.objects[objKey].geometries

  console.log(`Munis: ${geometries.length}, arcs: ${topo.arcs.length}`)

  // 1) Recopilar arcs por muni (preservando todos los anillos del MultiPolygon).
  //    arcsForFeature: array de arcs (índices) que conforman el contorno del muni.
  const arcsByMuni = geometries.map(geom => collectArcs(geom))

  // 2) Indexar: para cada arc id, qué munis lo usan.
  const arcToMunis = new Map() // arcIdx (>=0) → Set<muniIdx>
  arcsByMuni.forEach((arcs, muniIdx) => {
    for (const arc of arcs) {
      // En TopoJSON los arcs pueden ser negativos (reverse). El "absoluto"
      // identifica el arc físico; el signo solo indica orientación.
      const key = arc < 0 ? ~arc : arc
      if (!arcToMunis.has(key)) arcToMunis.set(key, new Set())
      arcToMunis.get(key).add(muniIdx)
    }
  })

  // 3) Grafo de adyacencia: dos munis son vecinos si comparten al menos un arc.
  const adjacency = new Map() // muniIdx → Set<muniIdx>
  for (const munis of arcToMunis.values()) {
    if (munis.size < 2) continue
    const arr = [...munis]
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (!adjacency.has(arr[i])) adjacency.set(arr[i], new Set())
        if (!adjacency.has(arr[j])) adjacency.set(arr[j], new Set())
        adjacency.get(arr[i]).add(arr[j])
        adjacency.get(arr[j]).add(arr[i])
      }
    }
  }

  // 4) Greedy graph coloring con orden Welsh-Powell (degree descendente).
  //    Los munis con más vecinos se asignan primero, dejando que los menos
  //    constreñidos absorban lo que quede.
  const allIndices = geometries.map((_, i) => i)
  const sorted = allIndices.sort(
    (a, b) => (adjacency.get(b)?.size ?? 0) - (adjacency.get(a)?.size ?? 0),
  )

  const coloring = new Map() // muniIdx → colorIdx
  let maxColorUsed = 0
  let conflicts = 0

  for (const idx of sorted) {
    const neighborColors = new Set()
    for (const n of adjacency.get(idx) ?? []) {
      if (coloring.has(n)) neighborColors.add(coloring.get(n))
    }
    let chosen = -1
    for (let c = 0; c < N_COLORS; c++) {
      if (!neighborColors.has(c)) {
        chosen = c
        break
      }
    }
    if (chosen === -1) {
      // No alcanzaron N colores (esperable solo si la heurística falla).
      // Usar el módulo y contar como conflicto para que el script avise.
      chosen = neighborColors.size % N_COLORS
      conflicts++
    }
    coloring.set(idx, chosen)
    if (chosen > maxColorUsed) maxColorUsed = chosen
  }

  // 5) Mapear muniIdx → sourceID y emitir el JSON.
  const output = {}
  geometries.forEach((geom, idx) => {
    const sid = geom.properties?.sourceID ?? geom.properties?.SOURCEID ?? null
    if (!sid) return
    output[sid] = coloring.get(idx) ?? 0
  })

  await writeFile(OUTPUT_PATH, JSON.stringify(output) + '\n', 'utf8')

  // Reporte
  const histogram = new Array(N_COLORS).fill(0)
  for (const c of coloring.values()) histogram[c]++
  console.log(`\nColoring listo. Colores usados: ${maxColorUsed + 1} / ${N_COLORS}`)
  console.log(`Distribución por color:`, histogram)
  console.log(`Conflictos (vecinos con mismo color): ${conflicts}`)
  console.log(`Output: ${OUTPUT_PATH}`)

  // Validación: re-chequear que no haya vecinos con mismo color.
  let invalid = 0
  for (const [muniIdx, neighbors] of adjacency.entries()) {
    const my = coloring.get(muniIdx)
    for (const n of neighbors) {
      if (coloring.get(n) === my) invalid++
    }
  }
  console.log(`Pares de vecinos con mismo color: ${invalid / 2} (cada par se cuenta 2 veces arriba)`)
}

// Extrae todos los arc indices de una geometría (Polygon o MultiPolygon).
// En TopoJSON, geom.arcs es:
//   Polygon: [[ring1_arcs], [ring2_arcs], ...] (cada ring es array de ints)
//   MultiPolygon: [[[ring1], [ring2]], [[ring1]], ...] (un nivel más profundo)
function collectArcs(geom) {
  const out = []
  if (geom.type === 'Polygon') {
    for (const ring of geom.arcs) {
      for (const a of ring) out.push(a)
    }
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.arcs) {
      for (const ring of poly) {
        for (const a of ring) out.push(a)
      }
    }
  }
  return out
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
