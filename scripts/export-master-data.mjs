// Exporta 3 CSVs planos con todos los datos del sistema, listo para abrir
// en Excel / Sheets. Sin GeoJSON, sólo IDs + nombres + indicadores.
//
//   data/exports/country.csv         — 1 fila (Venezuela)
//   data/exports/states.csv          — 26 estados + agregados de indicadores
//   data/exports/municipalities.csv  — 337 munis + todos los indicadores
//
// Joins por sourceID (muni) o iso (estado). Cada indicador es una columna.
// Valores faltantes quedan vacíos (no se inventan).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GEO_DIR = join(ROOT, 'app', 'public', 'data')
const DATA_DIR = join(ROOT, 'app', 'src', 'data')
const OUT_DIR = join(ROOT, 'data', 'exports')

mkdirSync(OUT_DIR, { recursive: true })

// Helpers
const readJSON = p => JSON.parse(readFileSync(p, 'utf8'))
const csvEscape = v => {
  if (v == null || v === '') return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// Normaliza un nombre para usar como slug en external_id:
//   "Distrito Capital" → "distrito_capital"
//   "Delta Amacuro"    → "delta_amacuro"
//   "Mérida"           → "merida"
//   "La Guaira"        → "la_guaira"
// Sin tildes, lowercase, espacios → underscore, sin caracteres especiales.
const slug = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
const writeCSV = (path, headers, rows) => {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(','))
  }
  writeFileSync(path, lines.join('\n') + '\n', 'utf8')
}

// Cargar geo
const adm0 = readJSON(join(GEO_DIR, 'venezuela-adm0-enriched.geojson'))
const adm1 = readJSON(join(GEO_DIR, 'venezuela-adm1-enriched.geojson'))
const adm2 = readJSON(join(GEO_DIR, 'venezuela-adm2-enriched.geojson'))

// Cargar todos los indicadores
const ineStates = readJSON(join(DATA_DIR, 'ine-population-states.json'))
const ineMunis = readJSON(join(DATA_DIR, 'ine-population-municipalities.json'))
const wiki = readJSON(join(DATA_DIR, 'wiki-municipios.json'))
const municipal = readJSON(join(DATA_DIR, 'municipal-indicators.json'))

// ===== Country CSV =====
{
  const p = adm0.features[0].properties
  const rows = [
    {
      id: p.sourceID,
      external_id: slug(p.iso), // "ve"
      iso: p.iso,
      name: p.name,
      nombre_oficial: p.nombreOficial,
    },
  ]
  writeCSV(
    join(OUT_DIR, 'country.csv'),
    ['id', 'external_id', 'iso', 'name', 'nombre_oficial'],
    rows,
  )
  console.log(`country.csv: ${rows.length} fila`)
}

// ===== States CSV =====
{
  const rows = adm1.features.map(f => {
    const p = f.properties
    const iso = p.iso
    const ine = ineStates[iso]?.byYear ?? {}
    return {
      id: p.sourceID,
      external_id: `ve_${slug(p.name)}`, // ve_miranda, ve_delta_amacuro
      iso,
      name: p.name,
      nombre_oficial: p.nombreOficial ?? '',
      es_disputado: p.isDisputed ? 'true' : 'false',
      capital: p.capital ?? '',
      region: p.region ?? '',

      // Indicadores estatales/agregados
      poblacion_ine_2010: ine['2010'] ?? '',
      poblacion_ine_2020: ine['2020'] ?? '',
      poblacion_ine_2026: ine['2026'] ?? '',
      poblacion_ine_2050: ine['2050'] ?? '',

      // Agregados de Wikipedia (suma munis)
      poblacion_wiki_2021_agg: wiki.stateAggregates.poblacion2021[iso] ?? '',
      area_wiki_km2_agg: wiki.stateAggregates.areaKm2[iso] ?? '',
      densidad_wiki_agg: wiki.stateAggregates.densidad[iso] ?? '',

      // Agregados del CSV sintético
      poblacion_est_2026_agg: municipal.stateAggregates?.poblacion_2026?.[iso] ?? '',
      area_est_km2_agg: municipal.stateAggregates?.area_km2?.[iso] ?? '',
      pib_total_est_agg: municipal.stateAggregates?.pib_total_mm_usd?.[iso] ?? '',
      pib_pc_est_agg: municipal.stateAggregates?.pib_per_capita_usd?.[iso] ?? '',
      idh_est_agg: municipal.stateAggregates?.idh_2026?.[iso] ?? '',
    }
  })
  writeCSV(
    join(OUT_DIR, 'states.csv'),
    [
      'id',
      'external_id',
      'iso',
      'name',
      'nombre_oficial',
      'es_disputado',
      'capital',
      'region',
      'poblacion_ine_2010',
      'poblacion_ine_2020',
      'poblacion_ine_2026',
      'poblacion_ine_2050',
      'poblacion_wiki_2021_agg',
      'area_wiki_km2_agg',
      'densidad_wiki_agg',
      'poblacion_est_2026_agg',
      'area_est_km2_agg',
      'pib_total_est_agg',
      'pib_pc_est_agg',
      'idh_est_agg',
    ],
    rows,
  )
  console.log(`states.csv: ${rows.length} estados`)
}

// ===== Municipalities CSV =====
{
  const rows = adm2.features.map(f => {
    const p = f.properties
    const sid = p.sourceID

    const ine = ineMunis[sid]?.byYear ?? {}
    const w = wiki.municipios[sid] ?? {}
    const m = {
      pob: municipal.indicators?.poblacion_2026?.[sid],
      area: municipal.indicators?.area_km2?.[sid],
      idh: municipal.indicators?.idh_2026?.[sid],
      pibt: municipal.indicators?.pib_total_mm_usd?.[sid],
      pibpc: municipal.indicators?.pib_per_capita_usd?.[sid],
    }

    return {
      id: sid,
      external_id: `ve_${slug(p.parentState ?? '')}_${slug(p.name)}`,
      name: p.name,
      nombre_oficial: p.nombreOficial ?? '',
      parent_iso: p.parentISO ?? '',
      parent_state: p.parentState ?? '',
      compound_key: p.compoundKey ?? '',

      // Wikipedia 2021
      poblacion_wiki_2021: w.poblacion2021 ?? '',
      area_wiki_km2: w.areaKm2 ?? '',
      densidad_wiki: w.densidad ?? '',

      // INE 2000-2050 (subset clave)
      poblacion_ine_2010: ine['2010'] ?? '',
      poblacion_ine_2020: ine['2020'] ?? '',
      poblacion_ine_2026: ine['2026'] ?? '',
      poblacion_ine_2050: ine['2050'] ?? '',

      // CSV sintético (lo que tenga)
      poblacion_est_2026: m.pob ?? '',
      area_est_km2: m.area ?? '',
      idh_est: m.idh ?? '',
      pib_total_est_mm_usd: m.pibt ?? '',
      pib_pc_est_usd: m.pibpc ?? '',
    }
  })

  // Validar unicidad del external_id antes de escribir. Si hay colisiones,
  // tenemos un bug semántico que debemos atender (homónimos no resueltos).
  const eidCounts = {}
  for (const r of rows) eidCounts[r.external_id] = (eidCounts[r.external_id] ?? 0) + 1
  const dupes = Object.entries(eidCounts).filter(([, n]) => n > 1)
  if (dupes.length) {
    console.log(`\n⚠ ${dupes.length} external_id duplicados:`)
    for (const [eid, n] of dupes) console.log(`   ${eid}  (×${n})`)
  } else {
    console.log(`  external_id único en los ${rows.length} municipios ✓`)
  }

  writeCSV(
    join(OUT_DIR, 'municipalities.csv'),
    [
      'id',
      'external_id',
      'name',
      'nombre_oficial',
      'parent_iso',
      'parent_state',
      'compound_key',
      'poblacion_wiki_2021',
      'area_wiki_km2',
      'densidad_wiki',
      'poblacion_ine_2010',
      'poblacion_ine_2020',
      'poblacion_ine_2026',
      'poblacion_ine_2050',
      'poblacion_est_2026',
      'area_est_km2',
      'idh_est',
      'pib_total_est_mm_usd',
      'pib_pc_est_usd',
    ],
    rows,
  )
  console.log(`municipalities.csv: ${rows.length} municipios`)
}

console.log(`\nArchivos en: ${OUT_DIR}`)
