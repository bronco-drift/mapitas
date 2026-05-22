import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as turf from '@turf/turf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'data', 'provita')
const OUT = join(ROOT, 'app', 'public', 'data', 'thematic')

mkdirSync(OUT, { recursive: true })

const layers = [
  {
    name: 'areas-protegidas',
    label: 'Áreas protegidas',
    color: '#10b981',
    keepProps: ['categoria', 'nombre', 'cat_UICN', 'creacion'],
    tolerance: 0.008,
  },
  {
    name: 'territorios-indigenas',
    label: 'Territorios indígenas',
    color: '#f59e0b',
    keepProps: ['categoria', 'nombre', 'etnias', 'estatus'],
    tolerance: 0.008,
  },
  {
    name: 'centros-poblados',
    label: 'Capitales municipales',
    color: '#1f2937',
    // El cod_centro == '00001' es la capital del municipio en este dataset.
    filter: f => f.properties.cod_centro === '00001',
    keepProps: ['nombre_cen', 'nombre_mun', 'nombre_de'],
  },
  {
    name: 'cuencas-hidrograficas',
    label: 'Cuencas hidrográficas',
    color: '#3b82f6',
    keepProps: ['Nombre'],
    tolerance: 0.012,
  },
  {
    name: 'vialidad',
    label: 'Vialidad pavimentada',
    color: '#6b7280',
    filter: f => /pavimentada/i.test(f.properties.tipo) && !/no pavimentada/i.test(f.properties.tipo),
    keepProps: ['tipo'],
    tolerance: 0.003,
  },
  {
    name: 'internacionales',
    label: 'Límites internacionales',
    color: '#0f172a',
    keepProps: ['nam', 'nm4'],
    tolerance: 0.005,
  },
  {
    name: 'formaciones-vegetales',
    label: 'Formaciones vegetales',
    color: '#22c55e',
    keepProps: ['FV_VE'],
    tolerance: 0.012,
  },
  {
    name: 'unidades-paisaje',
    label: 'Unidades de paisaje',
    color: '#8b5cf6',
    keepProps: ['Sector', 'Región', 'Subregión'],
    tolerance: 0.012,
  },
  {
    name: 'vegetacion-saxicola',
    label: 'Vegetación saxícola',
    color: '#84cc16',
    keepProps: ['FITOCENOSI', 'T_VE'],
  },
  {
    name: 'lotes-petroleros',
    label: 'Lotes petroleros',
    color: '#7c2d12',
    keepProps: ['nombre', 'situacion', 'empresa', 'area_km2'],
    tolerance: 0.005,
  },
  {
    name: 'energia-electrica',
    label: 'Energía eléctrica',
    color: '#eab308',
    keepProps: ['nombre', 'tipo', 'megawatt', 'estatus'],
  },
]

const manifest = []

for (const layer of layers) {
  console.log(`\n--- ${layer.name} ---`)
  const srcPath = join(SRC, `provita-${layer.name}.geojson`)
  const fc = JSON.parse(readFileSync(srcPath, 'utf8'))
  const t0 = Date.now()

  let features = fc.features
  if (layer.filter) {
    const before = features.length
    features = features.filter(layer.filter)
    console.log(`  Filtro: ${before} → ${features.length}`)
  }

  const simplified = features.map(f => {
    let geom = f.geometry
    if (layer.tolerance && geom && geom.type !== 'Point' && geom.type !== 'MultiPoint') {
      try {
        geom = turf.simplify(f, { tolerance: layer.tolerance, highQuality: false }).geometry
      } catch {
        // skip simplify on invalid geom
      }
    }
    const props = {}
    for (const k of layer.keepProps) {
      const v = f.properties?.[k]
      if (v != null && v !== '') props[k] = v
    }
    return { type: 'Feature', properties: props, geometry: geom }
  })

  const out = { type: 'FeatureCollection', features: simplified }
  const outPath = join(OUT, `${layer.name}.geojson`)
  writeFileSync(outPath, JSON.stringify(out))
  const sizeKB = statSync(outPath).size / 1024
  const ms = Date.now() - t0
  console.log(`  → ${outPath}`)
  console.log(`  ${simplified.length} features, ${sizeKB.toFixed(0)} KB en ${ms}ms`)

  manifest.push({
    id: layer.name,
    label: layer.label,
    color: layer.color,
    file: `/data/thematic/${layer.name}.geojson`,
    featureCount: simplified.length,
    sizeKB: Math.round(sizeKB),
    geometryType: simplified[0]?.geometry?.type ?? 'unknown',
  })
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('\nManifest:', join(OUT, 'manifest.json'))
