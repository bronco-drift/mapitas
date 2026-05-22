import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as shapefile from 'shapefile'

// El DBF está en UTF-8 pero la librería shapefile lo interpreta como Windows-1252,
// generando mojibake (ej. "MÃ‰RIDA" en lugar de "MÉRIDA"). Para revertir,
// reconstruimos los bytes originales (incluyendo el rango 0x80-0x9F que
// Windows-1252 mapea a chars Unicode altos como "‰" U+2030 = 0x89) y los
// decodificamos como UTF-8.
const CP1252_HIGH = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86,
  '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}
const decoder = new TextDecoder('utf-8', { fatal: true })
function fixMojibake(s) {
  if (typeof s !== 'string') return s
  try {
    const bytes = new Uint8Array(
      [...s].map(c => {
        const code = c.charCodeAt(0)
        if (code <= 0xff) return code
        const mapped = CP1252_HIGH[c]
        if (mapped != null) return mapped
        throw new Error('unmappable')
      }),
    )
    return decoder.decode(bytes)
  } catch {
    return s
  }
}
function fixPropsDeep(obj) {
  if (obj == null) return obj
  if (typeof obj === 'string') return fixMojibake(obj)
  if (Array.isArray(obj)) return obj.map(fixPropsDeep)
  if (typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = fixPropsDeep(v)
    return out
  }
  return obj
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROVITA = join(ROOT, 'raw-sources', 'provita')
const OUT = join(ROOT, 'data', 'provita')

mkdirSync(OUT, { recursive: true })

const targets = [
  {
    name: 'estados',
    shp: join(
      PROVITA,
      'Limites_estadales_de_venezuela_IGVSB_WGS84',
      'Limites_estadales_de_venezuela_IGVSB_WGS84',
      'Limites_estadales_de_venezuela_IGVSB_WGS84.shp',
    ),
  },
  {
    name: 'municipios',
    shp: join(
      PROVITA,
      'Limites_municipales_de_venezuela_IGVSB_WGS84',
      'Limites_municipales_de_venezuela_IGVSB_WGS84',
      'Limites_municipales_de_venezuela_IGVSB_WGS84.shp',
    ),
  },
  {
    name: 'internacionales',
    shp: join(
      PROVITA,
      'Limites_internacionales_de_venezuela_IGVSB_WGS84',
      'Limites_internacionales_de_venezuela_IGVSB_WGS84',
      'Limites_internacionales_de_venezuela_IGVSB_WGS84.shp',
    ),
  },
  {
    name: 'areas-protegidas',
    shp: join(PROVITA, '230729_ANP_VEN_WGS84', '230729_ANP_VEN_WGS84', '230729_ANP_VEN_WGS84.shp'),
  },
  {
    name: 'territorios-indigenas',
    shp: join(PROVITA, '240808_TI_VEN_WGS84', '240808_TI_VEN_WGS84', '240808_TI_VEN_WGS84.shp'),
  },
  {
    name: 'centros-poblados',
    shp: join(PROVITA, 'Centros_poblados_IGVSB_INE_WGS84', 'Centros_poblados_IGVSB_INE_WGS84', 'Centros_poblados_IGVSB_INE_WGS84.shp'),
  },
  {
    name: 'cuencas-hidrograficas',
    shp: join(PROVITA, '241115_Cuencas_hidrograficas_WGS84', '241115_Cuencas_hidrograficas_WGS84', '241115_Cuencas_hidrograficas_WGS84.shp'),
  },
  {
    name: 'vialidad',
    shp: join(PROVITA, '210910_Vialidad_venezuela_WGS84', '210910_Vialidad_venezuela_WGS84', '210910_Vialidad_venezuela_WGS84.shp'),
  },
  {
    name: 'formaciones-vegetales',
    shp: join(PROVITA, '101231_Formaciones_vegetales_2010_WGS84', '101231_Formaciones_vegetales_2010_WGS84', '101231_Formaciones_vegetales_2010_WGS84.shp'),
  },
  {
    name: 'unidades-paisaje',
    shp: join(PROVITA, '101231_Unidades_de_paisaje_2010_WGS84', '101231_Unidades_de_paisaje_2010_WGS84', '101231_Unidades_de_paisaje_2010_WGS84.shp'),
  },
  {
    name: 'vegetacion-saxicola',
    shp: join(PROVITA, '101231_Vegetacion_saxicola_2010_WGS84', '101231_Vegetacion_saxicola_2010_WGS84', '101231_Vegetacion_saxicola_2010_WGS84.shp'),
  },
  {
    name: 'lotes-petroleros',
    shp: join(PROVITA, '200901_Lotes_petroleros_venezuela_WGS84', '200901_Lotes_petroleros_venezuela_WGS84', '200901_Lotes_petroleros_venezuela_WGS84.shp'),
  },
  {
    name: 'energia-electrica',
    shp: join(PROVITA, '240904_Energia_electrica_venezuela_WGS84', '240904_Energia_electrica_venezuela_WGS84', '240904_Energia_electrica_venezuela_WGS84.shp'),
  },
  {
    name: 'deforestacion',
    shp: join(PROVITA, 'AFF_Deforestacion_2000_2020', 'AFF_Deforestacion_2000_2020', 'AFF_Deforestacion_2000_2020.shp'),
  },
]

for (const t of targets) {
  console.log(`\n=== ${t.name} ===`)
  const features = []
  const source = await shapefile.open(t.shp)
  let result = await source.read()
  while (!result.done) {
    const f = result.value
    f.properties = fixPropsDeep(f.properties)
    features.push(f)
    result = await source.read()
  }

  const fc = { type: 'FeatureCollection', features }
  const outPath = join(OUT, `provita-${t.name}.geojson`)
  writeFileSync(outPath, JSON.stringify(fc))

  console.log(`Features: ${features.length}`)
  if (features.length > 0) {
    console.log(`Properties (sample):`, Object.keys(features[0].properties))
    console.log(`First feature properties:`, JSON.stringify(features[0].properties, null, 2))
  }
  console.log(`→ ${outPath}`)
}
