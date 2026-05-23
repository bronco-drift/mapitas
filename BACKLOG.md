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

## Otros items menores (pendientes de sesiones previas)

- Páez de Apure: el polígono existe en adm2 (lo movimos a VE-C) pero los
  scripts viejos podrían no estar siempre matcheando. Auditar.
- Ocumare de la Costa de Oro (Aragua): gap real del adm2, no tenemos
  polígono. Si conseguimos un shapefile más nuevo, sumarlo.
- Migrar el procesamiento a Python con pandas si en algún momento las
  fuentes pasan de 5 (hoy son 4-5, Node todavía alcanza).
