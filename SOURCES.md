# Mapitas — Registro de fuentes

> Catálogo único de las fuentes que alimentan el master de Mapitas. Cualquier
> número o nombre que veas en la app puede trazarse hasta acá. Cuando
> agregues o modifiques una fuente, actualizar este archivo.

Estructura: por capa (geografía, indicadores, entidades especiales).

---

## 1. Geografía base (adm0, adm1, adm2)

### geoBoundaries (capa principal de polígonos)
- **URL:** https://www.geoboundaries.org/
- **Cobertura:** límites administrativos nacionales, estatales y municipales.
- **Procesamiento:** `scripts/enrich-geojson.mjs` + `scripts/clean-topology.mjs`
- **Notas:** algunos municipios creados después del shapefile no están
  (Páez de Apure se manejó manualmente, Ocumare de la Costa de Oro
  queda como gap, etc.). Renames aplicados en `scripts/fix-adm2.mjs`.

### Provita / IGVSB (fuente alternativa explorada)
- **URL:** https://geoportal.provita.org.ve/
- **Estado:** procesado en `scripts/enrich-from-provita.mjs` pero
  finalmente revertimos a geoBoundaries (mejor calidad topológica).
- **Uso actual:** sólo para capas temáticas (áreas protegidas, pueblos
  indígenas, etc.) descargadas y simplificadas en `app/public/data/thematic/`.

---

## 2. Indicadores

### INE Venezuela (Instituto Nacional de Estadística)
- **URL:** https://ine.gob.ve/
- **Cobertura en Mapitas:** `poblacion_2010`, `poblacion_2020`,
  `poblacion_2026`, `poblacion_2050` (a nivel municipal y estatal).
- **Origen:** proyecciones poblacionales con base censo 2011, publicadas
  como `.xls` por entidad federal en `ine.gob.ve/wp-content/uploads/2026/04/`.
- **Procesamiento:**
  - `scripts/fetch-ine-population.mjs` (descarga los 26 archivos)
  - `scripts/process-ine-population.mjs` (extrae + matchea con adm2)
- **Gaps:** Lara, Nueva Esparta y Dependencias Federales no fueron
  publicados con desglose municipal (slot ocupado por archivos de
  edad/sexo).

### Wikipedia (Anexo Municipios de Venezuela)
- **URL:** https://es.wikipedia.org/wiki/Anexo:Municipios_de_Venezuela_por_población_y_área
- **Cobertura en Mapitas:** `poblacion_2021`, `area_km2`, `densidad`,
  `capital` (a nivel municipal).
- **Origen primario:** Wikipedia recopila estimaciones poblacionales
  basadas en proyecciones INE 2021 y datos IGVSB para superficies.
- **Procesamiento:** `scripts/process-wikipedia-municipios.mjs`
  (parsea las 4 sub-tablas con cheerio, matchea contra adm2).
- **Cobertura efectiva:** 324/335 municipios (97%).

### Source CV (Excel del proyecto)
- **Archivo:** `data/sourceCV-input.xlsx`
- **Cobertura en Mapitas:**
  - `porcentaje_urbano_2021` (municipal, derivado de pob_capital/pob_total)
  - `idh_1990`, `idh_2000`, `idh_2010`, `idh_2020`,
    `idh_cambio_2010_2020` (estatales)
- **Origen primario:** recopilación histórica del IDH publicada por
  PNUD Venezuela / observatorios académicos.
- **Procesamiento:** `scripts/process-sourcecv.mjs`
- **Cobertura efectiva:** 24/26 estados con IDH histórico (faltan
  Dep. Federales y Guayana Esequiba en la fuente original).

### CSV sintético (estimaciones internas)
- **Archivo:** `raw-sources/municipios_venezuela_2026.csv`
- **Cobertura en Mapitas:** `idh` (estimado 2026), `pib_total_mm_usd`,
  `pib_per_capita_usd`.
- **Origen:** generación interna del proyecto (no hay fuente oficial
  pública de IDH o PIB municipal en Venezuela; el BCV no publica
  cuentas regionales municipales).
- **Caveat:** ~97 filas tienen placeholders (nombres tipo "Municipio
  Barinas 1"). Cobertura efectiva ~153/336 munis con nombres reales.
- **Procesamiento:** `scripts/process-municipal-csv.mjs`

### OVV (Observatorio Venezolano de Violencia)
- **URL:** https://observatoriodeviolencia.org.ve/
- **Cobertura en Mapitas:** `homicidios` (tasa por 100k habitantes, estatal).
- **Origen:** referencias OVV 2023.
- **Caveat:** valores ilustrativos hardcoded en `app/src/data/indicators.ts`,
  no proceden de un dataset descargado.

### Estimaciones pre-existentes (legacy)
- **Cobertura:** `poblacion_2024` estatal (números redondos).
- **Estado:** hardcoded en `indicators.ts`, aproximaciones del proyecto
  original. Reemplazables por las proyecciones INE oficiales 2024 si
  hace falta.

---

## 3. Entidades especiales (overrides manuales)

Estos dos casos requieren overrides porque las fuentes regulares no los
cubren bien. Los valores específicos viven en
`data/sources/special-entities-overrides.json`. Cada campo tiene su
fuente declarada inline en ese JSON.

### Guayana Esequiba (VE-GE)

Territorio en disputa con Guyana. Reclamado por Venezuela. Sin
administración venezolana efectiva.

| Campo | Valor | Fuente |
|---|---|---|
| Capital | Tumeremo | Asamblea Nacional, ley marzo 2024 |
| Área | 159,500 km² | Constitución de Venezuela 1999 |
| Población 2021 | ~125,000 | Consenso de fuentes; densidad 0.77 hab/km² |
| IDH histórico | espejado de Delta Amacuro | Perfil demográfico comparable |

**Fuentes consultadas:**
- [Tumeremo, capital provisional del Esequibo · Efecto Cocuyo](https://efectococuyo.com/politica/tumeremo-la-capital-provisional-del-esequibo-ubicada-a-mas-de-90-kilometros-de-la-zona-en-reclamacion/)
- [Guayana Esequiba · Wikipedia](https://en.wikipedia.org/wiki/Guayana_Esequiba)
- [La población del Esequibo venezolano · Ven para Saber](https://venparasaber.com/la-poblacion-del-esequibo-venezolano/)
- [Las claves para conocer el Esequibo · SWI swissinfo](https://www.swissinfo.ch/spa/las-claves-para-conocer-el-esequibo-el-territorio-en-disputa-entre-venezuela-y-guyana/49059818)
- [Quiénes habitan el Esequibo · Bloomberg Línea](https://www.bloomberglinea.com/2023/04/11/quienes-son-y-de-que-viven-las-personas-que-habitan-el-esequibo/)

**Notas importantes:**
- Tumeremo NO está dentro del territorio Esequibo (está en Bolívar,
  a ~93 km del límite). Por eso `poblacion_capital_2021` y
  `porcentaje_urbano_2021` quedan en NULL (sería engañoso reportar
  población de una ciudad fuera del territorio como "capital").
- IDH histórico se espeja de Delta Amacuro por similitud demográfica
  (alta población indígena, baja densidad, frontera). Marcar
  visualmente como estimación en el modal de cobertura cuando aplique.

### Dependencias Federales (VE-W)

Archipiélagos venezolanos en el Mar Caribe (Los Roques, Las Aves,
La Tortuga, La Blanquilla, La Orchila, Los Hermanos, Los Frailes,
etc.). Dependientes del gobierno federal, no de un estado.

| Campo | Valor | Fuente |
|---|---|---|
| Capital | Gran Roque | INE Venezuela / oficial |
| Área | 342.25 km² | INE / IGVSB |
| Población 2011 | 2,155 (exacto) | INE censo 2011 |
| Población Gran Roque | 1,471 (68.2%) | INE censo 2011 |

**Fuentes consultadas:**
- [Dependencias Federales · INE PDF](http://iies.faces.ula.ve/Censo2011/dependenciasfederales.pdf)
- [Federal Dependencies of Venezuela · Wikipedia](https://en.wikipedia.org/wiki/Federal_Dependencies_of_Venezuela)
- [Dependencias federales de Venezuela · Wikipedia ES](https://es.wikipedia.org/wiki/Dependencias_federales_de_Venezuela)
- [Anexo: Entidades federales por población · Wikipedia](https://es.wikipedia.org/wiki/Anexo:Entidades_federales_de_Venezuela_por_poblaci%C3%B3n,_superficie_y_densidad)

**Notas importantes:**
- Población muy estable a lo largo del tiempo (no hay servicios
  públicos que motiven crecimiento). Las proyecciones lineales no
  aplican como en otros estados.
- IDH histórico estatal NULL (Source CV no incluye DepFed; no
  inventamos).
- PIB estimado: turismo de élite (Los Roques) + pesca. PIB per cápita
  alto a pesar del total chico.

---

## 4. Cómo agregar una fuente nueva

1. Conseguir el archivo (CSV / XLSX / JSON / HTML).
2. Crear un script en `scripts/process-<nombre>.mjs` que:
   - Lea el archivo desde `raw-sources/` o `data/sources/input/`.
   - Normalice los nombres de munis/estados.
   - Matchee contra el adm2 (usar el normalize + aliases compartidos
     de `build-master.mjs`).
   - Escriba un JSON intermedio en `data/sources/<nombre>.json`.
3. Actualizar `build-master.mjs` para que lea ese JSON intermedio y lo
   mergee al master con la precedencia que corresponda.
4. Actualizar este archivo (`SOURCES.md`) con la nueva fuente.
5. Si aporta indicadores nuevos: agregarlos a `app/src/data/indicators.ts`
   con su label, source, note y aggregation correctos.

## 5. Cómo registrar un override manual

Si un valor específico debe pisarse (entidad especial, dato oficial
hardcoded, etc.):

1. Agregar la entrada en `data/sources/special-entities-overrides.json`
   con la estructura `{ value, source, url? }` por campo.
2. El override pisa cualquier valor previo del pipeline.
3. Actualizar este `SOURCES.md` con la fila correspondiente y la URL
   de la fuente que respalda el valor.
