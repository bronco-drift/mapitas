# Mapitas — Documento de Producto

> Especificación funcional de qué hace Mapitas, para quién, con qué prioridades y cómo se mide el éxito. Complementa `DOCUMENTACION.md` (misión/visión) con detalle de producto.
>
> Versión: 0.1 · Fecha: 2026-05-23 · Mantenedor: Mapitas Admin (bronco.drift@outlook.com)

---

## 1. Producto en una frase

**Una herramienta web gratis y sin login que permite visualizar cualquier dataset territorial sobre el mapa de Venezuela en menos de un minuto, ya sea usando indicadores oficiales pre-cargados o subiendo un CSV/Excel propio.**

---

## 2. Jobs to be done

Lo que el usuario está realmente "contratando" a Mapitas para hacer:

### 2.1 Jobs primarios (hoy)

| Job | Pista de uso |
|---|---|
| "Quiero ver cómo se distribuye [X indicador] en Venezuela" | Indicadores pre-cargados, cambio de nivel (estado / muni), elección de paleta |
| "Tengo mis propios datos por estado/municipio y quiero mapearlos" | Upload CSV/Excel, mapping de columnas, fuzzy matching |
| "Quiero entender un territorio específico" | Click en polígono → ficha con valor + nombre oficial + ISO |
| "Quiero exportar el mapa para mi nota / informe" | Toggle "fondo transparente", "aislar país", paleta custom, screenshot |
| "Quiero ver mi dato propio en contexto territorial" | Capas temáticas (áreas protegidas, indígenas, petróleo, etc.) sobre el dato propio |

### 2.2 Jobs latentes (mañana)

- "Quiero reportar [hueco / robo / alcabala] en mi zona y que aparezca en el mapa público" — requiere backend, hoy no existe
- "Quiero comparar Venezuela con países vecinos" — requiere expansión LATAM
- "Quiero ver la evolución de [indicador] en los últimos 20 años" — requiere timeline slider (en backlog)

---

## 3. User journey principal

### 3.1 Primera visita (cold start)

```
Landing (hero "Mapas de Venezuela. Datos al instante.")
   ↓ click "Abrir el mapa"
App carga (lazy)
   ↓ se selecciona automáticamente el primer indicador
Usuario ve mapa pintado con la paleta default (viridis)
   ↓ explora cambiando indicador / nivel / paleta
[opcional] sube su CSV → mapping → ve su data
   ↓
Click en polígono → ficha en sidebar con detalle
```

**Tiempo objetivo "hello map"**: < 30 segundos desde landing hasta ver Venezuela pintada.

### 3.2 Visita recurrente (warm start)

Zustand persiste en localStorage:
- Indicador activo
- Nivel (adm0/adm1/adm2)
- Tab abierta (Datos/Capas/Estilo)
- Estilo completo (paleta, opacidades, basemap, borders, etc.)
- Capas temáticas habilitadas
- Custom range si lo definió

Al volver, el usuario aterriza exactamente donde estaba. Solo se re-fetchea la geo (no se persiste por peso).

---

## 4. Personas

### 4.1 Andrea — Periodista de medio digital
- Tiene que ilustrar una nota sobre desigualdad regional en VE
- Hoy buscaría una imagen en Google o pediría a un diseñador
- Con Mapitas: sube su CSV de la nota, elige paleta, screenshot, lo mete en la nota
- **Mide éxito por**: tiempo ahorrado, calidad visual del resultado
- **Lo que NO le importa**: análisis estadístico avanzado, GIS profesional

### 4.2 Luis — Investigador / académico
- Estudia distribución territorial de algún fenómeno
- Hoy usa QGIS o R, pero solo cuando el análisis lo justifica
- Con Mapitas: visualizaciones exploratorias rápidas antes de irse al stack pesado
- **Mide éxito por**: precisión de los datos, capacidad de ajustar clasificación
- **Lo que NO le importa**: estética; quiere control técnico

### 4.3 María — ONG / sociedad civil
- Trabaja en territorio (Provita, observatorio, fundación)
- Necesita comunicar al público resultados con base territorial
- Con Mapitas: cruza sus datos con capas oficiales (territorios indígenas, áreas protegidas)
- **Mide éxito por**: poder superponer múltiples capas, exportar con calidad
- **Lo que NO le importa**: features de personalización extrema

### 4.4 Carlos — Ciudadano curioso
- Lee una nota sobre Venezuela y quiere explorar más
- Llega a Mapitas porque alguien compartió un link
- No sube nada: solo navega indicadores, cambia paleta, hace zoom
- **Mide éxito por**: que entienda algo nuevo sin sentir que necesita un manual
- **Lo que NO le importa**: nada técnico

> El mantenedor encarna las 4 personas. El producto se diseña con esa empatía: la misma herramienta debe servir al ciudadano de Carlos y al investigador de Luis sin sacrificar a ninguno.

---

## 5. Features actuales

### 5.1 Estado actual (qué funciona hoy)

| Área | Feature | Estado |
|---|---|---|
| **Geo base** | 3 niveles (país/estado/municipio) con switch instantáneo | ✓ |
| **Indicadores** | 7 indicadores oficiales pre-cargados | ✓ |
| **Indicadores** | Badge `·N` con cobertura faltante + modal | ✓ |
| **Indicadores** | Aplicación a 3 niveles con agregación automática estado→muni si corresponde | ✓ |
| **Upload** | CSV / Excel / TSV / ODS | ✓ |
| **Upload** | Mapping interactivo de columnas (geo, valor, parent) | ✓ |
| **Upload** | Fuzzy matching de nombres | ✓ |
| **Upload** | Reporte de filas sin match con lista expandible | ✓ |
| **Estilo** | 12+ paletas predefinidas + paleta custom con 2 color pickers | ✓ |
| **Estilo** | Range editor con histograma y 3 handles (min/mid/max) | ✓ |
| **Estilo** | Auto-clip de outliers (percentiles 2/98) toggleable | ✓ |
| **Estilo** | Múltiples basemaps + opción "solid color" | ✓ |
| **Estilo** | Toggle "sin bordes" con stroke same-color para tapar gaps | ✓ |
| **Estilo** | Toggle "aislar país", "fondo transparente", "borde de país", etc. | ✓ |
| **Capas temáticas** | 11 capas Provita/IGVSB lazy-loaded | ✓ |
| **Capas temáticas** | Toggle individual con loading state | ✓ |
| **Interacción** | Click en polígono → ficha con nombre oficial + ISO + valor | ✓ |
| **Persistencia** | LocalStorage de todas las preferencias | ✓ |
| **Persistencia** | Restauración exacta al recargar | ✓ |
| **Reset** | Botón "Resetear" en footer con confirm | ✓ |
| **Mobile** | Bottom-sheet panel con handle, no oscurece mapa | ✓ |
| **Mobile** | Botón flotante "Panel" para abrir desde mapa | ✓ |
| **Routing** | Hash router (`#/` landing, `#/app` mapa) | ✓ |
| **SEO** | Document title dinámico por ruta | ✓ |
| **Performance** | Lazy load del bundle del mapa (~280kb) en la landing | ✓ |
| **Performance** | TopoJSON en lugar de GeoJSON (compartición de arcs) | ✓ |
| **LATAM** | Dropdown con 19 países, solo VE habilitado | ✓ (placeholder) |

### 5.2 Lo que existe pero está limitado

- **Indicador a nivel adm0 (país)**: cuando se elige país + upload CSV no hay merge real (placeholder, solo clear)
- **Esequibo y Dependencias Federales**: salen grises porque las fuentes oficiales no publican datos (ver BACKLOG)
- **Algunos municipios**: gaps puntuales (Ocumare de la Costa de Oro) o matching dudoso (Páez de Apure)

### 5.3 Lo que NO existe todavía (priorizado por impacto)

| Feature | Por qué importa | Esfuerzo |
|---|---|---|
| **Vista de tabla del indicador activo** (ordenable, exportable CSV) | Para "los N municipios con mayor X" la tabla es mejor que el mapa | Bajo |
| **Pintar manual tocando subdivisiones** | Caso de uso solicitado: la persona define su data dibujando, sin CSV | Medio |
| **Timeline slider** para indicadores con serie temporal | La data ya está (poblacion 2010/2020/2026/2050, idh 1990-2020), falta la UI | Medio |
| **Normalización Esequibo + Dep. Federales** (espejo + overrides + badge `≈`) | Hoy salen grises y el mapa se ve incompleto | Medio |
| **Formulario público de reportes ciudadanos** (huecos, alcabalas, etc.) | Visión de fondo del proyecto sobre transparencia ciudadana | Alto (requiere backend) |
| **Expansión a Colombia / Perú / LATAM** | El dropdown ya está, falta el pipeline de datos por país | Alto |

---

## 6. Métricas de éxito

> **[TODO: confirmar / completar esta sección]**
>
> Por la naturaleza del producto (sin backend, sin login, sin tracking propio), las métricas tradicionales (DAU/MAU, retention) requieren analytics externos. Posibles métricas a considerar, ordenadas por costo de implementación:

### 6.1 Métricas de uso (requiere analytics — Plausible / Umami)
- **Visitas a la landing** vs **clicks en "Abrir mapa"** → indica fricción de entrada
- **Sesiones que llegan a subir un CSV** vs solo navegar indicadores → indica activación
- **Sesiones que cambian al menos un setting de estilo** → indica engagement profundo
- **Sesiones que habilitan al menos una capa temática** → indica uso del feature menos descubrible
- **Retorno (mediante localStorage detectable) en la app** → indica que el producto se "vuelve hábito"

### 6.2 Métricas de calidad
- **% de CSVs subidos que matchean ≥ 90% de filas** → indica que el fuzzy matching funciona en data real
- **Tiempo desde landing hasta primer mapa pintado** (RUM) → indica que el LCP/lazy load está bien tuneado
- **Cantidad de indicadores con cobertura < 80%** → indica calidad de la base de datos

### 6.3 Métricas de impacto (cualitativas)
- **Notas / artículos / informes que citan o usan Mapitas** (búsqueda manual, alerta de menciones)
- **Forks / stars en GitHub** → indica que la comunidad técnica se interesó
- **Pedidos de "agregá mi país"** → indica que el modelo escala (señal para invertir en LATAM)

### 6.4 Métricas de visión (a largo plazo)
- **Cantidad de reportes ciudadanos** (cuando exista el formulario público)
- **Cobertura territorial de esos reportes** (¿solo Caracas? ¿se distribuye?)

> **Pregunta abierta:** ¿hay alguna métrica concreta que se quiera trackear o que defina "éxito" en los próximos 6 meses?

---

## 7. Roadmap por horizonte

### 7.1 Hoy (entregado)
Ver sección 5.1.

### 7.2 Próximos 1-3 meses (alto valor, esfuerzo bajo/medio)
- Vista de tabla del indicador activo
- Normalización Esequibo + Dep. Federales
- Audit de inconsistencias de datos (ver sección 9 abajo)
- Posiblemente: pintar manual tocando subdivisiones

### 7.3 Próximos 3-6 meses (medio plazo)
- Timeline slider para series temporales
- Export directo a PNG/SVG desde la UI (hoy se hace por screenshot)
- Posiblemente: agregar 1-2 países LATAM como prueba del modelo escalable
- Documentación pública del esquema de datos (`data/master/`) para que terceros aporten datasets

### 7.4 Más allá (visión, requiere decisiones grandes)
- Formulario público de reportes ciudadanos (requiere backend mínimo + moderación)
- Modelo de contribuciones abiertas para nuevos países
- Eventualmente: API pública para terceros que quieran consumir la base normalizada

---

## 8. Decisiones de producto clave

Decisiones que el código revela pero que merecen estar explícitas:

### 8.1 "Sin login, sin backend, sin tracking" como restricción
- No hay servidor; todo corre en browser
- Trade-off: imposible features colaborativas hoy
- Beneficio: costo de operación ≈ 0, máxima privacidad
- **Cuándo revisar**: cuando un feature crítico (reportes ciudadanos) lo exija

### 8.2 "Selección automática del primer indicador" en primera carga
- El usuario no se enfrenta a un mapa vacío gris
- Mejora dramática del primer impacto
- Trade-off: el primer indicador define la "primera impresión" del producto → debería ser uno relevante y bonito (hoy es el primero del array `INDICATORS`)

### 8.3 "Persistencia exacta en localStorage"
- El usuario que vuelve aterriza donde dejó (no en defaults)
- Pro: respeta el contexto del usuario
- Contra: si el usuario tiene un estilo "raro" guardado, eso es lo que ve siempre — el botón "Resetear" mitiga esto

### 8.4 "Picklist LATAM ya visible, solo VE habilitado"
- Comunica visión sin promesas concretas
- Pro: prepara al usuario para que entienda que esto va a crecer
- Contra: puede frustrar a alguien de Colombia que entra esperando que funcione
- **Alternativa a considerar**: ocultar el dropdown hasta que haya un segundo país

### 8.5 "Badge ·N en amber, no rose"
- Comunica "datos incompletos" sin alarmar
- Decisión consciente (comentada en código)

### 8.6 "Bottom-sheet mobile que NO oscurece el mapa"
- Decisión inusual: normalmente un drawer oscurece el fondo
- Hipótesis: el mapa es el contenido principal, no debe perder presencia visual cuando se interactúa con controles
- Riesgo: puede ser confuso (el tap fuera cierra el sheet pero no hay overlay visual que lo sugiera)

---

## 9. Inconsistencias detectadas que requieren resolución

> **Hallazgos del audit de código para la biblia de la IA**:

### 9.1 Conteos de estados/municipios (resuelto)

Canónico definido contra `data/master/` (fuente de verdad):

- **26 estados** (23 oficiales + Distrito Capital + Dependencias Federales + Estado Guayana Esequiba)
- **336 municipios**

Todas las fuentes públicas (`README.md`, `Landing.tsx`, `IndicatorsList.tsx`) actualizadas para reflejar estos números.

### 9.2 Conteo de paletas divergen

- README: "5 paletas + custom"
- Landing UI: "13 paletas, opacidades, basemaps, fondo transparente"
- Código: `PALETTE_OPTIONS` + `PALETTE_EXTRA` (revisar cuántas son en total)

### 9.3 Stack declarado vs real

`README.md` lista Turf.js como dependencia del frontend, pero `app/package.json` no lo tiene — Turf vive solo en `scripts/` (preprocesamiento). El README debería separar "deps frontend" vs "deps preprocesamiento".

### 9.4 Indicadores documentados vs implementados

- README: "7 indicadores pre-cargados: Población 2024/2026, IDH, PIB total, PIB per cápita, Área, Tasa de homicidios"
- Hay que verificar que esos 7 son los que están en `data/indicators.ts` y que ninguno está deprecated o duplicado

---

## 10. Anti-features (qué Mapitas decidió NO ser)

> **[TODO: confirmar — estas son interpretaciones razonables del código]**

- **No es un GIS profesional** (no buffer analysis, no edición geométrica, no raster)
- **No es una red social** (no login, perfiles, comentarios)
- **No es un dashboard corporativo** (no drill-downs, no joins entre datasets)
- **No vende ni monetiza** (gratis, open source, sin paywall)
- **No trackea al usuario** (sin analytics propios; si se agregan, deben ser anónimos y privacy-first como Plausible/Umami)
- **No depende de servidor** (todo en browser; cualquier feature que rompa esto requiere conversación explícita)

---

## 11. Preguntas abiertas para resolver

1. ¿Cuál es **la métrica única de éxito** que más nos importa en los próximos 6 meses? (sección 6)
2. ¿Cuándo se justifica romper "sin backend"? ¿Solo si los reportes ciudadanos lo exigen, o también para features menores? (sección 8.1)
3. ¿Estrategia de URLs para LATAM: subdirectorio (`mapitas.org/co`) o subdominio (`co.mapitas.org`) o dropdown único (`mapitas.org`)? (afecta arquitectura)
4. ¿Hay un compromiso de **soporte / mantenimiento** de los datos? Si INE publica datos nuevos en 2027, ¿cómo se incorporan?
5. ¿Cuál es el modelo de contribución? ¿Cualquiera puede mandar un PR con un nuevo indicador? ¿Hay un proceso de validación?

---

*Documento mantenido en `PRODUCT.md`. Última actualización: 2026-05-23.*
