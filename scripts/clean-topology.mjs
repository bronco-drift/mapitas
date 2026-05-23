import { readFileSync, writeFileSync, statSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mapshaper from 'mapshaper'

mapshaper.enableLogging()

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'data')
const PUBLIC = join(ROOT, 'app', 'public', 'data')

const targets = [
  'venezuela-adm1-enriched.geojson',
  'venezuela-adm2-enriched.geojson',
]

// -clean repara topologías (gaps + slivers entre polígonos vecinos snap-eando
// coordenadas cercanas). El parámetro snap-interval define el threshold
// (en grados decimales; 0.0001 ≈ 11m a la latitud de Venezuela).
//
// -clean también puede generar overlap si no se le pasa min-gap-area. Le
// damos un min-gap-area razonable para sólo cerrar gaps chicos.
async function clean(filename) {
  console.log(`\n=== ${filename} ===`)
  const inputPath = join(DATA, filename)
  const inputText = readFileSync(inputPath, 'utf8')
  const beforeSize = statSync(inputPath).size / 1024

  const cmd = `-i ${filename} -snap interval=0.001 -clean gap-fill-area=200km2 rewind -o ${filename} format=geojson`
  const out = await mapshaper.applyCommands(cmd, { [filename]: inputText })
  const cleanedText = out[filename].toString()

  writeFileSync(inputPath, cleanedText)
  copyFileSync(inputPath, join(PUBLIC, filename))
  const afterSize = statSync(inputPath).size / 1024

  console.log(`  Antes:   ${beforeSize.toFixed(0)} KB`)
  console.log(`  Después: ${afterSize.toFixed(0)} KB`)
  console.log(`  → ${inputPath}`)
  console.log(`  → ${join(PUBLIC, filename)}`)
}

for (const t of targets) {
  await clean(t)
}

console.log('\nLimpieza terminada.')
