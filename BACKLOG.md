# Backlog

Items pendientes que NO bloquean lo actual pero queremos retomar. Ordenados
de mayor a menor impacto percibido, no por dificultad.

---

## Mejorar borde de Venezuela en vista Global

Hoy en el mapa global hay **overlap visible en fronteras** entre VE y sus
vecinos (Colombia, Brasil, Guyana, Trinidad). La causa: para mostrar el
Esequibo, las islas y los límites marítimos reclamados, reemplazamos la
geometría de VE en `world-countries.geojson` con la del `venezuela-adm0-
enriched.geojson` (fuente: geoBoundaries / IGVSB con simplify 50m).

Los países vecinos siguen siendo Natural Earth 110m. Las dos fuentes NO
comparten exactamente las mismas líneas fronterizas — se cruzan unos km
acá y allá, dejando slivers de "missing color" o doble pintado.

Se nota especialmente:

- Frontera con Colombia (oeste, Apure, Táchira, Zulia).
- Frontera con Brasil (sur, Amazonas, Bolívar).
- Línea Esequibo-Guyana (donde ya tuvimos que filtrar slivers de
  `turf.difference`).

**Opciones a futuro**:

1. **Misma fuente para todos**: usar Natural Earth 50m + reemplazar VE
   con su versión enriquecida, pero alinear manualmente las fronteras
   (snapping de vértices comunes con tolerancia <0.01°).
2. **Rehacer VE con la frontera Natural Earth**: tomar el contorno
   exterior de VE-110m (que sí calza con vecinos) y añadirle a mano el
   Esequibo + islas. Mantiene compatibilidad de bordes.
3. **Topología compartida real**: armar un TopoJSON con todos los países
   donde los arcs fronterizos sean compartidos entre VE y Colombia/
   Brasil/Guyana. Más trabajo pero el resultado es perfecto.

Hasta resolverlo, los modos "Sin bordes" en Global pueden mitigar lo que
se ve, pero no es solución real.

---

## Visualización de tabla

Mostrar los datos del indicador activo como **tabla ordenable** además del
mapa. Casos de uso:

- "¿Cuáles son los 10 municipios con mayor IDH?" — más rápido leer una tabla
  que escanear el mapa.
- Periodistas que necesitan citar números exactos sin hacer hover muni por
  muni.
- Exportar a CSV directamente desde la vista actual.

UX sugerida: un toggle "Mapa / Tabla" en el TopBar o como pestaña adicional
al lado de Datos/Capas/Estilo. La tabla muestra columna del indicador activo
+ identidad (nombre, parent_state) y permite ordenar.

---

## Normalización de Esequibo y Dep. Federales

Ambos son entidades especiales en el adm: cada una existe simultáneamente
como **estado y como su único municipio**.

- **Guayana Esequiba (VE-GE)**: 1 estado, 1 muni con la misma geometría.
- **Dependencias Federales (VE-W)**: 1 estado, 1 muni con la misma geometría.

Hoy quedan en gris para la mayoría de los indicadores porque las fuentes
oficiales (INE, Wikipedia, Source CV) no publican datos para ellas.

**Plan**:

1. Una capa de "espejo automático": si el indicador no tiene data para
   `VE-GE`, copiar de `VE-Y` (Delta Amacuro — vecino fronterizo más
   similar en perfil demográfico). Para `VE-W` no hay vecino claro, usar
   data INE oficial cuando exista.
2. Para campos sin fallback razonable (PIB, IDH histórico), tener un
   `data/sources/manual-overrides.json` con valores estimados explícitos.
   Cada entry trae la nota del razonamiento (ej. "estimado en base a
   promedio Amazonas+Apure").
3. El badge `−NN` debería reflejar si esos valores son estimados/espejados,
   no oficiales. Quizás una marca `≈` en el modal de cobertura.

Trade-off: visualmente quedan completos los mapas (sin gris en esos 2
estados), pero perdemos honestidad estricta. La marca `≈` mitiga eso.

---

## Visualización por año (timeline slider)

Varios indicadores ya tienen **serie temporal**:

- INE: `poblacion_2010`, `poblacion_2020`, `poblacion_2026`, `poblacion_2050`
- Source CV: `idh_1990`, `idh_2000`, `idh_2010`, `idh_2020`

Hoy cada año es un indicador separado. La data está, falta la UI.

**Idea**: barra deslizadora horizontal abajo del mapa (estilo Google Earth
o Datawrapper). Al moverla, los colores del mapa se animan suavemente entre
los años disponibles.

Implementación:

1. Detectar qué indicadores son "miembros de una serie" (ej. cuando varios
   tienen el mismo prefijo `idh_*` o `poblacion_*` con sufijo de año).
2. Cuando el user selecciona uno de la serie, mostrar el slider con los
   años disponibles.
3. Mover el slider = cambiar el indicador activo a otro de la misma serie
   sin remount visual del mapa (transición de color).

Bonus: botón ▶ que reproduce automáticamente la serie en loop.

---

## Imágenes con fondo transparente (banderas/escudos)

Algunas banderas y la mayoría de los escudos cosechados desde Wikidata
vienen con **fondo transparente** (PNG con canal alpha). Al recortarlos
al polígono del estado/muni con clip-path, el área transparente deja ver
el `_color` gris claro del path debajo (#cbd5e1) en lugar del color que
correspondería visualmente.

Casos donde se nota: escudos sobre polígonos en modo escudos (la mayoría
son figuras con fondo transparente, no rectángulos llenos).

**Plan**:

1. Detectar en el script de cosecha si la imagen tiene canal alpha y
   tiene áreas transparentes significativas (>20% píxeles).
2. Para esas imágenes, generar una versión con fondo plano (blanco o
   color de la bandera nacional/estatal correspondiente) y servir la
   versión "rasterizada con fondo".
3. O alternativa: separar visualmente "bandera" (siempre rect) vs
   "escudo" (figura sobre área neutra) — los escudos no deberían cubrir
   100% del polígono sino aparecer centrados en tamaño reducido (estilo
   marca de agua), con fondo del polígono visible alrededor.

Trade-off: la option 3 cambia significativamente la UX visual del
indicador "Escudos" pero es más fiel al uso real de los escudos.

---

## Reportes a nivel regional

Hoy tenemos 3 niveles: País → Estado → Municipio. Falta un nivel
intermedio para análisis geográficos: **región**.

Regiones típicas de Venezuela (definidas por ONU-Habitat y CORDIPLAN):
- Capital, Central, Centro-Occidental, Llanos, Los Andes, Nor-Oriental,
  Insular, Guayana, Zuliana.

Algunas estadísticas se publican a este nivel (ej. CEPAL reporta
regionales para Venezuela).

**Plan**:

1. Mapeo `region.json`: cada estado → su región.
2. Geometría regional: dissolve de los polígonos estatales (turf union)
   en build time, output a `venezuela-regions.topojson`.
3. Toggle "Regiones" entre Estados y Municipios en el segmented de
   nivel del ControlPanel.
4. Los indicadores se agregan automáticamente desde estados → regiones
   (sum o mean según el indicator).

---

## Fix Venezuela + Esequibo en vista Global

En vista Global hoy Venezuela se ve **recortada del lado oriental**
porque `world-countries.geojson` usa la geometría internacional
(probablemente Natural Earth), que no incluye el Esequibo como
territorio venezolano.

**Diagnóstico medido**:

| Fuente | Extremo este | Esequibo |
|--------|--------------|----------|
| `world-countries.geojson` (vista Global hoy) | −59.83°W | Recortado |
| `venezuela-adm0-enriched.geojson` (vista VE) | −58.18°W | Completo |

Diferencia: ~1.65° más al este (~180 km en esa latitud). En vista
Global, el Esequibo aparece pintado como parte de Guyana, lo cual
contradice la posición soberanista que ya toma la vista Venezuela.

**Plan** (script de build time + reemplazo):

```js
// scripts/fix-venezuela-in-world.mjs
import { simplify, difference } from '@turf/turf'

const world = JSON.parse(readFileSync('app/public/data/world-countries.geojson'))
const veFull = JSON.parse(readFileSync('app/public/data/venezuela-adm0-enriched.geojson'))

// 1. Simplificar VE detallado a escala mundial (~250 puntos vs 6.575 originales)
const veSimplified = simplify(veFull.features[0], {
  tolerance: 0.05,   // ajustar empíricamente
  highQuality: true,
})

// 2. Reemplazar VE en world (preservar props originales: iso_a3, continent, etc.)
const veIdx = world.features.findIndex(f => f.properties.iso_a3 === 'VEN')
world.features[veIdx].geometry = veSimplified.geometry

// 3. Recortar Guyana para que no overlap el Esequibo
const guyIdx = world.features.findIndex(f => f.properties.iso_a3 === 'GUY')
const guyClipped = difference(world.features[guyIdx], veSimplified)
if (guyClipped) world.features[guyIdx].geometry = guyClipped.geometry

writeFileSync('app/public/data/world-countries.geojson', JSON.stringify(world))
```

**Decisiones tomadas**:
- **Cortar Guyana** (no dejar overlap). Es 1 línea más con
  `turf.difference()` y queda cartográficamente coherente con la
  posición que ya toma la vista VE.
- **Solo VE+Esequibo**, no abrir la lata de otros disputados
  (Malvinas, Sahara Occidental, Cachemira, Taiwán). Si en algún
  momento el proyecto quiere tomar posiciones editoriales sobre
  esos casos, es decisión aparte.

**Esfuerzo**: ~30 min (1 script + 1 corrida + verificación visual).
**Impacto**: alto simbólicamente (coherencia entre vistas), bajo
funcionalmente. Vale la pena hacerlo pronto.

---

## Normalización vista Global ↔ vista Venezuela (Leaflet)

Las dos vistas (Global con d3-geo, Venezuela con Leaflet) tienen
**diferencias visuales y funcionales** que generan inconsistencia:

- Vista VE: pan/zoom de Leaflet, tiles base, tooltip de Leaflet,
  control de zoom con +/−.
- Vista Global: pan/zoom manual con PointerEvents, sin tiles, sphere
  background, sin botones de zoom.

Tareas:
1. Unificar controles de zoom: agregar botones +/− también en vista
   Global (custom, no Leaflet).
2. Tooltip consistente: usar el mismo estilo en ambas vistas.
3. Decidir si los basemaps deben aparecer también en Global (con tiles
   reproyectados o ignorados).
4. Que los slider de opacidad de relleno y borde funcionen también
   en vista Global.
5. Estado mapStyle (showLabels, noBorders) debería aplicarse o estar
   deshabilitado claramente cuando no aplica.

---

## Reportes de LATAM

Extender el alcance de "indicadores comparativos" a toda LATAM, no
solo Venezuela:

- IDH PNUD por país (data disponible)
- Esperanza de vida WHO
- PIB per cápita World Bank
- Pobreza (CEPAL)
- Migración intra-LATAM (R4V para Venezuela ya está; agregar otros
  flujos: Haití, Nicaragua, etc.)

La infraestructura de vista Global (d3-geo + world-countries.geojson)
ya está. Faltan los datasets y los indicadores en `indicators.ts` con
`restrictedTo: 'global'` o similar.

UX: en vista Global, además de "Migrantes VE recibidos" (lo que hay
hoy), aparecen otros indicadores comparativos. El user puede ver el
mismo mapa LATAM/mundial con diferentes capas de data.

---

## Defaults + reordenar sección Estilos

Auditar todos los valores default del producto (palette, opacidad,
basemap, etc.) y verificar que sean los "menos sorprendentes" para un
visitante nuevo. Algunos quedaron como están por inercia de development.

También reordenar las secciones del panel Estilo:
- Hoy: Color → Mapa base → Polígonos → Vista
- Pensar qué es lo más usado primero, qué queda más abajo
- Considerar qué opciones merece ser disclosure colapsable vs siempre
  visible

Test: abrir como usuario nuevo y ver cuáles toggles toca primero.
Esos deberían estar arriba y siempre visibles. El resto puede ir en
disclosures plegables.

---

## Refactor multi-país

Hoy `indicators.ts`, los masters y los TopoJSON están hardcoded para
Venezuela. El selector LATAM del TopBar es placeholder. Para sumar
Colombia, Perú u otros, el código necesita generalizarse.

**Estructura propuesta**: una sola app, un solo deploy, país en el path
(`/ve`, `/co`). Carpetas reorganizadas:

```
data/master/<code>/{states,municipalities,coverage}.json
app/public/data/<code>/{adm0,adm1,adm2}.topojson
app/public/data/<code>/thematic/...
app/src/data/indicators/<code>.ts
app/src/data/countries.ts        ← registry central
```

**Registry central** (`countries.ts`):
- `code`, `name`, `enabled`, `bounds`
- `levelLabels`: `{ adm1: 'Estados', adm2: 'Municipios' }` (Venezuela)
  vs `{ adm1: 'Departamentos', adm2: 'Municipios' }` (Colombia) — lo
  único que el usuario nota
- `counts: { adm1, adm2 }` cache
- `isoPrefix: 'VE-' | 'CO-' | ...`
- `indicatorsModule: () => Promise<...>` (lazy import por país)

**Store generalizado**: `loadCountry(code)` en vez de `loadGeoData()`.
`country: string` (ya está parcial). El `selectIndicator` y demás siguen
igual — solo cambia de qué array de indicators viene.

**Roadmap en 3 fases**:

1. **Fase 0 · Preparar (sin sumar países)**. Renombrar carpetas a
   `data/<code>/`, mover `indicators.ts` → `indicators/ve.ts`, generalizar
   store. VE sigue funcionando idéntico — mide la arquitectura sin riesgo.
2. **Fase 1 · Sumar Colombia como prueba**. geoBoundaries CO + 2-3
   indicadores DANE. Si el toggle del TopBar funciona sin tocar código
   VE, la arquitectura quedó validada.
3. **Fase 2 · Documentar "cómo agregar un país"**. Script
   `scripts/scaffold-country.mjs <iso>` que crea las carpetas y
   templates. Doc `docs/ADD_COUNTRY.md`. Desbloquea contribuciones
   externas.

**Decisiones tomadas**:
- URL strategy: **path** (`/co`), no subdominio. Mejor SEO, sin DNS extra.
- Nomenclatura adm: **por país** vía `levelLabels`, no genérico.
- Indicadores: **cada país lo suyo** primero. Catálogo común
  cross-país es optimización prematura hasta tener 3+ países.
- Vista global: **modo aparte** (`ViewMode: 'country' | 'global'`), no
  un país más.

Trade-off: agregar país nuevo requiere ~1-2 semanas la primera vez
(refactor inicial), después debería ser 2-3 días el siguiente.

---

## Backend opcional para reportes ciudadanos (trigger: Supabase)

La visión de fondo del proyecto incluye que ciudadanos puedan reportar
huecos, robos, alcabalas e irregularidades sobre el mapa. Esto **es el
único feature que requiere backend sin alternativa**: persistencia
compartida entre usuarios + moderación + posiblemente auth anti-spam.

**Triggers explícitos para activar Supabase** (cualquiera de estos
justifica romper el principio "static-first"):

1. 3+ usuarios reales (periodistas, ONGs identificables) piden
   explícitamente "quiero reportar X en el mapa".
2. Querés probar el modelo de reportes ciudadanos con un piloto en una
   ciudad o estado concreto.
3. Aparece sponsor/financiamiento que cubra ~USD 25/mes del plan paid
   (free tier alcanza para empezar: 500 MB DB, 50K MAU, 5 GB bandwidth).

**Por qué Supabase específicamente** (si en algún momento):
- Postgres compatible (sin lock-in si después migras)
- Auth built-in (anónimo si querés mantener "sin login")
- Row-level security para moderación
- Storage si en algún momento se permiten fotos en reportes
- Buena integración con Vercel

**Principio de diseño**: la app **sigue funcionando 100% sin Supabase**
para users que no usan reportes. Reportes es un `<ReportLayer>` opcional
que pide datos al backend. Si Supabase está caído u offline, el resto
del producto sigue. Eso preserva la robustez actual y mantiene
"static-first" como default, con Supabase como excepción documentada
para 1 feature.

**Lo que NO justifica activar Supabase** (resoluble más barato):

| Caso | Alternativa |
|------|-------------|
| Mapas compartidos por link (snapshot view state) | Vercel KV — más simple |
| API pública para terceros | Vercel Edge Function + cache |
| Analytics propias | Plausible / Umami (privacy-first) |
| Sincronizar prefs entre devices del mismo user | localStorage cubre 95% |
| Búsqueda full-text de localidades (<5K) | Cliente con trie/fuzzy |

Hasta que aparezca alguno de los 3 triggers concretos, postergar es la
decisión correcta — aplica directo el principio "eficiente: no agregar
dependencias hasta que duelan no tenerlas".

---

## Sacar masters JSON del bundle

Hoy `app/src/data/master-municipalities.json` (~700 KB) y
`master-states.json` (~40 KB) se importan en `indicators.ts` y quedan
**bundled en el JavaScript del cliente**. Cada indicador que agreguemos
crece el bundle.

**Cambio**: convertir a fetch lazy desde `public/data/`, con caché en
Zustand.

```ts
// store.ts
async loadMasters() {
  const [munis, states] = await Promise.all([
    fetch('/data/master/ve/municipalities.json').then(r => r.json()),
    fetch('/data/master/ve/states.json').then(r => r.json()),
  ])
  set({ masters: { munis, states } })
}
```

**Beneficios**:
- Bundle inicial baja ~30%
- Actualizar datos no requiere rebuild de la app (solo reemplazar JSON
  en el deploy)
- Encaja perfecto con el refactor multi-país (cada país fetchea sus
  propios masters)

**Esfuerzo**: low. **Impacto**: alto en tamaño de bundle, medio en
mantenimiento. Vale la pena hacerlo **antes** del refactor multi-país
para que el cambio sea natural.

---

## Búsqueda y categorización de indicadores

Hoy hay 25 indicadores en una lista flat. Funcionan, pero la cognición
humana ya empieza a degradarse pasados 30-40 items sin organización.

**Trigger**: hacerlo **antes** de llegar a 40 indicadores. Hoy estamos
en 25, así que hay margen, pero la próxima ola (timeline slider expone
las series temporales como indicadores separables, banderas/escudos por
país en multi-país) puede empujar fácil a 50+.

**Cambios**:

1. Agregar campo `category: 'demografia' | 'economia' | 'desarrollo' |
   'seguridad' | 'simbolico' | 'politico'` al tipo `Indicator`.
2. Search box arriba de la lista (`input` simple con filtro por
   `label` + `description`).
3. Collapse por categoría (`<details>` nativos, mismo patrón que
   StyleControls).
4. Hover de cada indicador expande tooltip con `description` + `note`
   + `coverage` (hoy solo se ve al click).

**Bonus**: en mobile, en vez de lista expandida, picker tipo modal con
search + filtros chip por categoría. Más nativo para pantallas chicas.

---

## Vector tiles para capas temáticas pesadas

`vialidad.geojson` pesa 1.9 MB con 9697 LineStrings. En mobile el render
de Leaflet ya está al límite. Cualquier capa temática nueva de >2 MB
romperá la UX en celulares.

**Trigger**: cuando aparezca el primer reporte real de "se traba el
mapa al activar vialidad en mi celular", o cuando se quiera agregar
una capa pesada nueva (ej. red eléctrica completa, drenajes).

**Opciones evaluadas**:

1. **Vector tiles propios** (servidos como archivos `.pbf` estáticos
   desde Vercel/CDN). Generar con tippecanoe en el script de
   preprocesamiento. Pros: mantiene "sin backend". Contras: complejidad
   del pipeline, archivos generados por zoom level.
2. **Protomaps** (vector tiles servidos como un solo `.pmtiles` desde
   CDN, sin tile server). Pros: super liviano operacionalmente, mantiene
   static-first. Contras: dep nueva en frontend (`pmtiles` library).
3. **Simplificación geométrica más agresiva** con tolerancia más alta
   en `simplify-thematic.mjs`. Pros: cero arquitectura nueva. Contras:
   pierde detalle visible en zoom alto.

Recomendación: empezar con **(3)** (más simplificación), agresivo solo
en zoom medio. Si no alcanza, ir a **(2) Protomaps** porque preserva
"sin backend". Vector tiles propios sólo si hay 5+ capas que lo necesitan.

---

## Más reportes oficiales para Venezuela

Hoy tenemos catálogo decente (~15 indicadores) pero hay áreas con poca
cobertura. Próximos a sumar (priorizados por demanda/disponibilidad):

- **Educación**: matrícula INE por nivel (preescolar, primaria, media,
  universitaria) por estado/muni
- **Salud**: tasa de mortalidad infantil, médicos por mil habitantes
  (ENCOVI o WHO-PAHO)
- **Empleo**: tasa de desempleo, % informalidad (ENCOVI 2023/24)
- **Servicios básicos**: % hogares con agua potable, electricidad, gas
  (ENCOVI, censo 2011 actualizado donde haya datos nuevos)
- **Migración interna**: saldo migratorio entre estados (ENCOVI módulo
  migración)
- **Inseguridad ampliada**: secuestros, extorsión, hurtos OVV o CICPC
- **Económicos no-PIB**: remesas recibidas por estado, salario mínimo
  vs canasta básica, % pobreza multidimensional

Cada uno requiere: encontrar la fuente, normalizar a 27 estados / 336 munis,
matchear contra el master, agregar al catálogo `indicators.ts`. Trabajo
incremental — un reporte por sesión idealmente.

---

## Embellecer mapas regionales (Latam, Sudamérica, Europa, etc.)

Las regiones de vista Global (Latam, Sudamérica, Iberoamérica, Europa,
USA) y las Test Leaflet funcionan, pero el polish visual es desigual:

- Algunos países se ven con bordes finos y otros muy gruesos (depende
  de la simplificación de Natural Earth a 110m).
- "Mundo" en Equal Earth todavía deja ver Rusia/Asia recortadas raras.
- Países pequeños (Caribe, Centroamérica) quedan minúsculos en
  Iberoamérica/Latam — un mini-zoom o etiquetas ayudarían.
- En Test Leaflet, los tiles del basemap no siempre matchean el tema
  Cosmos (mar azul + tierras grises) — desbalance visual.

Trabajo: pasada de design en cada región, ajustar bordes/colores/
proyección/zoom defaults por caso, eventualmente migrar a un geojson
mejor (Natural Earth 50m simplificado a 30m con mapshaper).

---

## Mapas detallados de Argentina, Colombia, México (ADM1/ADM2)

Fase 2 de la feature de regiones: tener mapas internos de los países
más demandados de LATAM con sus provincias/departamentos/estados y
municipios.

Por país, lo necesario:
- **Argentina**: 24 provincias (ADM1) + 530+ partidos/municipios (ADM2).
  Fuente: IGN AR / geoBoundaries.
- **Colombia**: 32 departamentos + 1100+ municipios. Fuente: DANE /
  geoBoundaries.
- **México**: 32 estados + 2400+ municipios. Fuente: INEGI /
  geoBoundaries.

Cada uno son varios MB de geojson incluso simplificados. Pipeline:
descargar → simplify con mapshaper → enriquecer con IDs y nombres
oficiales → TopoJSON → integrar al store con nuevos tipos.

Habilita: ver indicadores por nivel sub-país en cualquier país, no
sólo VE. Y painter por estados/munis de esos países.

---

## Detección automática del país del visitante

Cuando el user entra por primera vez a `/#/app`, abrir directo en la
vista de SU país en lugar de Venezuela (hoy hardcoded). Si su país no
tiene mapa propio (sólo VE habilitado), caer a la región que lo contiene
(Latam, Iberoamérica, etc.) o a Mundo.

Opciones para detectar:
1. **`navigator.language`** — detecta locale del browser (`es-AR`,
   `pt-BR`). No requiere red. Falla en usuarios con browser en inglés.
2. **GeoIP del header del request** — Vercel expone `x-vercel-ip-country`
   gratis. Más exacto pero requiere SSR o función edge para leerlo.
3. **API geoip pública** (ipapi.co, ipinfo.io) — tier free limitado,
   añade un round-trip al boot.

Recomendación: empezar con `navigator.language` (cero costo, sin
backend). Si en analytics vemos que el 60%+ tiene browser en inglés,
sumar GeoIP de Vercel.

Persistir la elección en localStorage para no detectar de nuevo en
cada visita.

---

## Modo oscuro global

Hoy el UI está hardcoded en light (slate-50 / white / slate-900 text).
Agregar dark mode coherente con la estética Apple/Anthropic:

- Fondo principal `bg-slate-950` en lugar de `bg-slate-50`
- Texto invertido (`text-slate-100` para body, `text-white` para títulos)
- Bordes `border-slate-800` en lugar de `border-slate-200`
- Mantener el mapa con basemap activo del user — el "dark" del UI no
  fuerza basemap oscuro (el user puede tener Carto Dark o Cosmos
  por su cuenta).

Toggle: en panel Estilo o como botón del TopBar. Persistir en
localStorage. Default: `prefers-color-scheme` del browser.

Cuidado: muchos componentes tienen colores hardcoded inline
(swatches, badges, modal Wiki, etc.). Pasada de design system con
clases `dark:` de Tailwind. Ojo con el tema Cosmos del globo, que
ya tiene su propio dark interno — no debe duplicar.

---

## Pipeline de traducción automática (i18n)

Hoy todo está en español. Para abrir a usuarios de otros países (Brasil,
USA, Europa) hace falta i18n. Plan:

1. Extraer strings de UI a un archivo `messages.es.json`. Usar
   `react-intl` o `i18next` para leerlos. ~200-300 strings.
2. **Traducción automática**: pipeline n8n (o GitHub Actions con
   DeepL/OpenAI API) que toma el `.es.json` y produce `.en.json`,
   `.pt.json`. Corre en cada push a main; commit automático de los
   archivos traducidos.
3. Selector de idioma en TopBar o footer. Detectar default por
   `navigator.language`.

Items que NO requieren traducción auto (mantener literal):
- Nombres oficiales de estados/munis/países (ya están en español/
  inglés según fuente)
- Indicadores con metodología compleja (mantener español; agregar
  glosario para idioma destino)

Costo: DeepL free es 500k chars/mes, suficiente. Si crece a más
idiomas o updates frecuentes, pagar tier API (~$5/mes).

---

## Límites marítimos en mapas regionales y globales

Hoy la capa temática "Límites marítimos · CV" sólo se muestra en vista
VE (Leaflet). Cuando el user va a Global o regiones, la capa desaparece
porque el sistema de capas temáticas (`thematic`) está pensado para
vista VE.

Para que aparezca también en Global / regiones / Test Leaflet:

1. Cargar el geojson `internacionales-maritimos.geojson` también desde
   WorldMapView y RegionTestView.
2. Renderizar como `<path>` o `<polyline>` en SVG (Global) o como
   GeoJSON layer en Leaflet (Test).
3. Respetar el toggle del panel Capas — si está activo, se muestra
   en todas las vistas.

Beneficio: cuando el user pinte Iberoamérica o Mundo, las divisiones
marítimas reclamadas por VE quedan visibles. Refuerza la postura
oficial sin esfuerzo extra.

NOTA: relacionado con "Mejorar borde de Venezuela en vista Global"
(sección de arriba) — los dos abordan el problema de "VE no se ve igual
de bien fuera de su vista propia".

---

## Otros items menores (pendientes de sesiones previas)

- Páez de Apure: el polígono existe en adm2 (lo movimos a VE-C) pero los
  scripts viejos podrían no estar siempre matcheando. Auditar.
- Ocumare de la Costa de Oro (Aragua): gap real del adm2, no tenemos
  polígono. Si conseguimos un shapefile más nuevo, sumarlo.
- Migrar el procesamiento a Python con pandas si en algún momento las
  fuentes pasan de 5 (hoy son 4-5, Node todavía alcanza).
