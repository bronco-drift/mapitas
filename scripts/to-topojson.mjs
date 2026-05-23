import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'data')
const PUBLIC = join(ROOT, 'app', 'public', 'data')

mkdirSync(PUBLIC, { recursive: true })

const targets = [
  'venezuela-adm0-enriched.geojson',
  'venezuela-adm1-enriched.geojson',
  'venezuela-adm2-enriched.geojson',
]

for (const filename of targets) {
  console.log(`\n=== ${filename} ===`)
  const inputPath = join(DATA, filename)
  const inputText = readFileSync(inputPath, 'utf8')

  // Convertir a TopoJSON. -clean ya se aplicó previamente; acá solo
  // formateamos. quantization=1e5 reduce precisión a ~1m (acepta hasta 5
  // decimales) y aplana el tamaño manteniendo precisión visual.
  const outName = filename.replace('-enriched.geojson', '.topojson')
  const cmd = `-i ${filename} -o ${outName} format=topojson quantization=100000`
  const out = await mapshaper.applyCommands(cmd, { [filename]: inputText })
  const outText = out[outName].toString()

  const outPath = join(PUBLIC, outName)
  writeFileSync(outPath, outText)

  const gjSize = statSync(inputPath).size / 1024
  const tjSize = statSync(outPath).size / 1024
  console.log(`  GeoJSON: ${gjSize.toFixed(0)} KB → TopoJSON: ${tjSize.toFixed(0)} KB (${((1 - tjSize / gjSize) * 100).toFixed(0)}% más chico)`)
  console.log(`  → ${outPath}`)
}
