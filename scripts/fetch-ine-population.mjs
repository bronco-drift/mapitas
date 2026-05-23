// Descarga los 26 archivos de proyección de población del INE Venezuela.
//
//   - 1 archivo nacional con resumen por estado (todos los años 2000-2050)
//   - 25 archivos por estado/dependencia con sus municipios desglosados
//
// Los archivos vienen de ine.gob.ve, ~60-100KB cada uno. Total ~2MB.
// Guardamos en data/ine-raw/ (gitignored) para no inflar el repo con fuentes
// que se pueden re-descargar.

import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'data', 'ine-raw')

// URL base — el path "2026/04" es la fecha de publicación del INE
const BASE = 'https://ine.gob.ve/wp-content/uploads/2026/04'

// El listado completo. El primero es el nacional (resumen por estado).
// Los demás son por estado, conteniendo sus municipios.
const FILES = [
  { name: 'Nacional', file: 'Nacional-1.xls', iso: null, kind: 'national' },
  { name: 'Distrito Capital', file: 'Distrito-Capital-1.xls', iso: 'VE-A' },
  { name: 'Amazonas', file: 'Estado-Amazonas-1.xls', iso: 'VE-Z' },
  { name: 'Anzoátegui', file: 'Estado-Anzoategui-1.xls', iso: 'VE-B' },
  { name: 'Apure', file: 'Estado-Apure-1.xls', iso: 'VE-C' },
  { name: 'Aragua', file: 'Estado-Aragua-1.xls', iso: 'VE-D' },
  { name: 'Barinas', file: 'Estado-Barinas-1.xls', iso: 'VE-E' },
  { name: 'Bolívar', file: 'Estado-Bolivar-1.xls', iso: 'VE-F' },
  { name: 'Carabobo', file: 'Estado-Carabobo-1.xls', iso: 'VE-G' },
  { name: 'Cojedes', file: 'Estado-Cojedes-1.xls', iso: 'VE-H' },
  { name: 'Delta Amacuro', file: 'Estado-Delta-Amacuro-1.xls', iso: 'VE-Y' },
  { name: 'Falcón', file: 'Estado-Falcon-1.xls', iso: 'VE-I' },
  { name: 'Guárico', file: 'Estado-Guarico-1.xls', iso: 'VE-J' },
  { name: 'Lara', file: 'Estado-Lara-1.xls', iso: 'VE-K' },
  { name: 'Mérida', file: 'Estado-Merida-1.xls', iso: 'VE-L' },
  { name: 'Miranda', file: 'Estado-Miranda-1.xls', iso: 'VE-M' },
  { name: 'Monagas', file: 'Estado-Monagas-1.xls', iso: 'VE-N' },
  { name: 'Nueva Esparta', file: 'Estado-Nueva-Esparta-1.xls', iso: 'VE-O' },
  { name: 'Portuguesa', file: 'Estado-Portuguesa-1.xls', iso: 'VE-P' },
  { name: 'Sucre', file: 'Estado-Sucre-1.xls', iso: 'VE-R' },
  { name: 'Táchira', file: 'Estado-Tachira-1.xls', iso: 'VE-S' },
  { name: 'Trujillo', file: 'Estado-Trujillo-1.xls', iso: 'VE-T' },
  { name: 'Yaracuy', file: 'Estado-Yaracuy-1.xls', iso: 'VE-U' },
  { name: 'Zulia', file: 'Estado-Zulia-1.xls', iso: 'VE-V' },
  { name: 'La Guaira', file: 'Estado-La-Guaira-1.xls', iso: 'VE-X' },
  { name: 'Dependencias Federales', file: 'Dependencias-Federales-1.xls', iso: 'VE-W' },
]

async function downloadOne({ name, file }) {
  const url = `${BASE}/${file}`
  const dest = join(OUT_DIR, file)
  // Cache: skip si ya existe y tiene >10KB (descartar archivos vacios o de
  // descarga fallida previa)
  if (existsSync(dest) && statSync(dest).size > 10000) {
    return { name, file, skipped: true, size: statSync(dest).size }
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mapitas/1.0 (https://github.com/bronco-drift/mapitas)' },
  })
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
  return { name, file, size: buf.length, skipped: false }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`Descargando ${FILES.length} archivos del INE → ${OUT_DIR}\n`)

  // Secuencial — sin paralelo para no martillar el servidor del INE (el sitio
  // es notoriamente frágil). Cada archivo es <100KB así que es rápido igual.
  let ok = 0
  let failed = 0
  for (const f of FILES) {
    try {
      const r = await downloadOne(f)
      const tag = r.skipped ? 'cached' : 'fetched'
      console.log(`  [${tag}] ${f.name.padEnd(25)} ${(r.size / 1024).toFixed(1)}KB`)
      ok++
    } catch (err) {
      console.error(`  [FAIL]   ${f.name.padEnd(25)} ${err.message}`)
      failed++
    }
  }
  console.log(`\n${ok} OK · ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main()
