# CLAUDE.md — Instrucciones para Claude en este proyecto

> Este archivo se carga automáticamente en cada sesión de Claude Code abierta sobre Mapitas. Contiene el contexto mínimo para que cualquier sesión arranque alineada con el proyecto.

---

## Qué es Mapitas

Plataforma web de **transparencia territorial** para Venezuela (y eventualmente LATAM). El usuario sube un CSV/Excel y el mapa se pinta solo, o usa indicadores oficiales pre-cargados. Todo corre en el browser, sin backend.

Lectura completa: `DOCUMENTACION.md`. Producto: `PRODUCT.md`. Diseño: `DESIGN.md`. Pendientes: `BACKLOG.md`.

## Stack

- **Frontend** (`app/`): Vite + React 19 + TypeScript + Tailwind v4 + Leaflet + Zustand + PapaParse + SheetJS
- **Preprocesamiento** (raíz, `scripts/`): Node + Turf.js para enriquecer la base de datos
- **Deploy**: Vercel (configurado en `vercel.json`)

## Principios fundacionales (NO negociables sin discusión)

1. **Escalable** — lo que se hace para VE debe poder soportar Colombia/Perú/etc. sin reescribir el core
2. **Sostenible** — bajo costo de operación (static-first, sin backend)
3. **Documentado** — README, BACKLOG, DOCUMENTACION, scripts comentados
4. **Claro** — la UX no debe necesitar tutorial
5. **Óptimo** — TopoJSON, lazy-loading, geometrías simplificadas
6. **Eficiente** — no features hasta que un usuario las pida, no deps hasta que duelan no tenerlas

## Estética: Apple / Anthropic (rúbrica de diseño)

Toda decisión visual se evalúa contra esta lente:

- **Minimalista** — solo lo que aporta; nada decorativo
- **Espacios bien usados** — whitespace, jerarquía por aire (no por borders/backgrounds)
- **Tipografía como protagonista** — tamaños grandes, tracking apretado, system fonts
- **Animaciones sutiles** — transitions sí; bounces/parallax/fades largos no
- **Sin AI slop** — sin gradientes ornamentales, sombras innecesarias, emojis decorativos, cards con border+shadow+gradient

**Test rápido**: *"¿algo así existiría en apple.com o anthropic.com?"* Si la respuesta es "no" o "no sé", probablemente sobra decoración.

**Referencias**: apple.com · anthropic.com · linear.app · notion.so · vercel.com.

Detalle completo en `DOCUMENTACION.md` sección 8.2 y `DESIGN.md`.

## Decisiones técnicas clave (entender antes de cambiar)

- **Static-first, sin backend**: cualquier feature que rompa esto necesita discusión explícita (incluye reportes ciudadanos, login, etc.)
- **TopoJSON sobre GeoJSON**: arcs compartidos = cero gaps visuales entre polígonos
- **Persistencia liviana en localStorage**: solo preferencias, nunca geo data (que se re-fetchea)
- **Lazy load del bundle del mapa**: la landing no descarga Leaflet hasta que el user navega a `#/app`
- **Auto-clip de outliers** con percentiles 2/98 por default (toggleable)
- **shape-rendering: geometricPrecision** en SVG paths para evitar anti-aliasing en bordes
- **Stroke same-color del fill** en modo "sin bordes" para tapar gaps geométricos residuales

## Convenciones del repo

- **Idioma**: español (UI, comentarios, documentación)
- **`app/`** es el frontend (Vite). **Raíz** tiene los scripts de preprocesamiento (Node).
- **`data/master/`** es la fuente canónica consolidada. **`raw-sources/`** son los inputs crudos.
- **`data/sources/`** son los datos enriquecidos intermedios.
- **Scripts en `scripts/`** se corren a mano cuando hace falta regenerar la base.

## Cómo trabajar acá

- **No agregues dependencias** sin necesidad clara. Cero icon libraries (SVG inline), cero UI kits (Tailwind + componentes propios).
- **No introduzcas backend** sin discusión previa con el mantenedor.
- **No rompas la persistencia** en localStorage — el usuario que vuelve aterriza donde dejó.
- **Cuando edites estilo**, pasá el test de Apple/Anthropic antes de commit.
- **Cuando agregues una feature**, evaluá contra los 6 principios. Si rompe alguno, replantear o descartar.

## Comandos útiles

```bash
# Frontend (en app/)
npm run dev        # dev server :5173
npm run build      # tsc + vite build
npm run lint

# Preprocesamiento (en raíz)
npm run enrich
node scripts/process-municipal-csv.mjs
node scripts/convert-provita.mjs
node scripts/simplify-thematic.mjs
```

## Anti-features (lo que NO debe pasar)

- Login / cuentas / perfiles
- Backend propio (salvo discusión explícita)
- Tracking del usuario (si se agrega analytics, debe ser privacy-first como Plausible/Umami, anónimo)
- Iconos de librerías (lucide-react, heroicons, etc.)
- Sombras / gradientes decorativos
- Emojis en UI (salvo flags de país en el dropdown LATAM)
- Dependencias agregadas sin justificación clara
