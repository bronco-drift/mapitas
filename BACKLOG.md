# Backlog

Items pendientes que NO bloquean lo actual pero queremos retomar. Ordenados
de mayor a menor impacto percibido, no por dificultad.

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

## Otros items menores (pendientes de sesiones previas)

- Páez de Apure: el polígono existe en adm2 (lo movimos a VE-C) pero los
  scripts viejos podrían no estar siempre matcheando. Auditar.
- Ocumare de la Costa de Oro (Aragua): gap real del adm2, no tenemos
  polígono. Si conseguimos un shapefile más nuevo, sumarlo.
- Migrar el procesamiento a Python con pandas si en algún momento las
  fuentes pasan de 5 (hoy son 4-5, Node todavía alcanza).
