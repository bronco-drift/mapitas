# Informe Tier S · 3 indicadores para implementar

> Documento de planeamiento para los próximos 3 indicadores priorizados del
> catálogo de Mapitas. Incluye fuentes verificables, plan de procesamiento,
> integración al master y decisiones de UI. Usar como spec, no como lectura
> de contexto.
>
> Generado: 2026-05-24 · Versión: 0.1

---

## Resumen ejecutivo

| # | Indicador | Fuente | Nivel | Cobertura esperada | Esfuerzo |
|---|---|---|---|---|---|
| 1 | **Diáspora por estado de origen** | ENCOVI 2023 + DTM OIM | Estado | 24/27 (sin Esequibo, sin Dep. Fed., sin parte de capitales) | 2-3 días |
| 2 | **Pobreza multidimensional** | ENCOVI 2023 (UCAB) | Estado | 22/27 (algunas ediciones solo dan regiones) | 1-2 días |
| 3 | **Acceso a electricidad continua** | OVSP Trim. + ENCOVI 2023 | Estado | 24/27 | 1-2 días |

**Total**: ~5-7 días de trabajo para los 3, secuenciable. Todos a nivel estado
(`adm1`). Ninguno requiere refactor estructural. Pre-requisitos recomendados al
final.

---

## Indicador 1 · Diáspora venezolana por estado de origen

### Definición operacional
**% de hogares con al menos un miembro emigrado desde 2014** por entidad
federal de origen. Es la métrica más confiable disponible (medir números
absolutos requiere extrapolación poblacional, que tiene mucho margen).

### Por qué importa
- **Diferenciador**: nadie tiene esto bien mapeado a nivel estado
- **Alta búsqueda SEO**: "estados de Venezuela con más migración", "de dónde
  salen migrantes venezolanos"
- **Complemento natural** del `diaspora-receivers.json` que ya está en vista
  Global: vista VE muestra **origen**, vista Global muestra **destino**. Cierra
  el círculo
- **Periodísticamente caliente**: las regiones de mayor expulsión son material
  recurrente de notas

### Fuente principal
**ENCOVI 2023** — Encuesta Nacional de Condiciones de Vida
- Instituto: IIES-UCAB (Instituto de Investigaciones Económicas y Sociales,
  Universidad Católica Andrés Bello)
- URL: https://www.proyectoencovi.com/
- Publicación: junio 2024 (ENCOVI 2023). Próxima edición esperada mediados
  de 2025
- Capítulo: "Movilidad humana" o "Migración"
- Formato: PDF con tablas (a veces también Excel con micro-data)
- Licencia: pública, citación requerida
- Cobertura: 21.000+ hogares en 22 entidades. No incluye Dep. Federales ni
  Esequibo; cobertura parcial en Amazonas y Delta Amacuro

### Fuentes complementarias
- **DTM (Displacement Tracking Matrix)** de OIM: surveys de retornados con
  desagregación por estado de origen. Útil como cross-check
- **Equilibrium CenDE** (Centro para el Desarrollo y la Estabilidad): reportes
  sobre flujos migratorios VE con desagregación regional

### Cómo obtener la data
1. Descargar el PDF más reciente de ENCOVI desde `proyectoencovi.com`
2. Buscar capítulo "Migración" o "Movilidad humana"
3. Tabla típica: "% hogares con miembro emigrado por entidad federal"
4. Transcribir a CSV manualmente (las tablas PDF son pequeñas — 22-24 filas)
5. Guardar en `raw-sources/encovi-2023-migracion.csv`

### Plan de procesamiento

```js
// scripts/process-encovi-migracion.mjs
// Template: process-sourcecv.mjs (reutilizar STATE_TO_ISO, normalize, parseNumber)

import { readFileSync, writeFileSync } from 'node:fs'
import Papa from 'papaparse'
import { STATE_TO_ISO } from './lib/state-mappings.mjs'  // ← extraer a lib reusable (ver Anexo)

const raw = readFileSync('raw-sources/encovi-2023-migracion.csv', 'utf8')
const { data } = Papa.parse(raw, { header: true, skipEmptyLines: true })

const output = {
  _doc: {
    source: 'ENCOVI 2023 — IIES/UCAB',
    url: 'https://www.proyectoencovi.com/',
    as_of: '2023',
    note: 'Hogares con al menos un miembro emigrado desde 2014. Dep. Federales y Esequibo sin cobertura.',
  },
  states: {},
}

for (const row of data) {
  const iso = STATE_TO_ISO[row.estado]
  if (!iso) { console.warn(`Estado no mapeado: ${row.estado}`); continue }
  output.states[iso] = {
    pct_hogares_con_emigrante: parseFloat(row.pct_hogares),
    estimacion_emigrantes_aprox: row.estimacion ? parseInt(row.estimacion) : null,
  }
}

writeFileSync('data/sources/encovi-migracion.json', JSON.stringify(output, null, 2))
console.log(`Procesado: ${Object.keys(output.states).length} estados`)
```

### Integración al master + indicators.ts

**En `scripts/build-master.mjs`**: agregar lectura de
`data/sources/encovi-migracion.json`, mergear al `states.json` final con
campo `pct_emigracion_2023` y `emigrantes_estimados_2023`.

**En `app/src/data/indicators.ts`**:

```ts
const PCT_EMIGRACION: Indicator = {
  id: 'pct_emigracion_2023_encovi',
  label: 'Hogares con emigrante · ENCOVI 2023',
  description: 'Porcentaje de hogares con al menos un miembro emigrado desde 2014',
  unit: '% de hogares',
  format: 'rate',
  year: 2023,
  source: 'ENCOVI 2023 (IIES-UCAB)',
  note: 'Sin datos para Esequibo y Dep. Federales. Cobertura parcial en Amazonas y Delta Amacuro.',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('pct_emigracion_2023'),
}
```

### Decisiones de UI
- **Paleta sugerida**: `reds` (intensidad creciente = más emigración).
  Comunica "pérdida"
- **Unidad**: "% de hogares" — la métrica más honesta. Evitar números
  absolutos extrapolados
- **Coverage badge**: ~3 entidades sin data (badge ámbar `·3`)
- **Note importante**: dejar explícito que es % no número absoluto

### Limitaciones a documentar
- ENCOVI no llega al **Esequibo** ni a **Dep. Federales** (nunca lo hizo)
- ENCOVI 2023 reporta por estado pero algunos años solo dan **regiones
  agregadas** (8 grupos). Si toca un año "solo regional", aplicar a todos los
  estados de la región (con nota `≈`)
- Es muestra, no censo: hay margen de error ~3-5% por estado

### Esfuerzo: 2-3 días
1. Descargar PDF + transcribir tabla a CSV (~2 hrs)
2. Escribir y testear script (~3 hrs)
3. Integrar al master + indicators.ts (~2 hrs)
4. QA visual en mapa, ajustar paleta/leyenda (~2 hrs)

---

## Indicador 2 · Pobreza multidimensional (ENCOVI)

### Definición operacional
**% de hogares en pobreza multidimensional** según metodología OPHI (Oxford
Poverty and Human Development Initiative) adaptada por IIES-UCAB. Mide
privación en 5 dimensiones: vivienda, servicios, educación, empleo y
protección social.

### Por qué importa
- **Única fuente sistemática** de medición de pobreza en VE post-INE
  (el gobierno dejó de publicar oficialmente)
- **Credibilidad académica alta**: UCAB es el referente
- **Alto valor periodístico**: la pobreza territorial es tema central de
  cualquier nota sobre VE
- **Multidimensional > monetaria**: refleja mejor la realidad venezolana
  (donde el bolívar tiene poco sentido como métrica)

### Fuente
Misma que el indicador 1: **ENCOVI 2023 — IIES-UCAB**
- Mismo PDF, capítulo "Pobreza multidimensional" o "Índice de Pobreza
  Multidimensional"

### Cómo obtener la data
1. Del mismo PDF descargado para indicador 1
2. Capítulo IPM (Índice de Pobreza Multidimensional) — tabla por entidad
   federal
3. Transcribir a CSV: `raw-sources/encovi-2023-ipm.csv`

### Plan de procesamiento

Mismo patrón que el #1 pero con `scripts/process-encovi-pobreza.mjs`.
Output: `data/sources/encovi-pobreza.json`.

```js
output.states[iso] = {
  ipm_2023: parseFloat(row.ipm),                    // 0-100, % hogares en pobreza multidim.
  pobreza_extrema_2023: parseFloat(row.extrema),    // subset: pobreza extrema
  intensidad_2023: parseFloat(row.intensidad),      // intensidad media de la privación
}
```

### Integración

```ts
const IPM_2023: Indicator = {
  id: 'ipm_2023_encovi',
  label: 'Pobreza multidimensional · ENCOVI 2023',
  description: 'Porcentaje de hogares con privación en 3+ de 5 dimensiones (vivienda, servicios, educación, empleo, protección social)',
  unit: '% de hogares',
  format: 'rate',
  year: 2023,
  source: 'ENCOVI 2023 (IIES-UCAB, metodología OPHI)',
  note: 'Dep. Federales y Esequibo sin cobertura. La metodología es la oficial del Multidimensional Poverty Index de Oxford.',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('ipm_2023'),
}

const POBREZA_EXTREMA_2023: Indicator = {
  id: 'pobreza_extrema_2023_encovi',
  label: 'Pobreza extrema · ENCOVI 2023',
  // ... similar
}
```

### Decisiones de UI
- **Paleta**: `oranges` o `reds` (intensidad creciente = más pobreza). Apple/
  Anthropic recomendaría evitar la dramatización con rojos extremos
- **Unidad**: "% de hogares"
- **Dos indicadores complementarios**: IPM general + pobreza extrema. Permite
  al usuario elegir qué mostrar

### Limitaciones
- Misma cobertura que migración (sin Esequibo, sin Dep. Fed.)
- IPM es métrica relativamente nueva; algunos lectores no la conocen. La
  `description` debería ser explicativa
- Si ENCOVI 2023 solo publica regional para algunos años, aplicar misma
  técnica de propagación

### Esfuerzo: 1-2 días
Si ya hiciste el #1, este es más fácil (mismo script con campos distintos,
misma fuente PDF).

---

## Indicador 3 · Acceso a electricidad continua

### Definición operacional
**% de hogares con servicio eléctrico estable** (sin cortes de >4 horas
diarias en promedio). Métrica más relevante para VE dado el contexto de
apagones crónicos.

### Por qué importa
- **Relevancia cotidiana absoluta**: el venezolano vive con esto encima
- **Diferenciación clara**: data dispersa, nadie la ha mapeado bien
- **Abre la categoría "Servicios básicos"** que faltaba completamente del
  catálogo
- **Encaja con misión**: transparencia sobre la realidad territorial real

### Fuente principal
**OVSP (Observatorio Venezolano de Servicios Públicos)**
- URL: http://www.observatoriovsp.org/
- Boletines: trimestrales
- Cobertura: 12 ciudades principales en encuestas detalladas, pero también
  publican por entidad federal en boletines anuales
- Formato: PDF + a veces Excel
- Licencia: pública, citación requerida

### Fuente secundaria (más amplia, menos detallada)
**ENCOVI 2023**: tiene preguntas sobre frecuencia/duración de cortes.
Cobertura más amplia (todas las entidades cubiertas), pero menos granular

### Estrategia: combinar las dos fuentes
- **OVSP para las 12 ciudades / 12 estados principales** (alta confianza)
- **ENCOVI para el resto** (menor granularidad, indicar `≈` en cobertura
  modal)

### Plan de procesamiento

```js
// scripts/process-electricidad.mjs

const ovsp = parseOVSPBoletin('raw-sources/ovsp-electricidad-2024-q4.csv')
const encovi = parseENCOVIServicios('raw-sources/encovi-2023-servicios.csv')

// Merge con precedencia: OVSP > ENCOVI (OVSP es más reciente y específico)
const output = { states: {} }
for (const iso of ALL_STATES) {
  output.states[iso] = {
    pct_electricidad_estable: ovsp[iso] ?? encovi[iso] ?? null,
    fuente: ovsp[iso] ? 'OVSP 2024 Q4' : encovi[iso] ? 'ENCOVI 2023' : null,
  }
}
```

### Integración

```ts
const ELECTRICIDAD: Indicator = {
  id: 'electricidad_estable_2024',
  label: 'Acceso eléctrico estable · OVSP/ENCOVI',
  description: 'Porcentaje de hogares con servicio eléctrico estable (sin cortes >4hrs diarias)',
  unit: '% de hogares',
  format: 'rate',
  year: 2024,
  source: 'OVSP 2024 Q4 (12 ciudades) + ENCOVI 2023 (resto)',
  note: 'Combina dos fuentes con precedencia OVSP > ENCOVI. Algunos estados pequeños tienen estimación aproximada.',
  aggregation: 'state',
  nationalAggregation: 'mean',
  data: stateField('pct_electricidad_estable'),
}
```

### Decisiones de UI
- **Paleta**: `greens` invertida (más verde = más acceso = mejor) o `rdbu`
  para mostrar deficiencia vs cobertura
- **Unidad**: "% de hogares con servicio estable" — fraseado positivo
- **Note crítico**: explicar que combina dos fuentes; transparencia
  metodológica

### Limitaciones
- "Estable" es subjetivo. OVSP usa "sin cortes >4hrs". Otras fuentes pueden
  usar definiciones distintas
- Boletines OVSP son anuales/trimestrales; la realidad cambia rápido. La
  métrica es snapshot
- Algunos estados (Amazonas, Delta Amacuro) tienen cobertura eléctrica baja
  por geografía, no solo por crisis — vale notarlo

### Esfuerzo: 1-2 días
Más complejo que #2 por la fusión de dos fuentes, pero el patrón de script
es similar.

---

## Orden recomendado de implementación

```
Día 1-2:  Pre-requisitos estructurales (ver Anexo)
Día 3-5:  Indicador 1 · Diáspora por estado de origen
Día 6-7:  Indicador 2 · Pobreza multidimensional ENCOVI
Día 8-9:  Indicador 3 · Acceso a electricidad continua
Día 10:   QA visual de los 3 juntos + audit de leyendas
Día 11:   Update de FAQ (datos y fuentes), actualizar conteo de indicadores
          en README, agregar al catálogo de la home
```

**Por qué este orden**:

1. **Diáspora primero**: máximo SEO impact + diferenciación más clara
2. **Pobreza después**: reutiliza el script de ENCOVI ya hecho para
   diáspora, ROI alto
3. **Electricidad al final**: el más complejo (dos fuentes), pero el patrón
   ya está validado

---

## Anexo · Cambios estructurales recomendados antes

Dos cambios chicos que **conviene hacer antes** del indicador 1 porque
después afectan a los 3.

### A) Schema explícito de fuente en el tipo `Indicator`

Hoy `source: string` mete todo junto. Para citar correctamente:

```ts
export type IndicatorSource = {
  org: string             // 'IIES-UCAB'
  shortLabel: string      // 'ENCOVI 2023'
  url?: string            // 'https://www.proyectoencovi.com/'
  publishedDate?: string  // '2024-06'
  asOfDate?: string       // '2023' (año de los datos, no de publicación)
  citation?: string       // formato académico
}

export type Indicator = {
  // ...
  source: string | IndicatorSource  // backward-compat
}
```

**Esfuerzo**: 0.5 días. **Beneficio**: cuando agregues 5+ indicadores nuevos
con fuentes distintas, los podés citar bien en la UI (link al PDF original,
etc.).

### B) Extraer `STATE_TO_ISO` + `normalize()` a `scripts/lib/state-mappings.mjs`

Hoy estos helpers están duplicados en cada script (`process-sourcecv.mjs`,
`process-ine-population.mjs`). Cuando agregues 3 scripts nuevos, la
duplicación se vuelve dolorosa.

**Esfuerzo**: 0.5 días. **Beneficio**: cambios en mapeos se hacen en un solo
lugar.

---

## Estado del informe

- [ ] Pre-requisito A: schema `IndicatorSource`
- [ ] Pre-requisito B: extraer helpers a `scripts/lib/`
- [ ] Indicador 1: diáspora por estado
- [ ] Indicador 2: pobreza multidimensional
- [ ] Indicador 3: acceso a electricidad

Marcar checkboxes a medida que se implementen.

---

*Documento mantenido en `docs/INDICADORES_TIER_S.md`. Última actualización: 2026-05-24.*
