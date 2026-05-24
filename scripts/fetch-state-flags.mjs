// Baja las 24 banderas estatales venezolanas en SVG (resolución vectorial)
// desde Wikipedia Commons usando Special:FilePath, que redirige al archivo
// original sin necesidad de conocer el hash MD5 del path.
//
// Nombres tomados del Anexo de Wikipedia que el user nos pasó (cada Estado
// tiene su archivo en Commons). Los renombramos a VE-{LETRA}.svg para que
// el front los referencie directo por ISO.

import { writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'app', 'public', 'data', 'flags')

const FLAGS = [
  { iso: 'VE-A', name: 'Flag_of_Caracas_(2022).svg' },
  { iso: 'VE-B', name: 'Flag_of_Anzoátegui_State_(original_version).svg' },
  { iso: 'VE-C', name: 'Flag_of_Apure_State.svg' },
  { iso: 'VE-D', name: 'Flag_of_Aragua_State.svg' },
  { iso: 'VE-E', name: 'Flag_of_Barinas_State.svg' },
  { iso: 'VE-F', name: 'Flag_of_Bolívar_State.svg' },
  { iso: 'VE-G', name: 'Flag_of_Carabobo_State.svg' },
  { iso: 'VE-H', name: 'Flag_of_Cojedes_State.svg' },
  { iso: 'VE-I', name: 'Flag_of_Falcón.svg' },
  { iso: 'VE-J', name: 'Flag_of_Guárico_State.svg' },
  { iso: 'VE-K', name: 'Flag_of_Lara_State.svg' },
  { iso: 'VE-L', name: 'Flag_of_Mérida_State.svg' },
  { iso: 'VE-M', name: 'Flag_of_Miranda_state.svg' },
  { iso: 'VE-N', name: 'Flag_of_Monagas_State.svg' },
  { iso: 'VE-O', name: 'Flag_of_Nueva_Esparta.svg' },
  { iso: 'VE-P', name: 'Flag_of_Portuguesa.svg' },
  { iso: 'VE-R', name: 'Flag_of_Sucre_State.svg' },
  { iso: 'VE-S', name: 'Flag_of_Táchira.svg' },
  { iso: 'VE-T', name: 'Flag_of_Trujillo_State.svg' },
  { iso: 'VE-U', name: 'Flag_of_Yaracuy_State.svg' },
  { iso: 'VE-V', name: 'Flag_of_Zulia_State.svg' },
  { iso: 'VE-X', name: 'Flag_of_La_Guaira_State.svg' },
  { iso: 'VE-Y', name: 'Flag_of_Delta_Amacuro_State.svg' },
  { iso: 'VE-Z', name: 'Flag_of_Amazonas_Indigenous_State.svg' },
]

async function downloadOne({ iso, name }) {
  // Special:FilePath redirige al archivo original. El encodeURIComponent
  // se ocupa de los caracteres especiales (acentos, paréntesis).
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mapitas/1.0 (https://github.com/bronco-drift/mapitas)' },
  })
  if (!res.ok) throw new Error(`${iso} ${name}: HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('svg') && !ct.includes('xml')) {
    console.warn(`  WARN ${iso}: content-type es "${ct}" (esperaba SVG)`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const dest = join(OUT_DIR, `${iso}.svg`)
  writeFileSync(dest, buf)
  return { iso, size: buf.length }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Bajando ${FLAGS.length} banderas estatales (SVG hi-res) → ${OUT_DIR}\n`)

  let ok = 0
  let fail = 0
  for (const f of FLAGS) {
    try {
      const r = await downloadOne(f)
      console.log(`  [ok]   ${r.iso}  ${(r.size / 1024).toFixed(1)}KB`)
      ok++
    } catch (err) {
      console.error(`  [FAIL] ${f.iso}  ${err.message}`)
      fail++
    }
  }
  console.log(`\n${ok} OK · ${fail} fallaron`)
  if (fail > 0) process.exit(1)
}

main()
