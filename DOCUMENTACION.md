# Mapitas — Documentación del Proyecto

> Este documento es la fuente única de verdad sobre **qué es Mapitas, por qué existe y hacia dónde va**. Está pensado para que cualquier persona (o IA) que llegue al proyecto pueda entender el contexto completo sin tener que reconstruirlo desde el código.
>
> Versión: 0.1 · Fecha: 2026-05-23 · Mantenedor: Mapitas Admin (bronco.drift@outlook.com)

---

## 1. Misión

**Hacer la transparencia territorial accesible para cualquier persona.**

Mapitas permite que cualquiera —periodista, investigador, ONG, ciudadano común— pueda subir un CSV o Excel y ver sus datos pintados sobre el mapa de Venezuela en segundos. Sin pagar Datawrapper o Tableau, sin saber GIS, sin instalar nada, sin backend.

La misión no se agota en "pintar mapas". El objetivo de fondo es que **datos relevantes para la ciudadanía** —huecos en las calles, robos, alcabalas, puntos de corrupción, indicadores oficiales dispersos— dejen de estar encerrados en PDFs, planillas y silos institucionales, y pasen a ser **visibles, comparables y públicos** sobre un mapa que todos entienden.

---

## 2. Visión

Una herramienta **escalable, sostenible, documentada, clara, óptima y eficiente** que:

1. **Hoy:** resuelva el caso Venezuela con calidad de producto serio (datos limpios, geometrías validadas, UX simple).
2. **Mañana:** se extienda al resto de LATAM con la misma base arquitectónica (el picklist LATAM ya está preparado en el código).
3. **Eventualmente:** se vuelva infraestructura genérica para cualquier país con datos abiertos.

La regla de oro detrás de cada decisión técnica: **lo que se construye hoy tiene que poder soportar el próximo país sin reescribirse**.

---

## 3. El problema que resuelve

### 3.1 Síntomas que motivaron el proyecto

- **No hay mapas pintables públicos sobre Venezuela.** Datawrapper y Flourish cuestan; QGIS exige curva técnica; los mapas oficiales son estáticos y desactualizados.
- **Los datos oficiales están dispersos y en formatos incompatibles.** INE publica por su lado, OVV (Observatorio Venezolano de Violencia) por el suyo, Provita/IGVSB por el suyo, Wikipedia agrega lo que puede. Nadie los unifica.
- **Periodistas y comunicadores hacen mapas a mano** en Excel o PowerPoint porque las herramientas profesionales son caras o complejas.
- **La ciudadanía no tiene dónde reportar ni visualizar** datos hiperlocales relevantes (huecos, robos, alcabalas, irregularidades). Esa información existe en chats de WhatsApp, en denuncias en redes, en cabezas — pero no en un mapa.

### 3.2 La oportunidad

Si una persona puede subir su CSV y ver el resultado en 30 segundos, y si esa visualización se puede combinar con **capas oficiales** (áreas protegidas, territorios indígenas, lotes petroleros, cuencas, vialidad, energía), entonces:

- El periodista publica una nota con un mapa propio en lugar de una imagen genérica de Google.
- La ONG documenta un patrón territorial sin contratar consultoría GIS.
- El ciudadano entiende su país visualmente, no en planillas.
- El investigador cruza datos en minutos en lugar de días.

Mapitas es **la capa de visualización que faltaba** entre los datos crudos y la persona que necesita entenderlos.

---

## 4. Usuarios objetivo

Mapitas se construye con un principio de **inclusión por niveles de profundidad**: la misma herramienta sirve al ciudadano curioso y al investigador especializado, simplemente exponiendo distintos niveles de control.

| Perfil | Cómo lo usa | Profundidad |
|---|---|---|
| **Ciudadano común** | Abre la página, mira los indicadores pre-cargados (población, IDH, homicidios), explora visualmente | Baja — sólo lectura |
| **Periodista / comunicador** | Sube su CSV con datos de una nota, elige paleta, exporta o screenshotea | Media — input + estilo |
| **ONG / sociedad civil** | Cruza sus reportes con capas temáticas (territorios indígenas, áreas protegidas, etc.) | Media-alta — cruces |
| **Investigador / academia** | Combina indicadores oficiales con data propia, ajusta clasificaciones, analiza patrones | Alta — todo el toolkit |

> **El mantenedor encarna las cuatro categorías.** El producto se diseña con esa empatía: lo que es trivial para el experto no debe ser inaccesible para el ciudadano, y viceversa, la simplicidad de la portada no debe limitar al investigador.

---

## 5. Propuesta de valor

Tres cosas que con Mapitas son fáciles y antes no lo eran:

1. **Pintar un mapa de Venezuela con datos propios en menos de un minuto.** Sin GIS, sin instalación, sin pago. CSV → mapa.
2. **Cruzar datos propios con capas oficiales** (Provita / IGVSB) — áreas protegidas, territorios indígenas, vialidad, lotes petroleros, energía, cuencas, etc.
3. **Acceder a una base normalizada y limpia** de los 24 estados + Distrito Capital + Dependencias Federales + Guayana Esequiba (27 entidades total) y 337 municipios de Venezuela, con nombres oficiales, claves consistentes y geometrías validadas.

---

## 6. Qué hace Mapitas hoy (estado actual)

### 6.1 Cobertura geográfica
- **27 estados** con nomenclatura oficial (Gaceta) y nombres cortos
- **337 municipios** con `parentState`, `compoundKey` y normalización de nombres
- Geometrías base de **geoBoundaries** (William & Mary, CC BY 4.0)
- Geometrías del **Esequibo** vía Provita / IGVSB

### 6.2 Indicadores pre-cargados
7 indicadores listos para visualizar sin subir nada:
- Población 2024 / 2026
- IDH (Índice de Desarrollo Humano)
- PIB total
- PIB per cápita
- Área (km²)
- Tasa de homicidios (OVV)

### 6.3 Capas temáticas (lazy-loaded)
11 capas del catálogo Provita / IGVSB: Áreas Protegidas, Territorios Indígenas, Cuencas, Vialidad, Lotes Petroleros, Energía, etc.

### 6.4 Carga de datos del usuario
- Soporta CSV y Excel (.xlsx)
- **Detección automática de columnas** (intenta adivinar cuál es el nombre del muni/estado y cuál es el valor)
- **Fuzzy matching** de nombres (tolera tildes, mayúsculas, abreviaciones)

### 6.5 Personalización visual
- 5 paletas predefinidas + paleta custom con 2 color pickers
- Controles de grosor de borde, color, fondo
- Toggle "aislar país" (oculta vecinos)
- Toggle jerarquía estado / municipio

### 6.6 Arquitectura para escalar
- Picklist LATAM preparado para sumar más países sin refactor

---

## 7. Qué NO es Mapitas

> **[TODO: confirmar / ajustar estos límites — son interpretaciones razonables, no afirmaciones explícitas del mantenedor]**

- **No es un GIS profesional.** No reemplaza QGIS ni ArcGIS. No hace análisis espacial avanzado (buffers, intersecciones programáticas, raster).
- **No es una red social.** No hay login, perfiles, comentarios, "me gusta". Es una herramienta, no una plataforma.
- **No es un dashboard corporativo.** No es Tableau ni PowerBI. No hace drill-downs ni joins complejos de tablas.
- **No es exclusivamente académico.** La UX debe servir igual a un investigador que a un ciudadano sin formación técnica.
- **No depende de backend propio** (hoy). Todo corre en el navegador, lo que mantiene los costos de operación cerca de cero y elimina dependencia de servidor.

---

## 8. Principios fundacionales

### 8.1 Principios de producto e ingeniería

Las palabras que definen cómo se debe construir Mapitas, en orden de prioridad:

1. **Escalable** — lo que funciona para Venezuela debe poder soportar Colombia, Perú y eventualmente el mundo, sin reescribir el core.
2. **Sostenible** — bajo costo de operación (static-first, sin backend), bajo costo de mantenimiento (data en `data/master/`, scripts versionados).
3. **Documentado** — este archivo, el README, el BACKLOG, los scripts comentados. Nadie debería tener que adivinar.
4. **Claro** — la UX no debe pedir explicación. Si hace falta un tutorial, está mal diseñado.
5. **Óptimo** — geometrías simplificadas, lazy-loading de capas temáticas, TopoJSON donde se puede.
6. **Eficiente** — no agregar features hasta que un usuario real las pida; no agregar dependencias hasta que duelan no tenerlas.

> Estos principios son la rúbrica contra la cual se evalúa cualquier propuesta de cambio. Si una feature mejora algo pero rompe "escalable" o "sostenible", se descarta o se rediseña.

### 8.2 Principio de estética: Apple / Anthropic

Toda decisión de diseño de UI en Mapitas se piensa desde la lente de **Apple y Anthropic**. Esto no es decorativo — es la rúbrica concreta contra la que se evalúa cada componente, página o feature.

**Qué significa concretamente:**

- **Minimalista** — solo los elementos que aportan; nada decorativo por decoración. Si un elemento no comunica información o no permite una acción, sobra.
- **Espacios bien usados** — whitespace generoso, jerarquía visual clara por aire y no por borders o backgrounds.
- **Tipografía como protagonista** — tamaños grandes en hero/headlines, tracking apretado (-0.025em en titulares), system fonts. La tipografía sustituye a la decoración.
- **Animaciones sutiles** — `transition` ubicuos sí; animaciones llamativas (bounces, fades largos, parallax) no.
- **Sin AI slop** — nada genérico, predecible o sobre-decorado. Cero gradientes ornamentales, sombras innecesarias, emojis decorativos, cards con border + shadow + gradient + ring.

**Cómo aplicar en la práctica:**

1. Antes de aceptar un componente nuevo, preguntate: *"¿algo así existiría en apple.com o anthropic.com?"* Si la respuesta es "no" o "no sé", probablemente sobra decoración.
2. Cuando dudes entre dos opciones, elegí la más sobria.
3. Borders finos (1px de `slate-100/200`), no pesados.
4. Sombras solo cuando aportan función (elevación real de un elemento sobre otro), nunca para "dar profundidad" decorativa.
5. Iconografía SVG inline lucide-style, no librerías de iconos.
6. CTAs rounded-full (pill), fondo dark, no gradientes.

**Referencias visuales:** apple.com · anthropic.com · linear.app · notion.so · vercel.com.

Este principio **no es opcional ni negociable** sin discusión explícita. Es lo que le da personalidad a Mapitas y lo diferencia de un "dashboard de transparencia genérico".

---

## 9. Arquitectura técnica

### 9.1 Stack
| Capa | Tecnología |
|---|---|
| Build | Vite |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS v4 |
| Mapa | Leaflet + React-Leaflet |
| Estado | Zustand |
| Parseo CSV | PapaParse |
| Parseo Excel | SheetJS (xlsx) |
| TopoJSON | topojson-client |
| Geometría | Turf.js (en scripts de preprocesamiento) |
| Despliegue | Vercel (configurado en `vercel.json`) |

### 9.2 Arquitectura general
```
[ CSV/Excel del usuario ]
            ↓
   [ Detección + fuzzy match ]
            ↓
[ Mapa Leaflet con GeoJSON enriquecido ]
            ↑
[ data/master/ (estados + munis normalizados) ]
            ↑
[ scripts/ (enriquecen desde fuentes crudas) ]
            ↑
[ raw-sources/ (INE, OVV, Provita, Wikipedia, etc.) ]
```

### 9.3 Decisiones técnicas clave
- **Static-first, sin backend.** Todo el procesamiento del CSV del usuario sucede en el browser. La data oficial está pre-generada y servida como assets estáticos. Esto baja el costo de hosting a casi cero y permite cachear todo en CDN.
- **Separación `data/` ↔ `app/`.** Los scripts de preprocesamiento (Node) viven en la raíz del repo; la app frontend en `app/`. Esto permite regenerar la base de datos sin tocar la app, y publicar la app sin incluir herramientas de preprocesamiento.
- **TopoJSON sobre GeoJSON** donde se puede, para reducir peso de transferencia.
- **Lazy-loading de capas temáticas.** Las 11 capas no se cargan en el bootstrap, sino bajo demanda.

### 9.4 Pipeline de datos
1. **Fuentes crudas** en `raw-sources/` (shapefiles, CSV oficiales, etc.)
2. **Scripts de procesamiento** en `scripts/`:
   - `process-ine-population.mjs` — INE
   - `process-sourcecv.mjs` — Source CV
   - `process-wikipedia-municipios.mjs` — Wikipedia
   - `process-municipal-csv.mjs` — CSV municipal
   - `convert-provita.mjs` — capas temáticas Provita
   - `simplify-thematic.mjs` — simplifica geometrías
   - `enrich-geojson.mjs` / `enrich-from-provita.mjs` — enriquecen el GeoJSON base
   - `build-master.mjs` — consolida en `data/master/`
3. **Output canónico** en `data/master/`:
   - `states.json` / `states.csv`
   - `municipalities.json` / `municipalities.csv`
   - `coverage-report.json` (qué indicador cubre qué entidades)
4. **GeoJSON enriquecidos** en `data/venezuela-adm{0,1,2}-enriched.geojson`

---

## 10. Fuentes de datos

| Fuente | Qué aporta | Licencia |
|---|---|---|
| **geoBoundaries** (William & Mary) | Geometrías base estado/muni | CC BY 4.0 |
| **Provita / IGVSB** | Geometrías del Esequibo + 11 capas temáticas | CC BY 4.0 |
| **INE Venezuela** | Población oficial 2010-2050 | Pública |
| **OVV** (Observatorio Venezolano de Violencia) | Tasa de homicidios | Pública |
| **Source CV** | IDH histórico 1990-2020 | Pública |
| **Wikipedia** | Datos auxiliares de municipios | CC BY-SA |

> Los datos marcados como "datos ilustrativos · validar contra fuente oficial" en la UI deben tratarse como aproximaciones, no como verdad oficial.

---

## 11. Roadmap

Items en el backlog actual (`BACKLOG.md`), ordenados por impacto:

### 11.1 Próximo (alto impacto)
- **Vista de tabla** del indicador activo, ordenable y exportable a CSV. Caso de uso: "los 10 municipios con mayor IDH" se lee más rápido en tabla que escaneando el mapa.
- **Normalización de Esequibo y Dependencias Federales** — hoy quedan grises porque las fuentes oficiales no publican datos. Plan: espejo automático + overrides manuales explícitos + badge `≈` para estimaciones.
- **Timeline slider** para indicadores con serie temporal (población 2010/2020/2026/2050, IDH 1990-2020). Hoy cada año es un indicador separado; se podrían animar las transiciones.

### 11.2 Mediano plazo
- **Pintar mapa tocando subdivisiones** directamente (interacción más visual, sin pasar por CSV).
- **Formulario público de reportes ciudadanos** (huecos, robos, alcabalas). Esto requeriría introducir un backend mínimo, lo que rompe parcialmente el principio "sin servidor" — habrá que evaluar el trade-off.
- **Otros municipios pendientes**: Páez de Apure (auditar matching), Ocumare de la Costa de Oro (gap real del adm2).

### 11.3 Largo plazo
- **Expansión a Colombia, Perú y resto de LATAM.** El picklist LATAM ya está preparado; falta el pipeline de datos por país.
- **Modelo de contribuciones abiertas** para que otros países se sumen sin depender del mantenedor original.
- **Migrar preprocesamiento a Python + pandas** si las fuentes crecen más allá de las 4-5 actuales.

---

## 12. Génesis del proyecto

> **[TODO: completar / corregir esta sección con la historia real]**
>
> Posibles ángulos a desarrollar:
> - ¿Hubo un momento específico que disparó la idea? (una nota que querías ilustrar y no pudiste, una frustración trabajando con datos de VE)
> - ¿Hay una motivación personal con Venezuela como país? (vínculo personal, familiar, profesional)
> - ¿Cuál es tu apuesta de fondo? (¿transparencia como bien democrático?, ¿que la gente entienda mejor su país?, ¿bajar la barrera técnica?)
> - ¿Hubo proyectos previos tuyos que llevaron a Mapitas?
> - ¿Por qué decidiste open-source / public-good en vez de SaaS comercial?

Sin estos elementos, el documento queda funcional pero no tiene "alma" — y esa alma es lo que va a hacer que la biblia que escriba la IA después se sienta como un proyecto real y no como otro CRUD más.

---

## 13. Glosario

| Término | Significado |
|---|---|
| **adm0** | Adm Boundary nivel 0 — país (Venezuela completa) |
| **adm1** | Nivel 1 — estados (27 entidades) |
| **adm2** | Nivel 2 — municipios (337) |
| **compoundKey** | Clave única `{estadoISO}-{muniSlug}` usada para joinear data |
| **parentState** | Estado al que pertenece un municipio |
| **fuzzy matching** | Comparación de nombres tolerante a tildes, mayúsculas, abreviaciones |
| **lazy-loading** | Cargar un recurso sólo cuando el usuario lo pide, no en el bootstrap |
| **TopoJSON** | Formato derivado de GeoJSON que comparte arcos entre polígonos vecinos — más liviano |
| **IGVSB** | Instituto Geográfico de Venezuela Simón Bolívar |
| **OVV** | Observatorio Venezolano de Violencia |
| **INE** | Instituto Nacional de Estadística (Venezuela) |
| **Provita** | ONG venezolana de conservación; mantiene el geoportal de capas temáticas |

---

## 14. Notas para la auditoría posterior

Para la IA que vaya a auditar este documento y escribir la "biblia" del proyecto, los puntos que vale la pena profundizar:

1. **Validar la coherencia interna**: ¿La misión declarada se cumple con las features actuales? ¿Hay features sin razón de ser? ¿Hay razones de ser sin features?
2. **Auditar el roadmap contra la misión**: ¿Los próximos pasos están alineados con "transparencia ciudadana" o se desvían hacia "herramienta GIS genérica"?
3. **Revisar los principios fundacionales como rúbrica**: tomar cada decisión técnica documentada y evaluarla contra los 6 principios (escalable, sostenible, documentado, claro, óptimo, eficiente).
4. **Identificar tensiones no resueltas**: por ejemplo, "datos ciudadanos colaborativos" vs "sin backend" — son objetivos en conflicto que el documento debería abordar.
5. **Completar la sección Génesis** con el mantenedor antes de cerrar la biblia — sin eso el proyecto queda sin contexto humano.

---

*Documento mantenido en `DOCUMENTACION.md`. Última actualización: 2026-05-23.*
