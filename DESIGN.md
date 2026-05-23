# Mapitas — Documento de Diseño

> Especificación del sistema visual, patrones de UI, layouts y decisiones de diseño de Mapitas. Reconstruido a partir del código de los componentes y los comentarios explícitos del autor ahí mismo.
>
> Versión: 0.1 · Fecha: 2026-05-23 · Mantenedor: Mapitas Admin (bronco.drift@outlook.com)
>
> **Limitación de esta versión**: el documento se escribió leyendo código, no observando la app corriendo. Pendiente confirmar todo contra screenshots reales — los hallazgos visuales pueden ser imprecisos.

---

## 1. Propósito del documento

Este archivo es la **rúbrica de diseño** contra la cual se evalúan cambios futuros. Sirve para:
- Mantener coherencia visual cuando se agreguen features
- Documentar el "por qué" de decisiones que parecen menores
- Onboarding visual de cualquier colaborador
- Auditoría de diseño por una IA o por humanos

---

## 2. Principios de diseño

Estos principios están **explícitos en el código** (comentarios del autor) o se deducen consistentemente de las decisiones tomadas:

### 2.1 Estética declarada: "Apple / Anthropic"

**Fuente formal**: declarado como principio fundacional en `DOCUMENTACION.md` §8.2 y en `CLAUDE.md` (raíz). No es interpretación visual — es la **rúbrica oficial del proyecto** contra la cual se evalúa cada decisión de diseño.

**Resumen del principio:**
- Minimalista (solo lo que aporta)
- Espacios bien usados (jerarquía por aire, no por borders/backgrounds)
- Tipografía como protagonista (system fonts, tamaños grandes, tracking apretado)
- Animaciones sutiles (transitions sí, bounces/parallax no)
- Sin AI slop (cero gradientes ornamentales, sombras innecesarias, emojis decorativos, cards over-decoradas)

**Test rápido para nuevos componentes**: *"¿algo así existiría en apple.com o anthropic.com?"* Si la respuesta es "no" o "no sé", probablemente sobra decoración.

**Referencias visuales canónicas**: apple.com · anthropic.com · linear.app · notion.so · vercel.com.

**Manifestación en código** (ejemplo concreto que documenta la intención):
> Comentario en `Landing.tsx`: *"Diseño Apple/Anthropic: mucho whitespace, jerarquía tipográfica clara, sin imágenes pesadas, sólo SVG inline. HTML semántico para SEO y a11y."*

Este comentario es una de las **manifestaciones** del principio, no la fuente. La fuente es DOCUMENTACION.md §8.2.

**Implicaciones operativas:**
- Mucho aire entre elementos (paddings generosos, `gap` amplios)
- Tipografía como protagonista (tamaños grandes, tracking apretado)
- Imágenes y assets minimalistas (logo SVG inline, iconos lucide-style)
- Sin "decoración por decoración" (no gradientes ornamentales, no sombras pesadas)
- Borders finos (1px slate-100/200), nunca pesados
- CTAs rounded-full + fondo dark + sin gradientes

### 2.2 La data es la protagonista, la UI desaparece
- El mapa ocupa todo el viewport disponible
- En mobile el panel **no oscurece** el mapa al abrirse (decisión inusual y deliberada)
- Los controles usan colores muy contenidos para no competir con la paleta de datos
- El sidebar es 320px fijo en desktop, no se puede agrandar — el límite es deliberado

### 2.3 Anti-dashboard
A diferencia de un Tableau/PowerBI:
- No hay múltiples paneles flotantes
- No hay barra de herramientas con 30 iconos
- No hay tabs profundas con subtabs
- La estructura es jerárquica simple: nivel → tab → contenido

### 2.4 Mobile-first sin sacrificar desktop
- El mismo árbol de componentes sirve ambos breakpoints
- Mobile recibe tratamiento específico (bottom-sheet) cuando lo amerita, no es responsive "barato"
- Desktop no se siente como un mobile estirado

### 2.5 Accesibilidad sin esfuerzo extra
- HTML semántico (`<header>`, `<main>`, `<footer>`, `<aside>`, `<details>/<summary>`)
- `aria-label`, `aria-pressed`, `aria-disabled`, `aria-hidden` consistentes
- Focus rings visibles (`focus:ring-2 focus:ring-slate-400`)
- Soporte de teclado en widgets custom (Enter / Space en `role="button"` divs)

---

## 3. Sistema visual

### 3.1 Paleta de UI

**Escala primaria: slate (toda la escala)**

| Token | Uso |
|---|---|
| `slate-50` | Backgrounds sutiles, tabs inactivas |
| `slate-100` | Borders muy sutiles, hover backgrounds |
| `slate-200` | Borders principales |
| `slate-300` | Borders más visibles, dividers, handle del bottom-sheet |
| `slate-400` | Texto labels uppercase, iconos secundarios, hints |
| `slate-500` | Texto secundario, hints |
| `slate-600` | Texto body en landing, hover states |
| `slate-700` | Hover de botón primario |
| `slate-800` | Texto destacado en componentes |
| `slate-900` | Texto principal, fondo de CTAs primarias, fondo de logo |

**Accents puntuales**

| Color | Uso | Significado |
|---|---|---|
| `emerald-500` | Dot de estado "Local · sin red" en topbar y "Datos abiertos · 100% local" en landing | Status: OK / activo |
| `blue-500` | Gradient en logo (M estilizada con gradient `#dbeafe` → `#3b82f6`) | Brand accent |
| `amber-600 / 700` | Badge `·N` de cobertura faltante, summary de "sin match" en upload | Warning sutil (no alarma) |
| `red-50 / 700` | Errores (parsing CSV, load error) | Error real |

**Para el mapa (data viz)** — completamente separado del sistema de UI:
- 12+ paletas predefinidas para visualización de datos (viridis, etc.)
- Paleta custom con 2 color pickers
- Paleta de datos **nunca debe interferir** con la paleta de UI

### 3.2 Tipografía

**Font stack** (`index.css`):
```css
ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
```
Decisión deliberada: **system fonts**, sin font custom. Cero peso de download, render nativo, sensación de "OS" más que de "app web".

**Escala tipográfica observada**

| Tamaño | Uso |
|---|---|
| `text-[10px]` | Labels uppercase tracking-wider, micro-texto en panel |
| `text-[11px]` | Texto secundario en panel, footers, hints |
| `text-[12px]` | Texto interactivo (botones segmented), labels de form |
| `text-[13px]` | Texto base del panel, botones del topbar |
| `text-[14px]` | Items de lista, body landing |
| `text-[15px]` | Subtítulos, hero secondary, body grande landing |
| `text-[17px-19px]` | Lead paragraph del hero |
| `text-[22px]` | Valor numérico de entidad seleccionada |
| `text-[24px-28px]` | h2 de secciones landing |
| `text-[32px-44px]` | h2 / CTA grande |
| `text-[44px-68px]` | Hero h1 |

**Tracking** (carácter especial)
- Hero: `tracking-[-0.025em]` (apretado, Apple-style)
- Labels uppercase: `tracking-wider` (`0.05em`) o `tracking-[0.14em]` o `tracking-[0.22em]` para "Mapitas" header
- Resto: default

**Leading**
- Hero: `leading-[0.98]` (muy apretado para impacto)
- Body landing: `leading-[1.55]`
- Body app: `leading-snug` o `leading-relaxed`

**Pesos**
- `font-medium` (500): default para botones, labels destacados
- `font-semibold` (600): h2 secciones, valores destacados
- `font-bold` (700): h1 hero, CTA final

**tabular-nums** (numeric tracking) se usa en:
- Conteos de cobertura (`{stats.matched} de {stats.totalFeatures}`)
- Valor numérico de entidad seleccionada
- Badge `·N`

### 3.3 Espaciado

**Padding del sidebar**: `px-5` (20px) horizontal estándar.

**Gaps entre componentes**: `space-y-3` o `space-y-4` (12-16px) para grupos relacionados.

**Layout principal**:
- Landing: `max-w-6xl mx-auto px-6 sm:px-10`
- Sidebar: `w-[320px]` fijo
- TopBar: `h-11 md:h-12` (44-48px)

### 3.4 Borders y radios

| Token | Uso |
|---|---|
| `rounded` (default 4px) | Inputs |
| `rounded-md` (6px) | Botones segmented, containers |
| `rounded-lg` (8px) | Icon containers en features |
| `rounded-2xl` (16px) | Top del bottom-sheet en mobile |
| `rounded-full` | CTAs primarias (Apple-style) |
| `rounded-sm` (2px) | Thumbnails de paletas |

**Borders** son siempre finos (`1px`) y de `slate-100/200/300`. Nunca borders pesados.

### 3.5 Sombras

Usadas muy puntualmente:
- `shadow-sm`: botones primarios (subtle elevation)
- `shadow-xl`: botón flotante mobile (necesita destacarse sobre mapa)
- `shadow-2xl`: bottom-sheet mobile (separación clara del mapa)

Nada de `shadow-md` o sombras "para dar profundidad por dar".

---

## 4. Patrones de UI

### 4.1 Segmented control
Usado para:
- Selector de nivel (País / Estados / Municipios)
- Selector de tab (Datos / Capas / Estilo)

**Estructura**:
```
border border-slate-200 bg-slate-50 p-0.5 rounded-md (container)
└── button con bg-white text-slate-900 shadow-sm cuando activo
└── button con text-slate-500 hover:text-slate-700 cuando inactivo
```

### 4.2 Disclosure (acordeón)
Implementado con `<details>` / `<summary>` nativos para accesibilidad gratis.

**Estructura visual**:
```
rounded-md border border-slate-100 (container)
├── summary: px-2.5 py-1.5 text-[11px] uppercase tracking-wider hover:bg-slate-50
│            con flecha SVG que rota 90° al abrir
└── content: px-2.5 pb-2.5 pt-1
```

**Default state**: el más usado expandido, el resto colapsado. Ej. en tab Estilo: "Polígonos" expandido por default, "Mapa base" y "Vista" cerrados.

### 4.3 Toggle switch
Custom (no shadcn ni Headless UI):
```
button h-4 w-7 rounded-full
├── slate-900 background cuando ON
├── slate-200 background cuando OFF
└── knob: h-3 w-3 rounded-full bg-white con transform translate-x
```

Label a la izquierda, switch a la derecha, hint debajo del label.

### 4.4 Color picker
Input `<input type="color">` nativo:
```
h-6 w-6 (o h-7 w-7) shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0
```
Sin librerías. El picker nativo del OS es suficiente y reduce dependencias.

### 4.5 Drag & drop zone
Estado idle: `border-dashed border-slate-300`
Estado dragging: `border-slate-900 bg-slate-50 text-slate-900`
Estado con archivo: card con `bg-slate-50 p-2.5` mostrando filename + dimensiones + botón "quitar"

### 4.6 Lista de indicadores (row-based)
Cada row:
- Container: `rounded-md px-2.5 py-2`
- Activo: `bg-slate-900 text-white`
- Hover: `hover:bg-slate-100`
- Disabled: `opacity-40 cursor-not-allowed`
- Dot al final: `h-2 w-2 rounded-full` (radio-like, lleno cuando activo)
- Badge `·N` en amber al lado del label cuando hay cobertura faltante (clickeable, abre modal)

### 4.7 Modal
`IndicatorCoverageModal` — patrón estándar:
- Overlay oscuro semi-transparente
- Modal centrado con close button
- Click fuera o ESC cierra

### 4.8 Status badge
"Local · sin red":
```
inline-block h-1.5 w-1.5 rounded-full bg-emerald-500
+ texto text-[10px] uppercase tracking-wider text-slate-400
```
Pattern usado dos veces: en TopBar permanente y en chip de landing.

### 4.9 CTA primaria
```
rounded-full bg-slate-900 text-white px-6 py-3 text-[15px] font-medium shadow-sm
hover:bg-slate-700 transition
```
Apple-style: forma pill, fondo dark, texto medio.

### 4.10 Chip / pill informativo
```
inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1
text-[11px] font-medium uppercase tracking-wider text-slate-500
```
Usado para "Datos abiertos · 100% local" en hero.

---

## 5. Layouts

### 5.1 Landing
```
┌─ Header ─────────────────────────────────────────┐
│ [Logo] Mapitas                  GitHub | CTA pill│ (max-w-6xl, py-5)
├──────────────────────────────────────────────────┤
│                                                  │
│  Chip "Datos abiertos · 100% local"              │
│  H1 GIGANTE: "Mapas de Venezuela.                │
│              Datos al instante."                 │ (hero, pt-12/24)
│  Subtítulo (gris)                                │
│  [CTA pill] [Cómo funciona]                      │
│                                                  │
├──── border-t ────────────────────────────────────┤
│  H2 "Hecho para periodistas..."                  │
│  Subtítulo                                       │
│  Grid 4 columnas: feature con icono + título     │ (features, pt-16/24)
├──── border-t ────────────────────────────────────┤
│  H2 "Datos confiables, abiertos."                │
│  Grid 2 columnas: micro-secciones fuentes        │ (sources)
├──── border-t ────────────────────────────────────┤
│  H2 GRANDE "Listo cuando vos."                   │ (CTA final, py-20)
│  [CTA pill]                                      │
├──────────────────────────────────────────────────┤
│ Footer: Logo Mapitas © 2026  |  links externos   │ (border-t bg-slate-50/50)
└──────────────────────────────────────────────────┘
```
Container: `max-w-6xl mx-auto px-6 sm:px-10`. Sin imágenes — solo SVG inline.

### 5.2 App — Desktop (md+)
```
┌──────────┬──────────────────────────────────────┐
│ SIDEBAR  │ TopBar (44-48px)                     │
│ 320px    ├──────────────────────────────────────┤
│ fixed    │                                      │
│          │                                      │
│ Header   │                                      │
│ Mapitas  │                                      │
│          │           MAPA (Leaflet)             │
│ Nivel    │                                      │
│ segmented│                                      │
│          │                                      │
│ Tab      │                                      │
│ Datos/   │                                      │
│ Capas/   │                                      │
│ Estilo   │                                      │
│          │                                      │
│ Content  │                                      │
│ (scroll) │                                      │
│          │                                      │
│ ─────    │                                      │
│ Leyenda  │                                      │
│ (si data)│                                      │
│ ─────    │                                      │
│ Seleccionado (si click)                         │
│          │                                      │
│ ─────    │                                      │
│ Upload   │ (sticky bottom si tab=datos)         │
│ ─────    │                                      │
│ Footer   │                                      │
└──────────┴──────────────────────────────────────┘
```

### 5.3 App — Mobile (<md)
```
┌──────────────────────────────────┐
│ TopBar (44px)                    │
├──────────────────────────────────┤
│                                  │
│                                  │
│         MAPA (full)              │
│                                  │
│                                  │
│           [ Panel ]              │ ← botón flotante centro abajo
└──────────────────────────────────┘

Al tocar [Panel] sube bottom-sheet:

┌──────────────────────────────────┐
│            MAPA visible          │ ← NO oscurece
│                                  │
├──── handle ──── Cerrar ──────────┤  ← rounded-t-2xl
│ (sin header desktop)             │
│ Nivel segmented                  │ 45vh
│ Tab segmented                    │
│ Content (scroll)                 │
│ Upload (sticky si datos)         │
│ Footer mini                      │
└──────────────────────────────────┘
```

Decisión inusual: **el bottom-sheet no oscurece el mapa**. Una capa invisible (`bg-transparent`) capta taps para cerrar, sin overlay visual. Mantiene presencia de la data, pero pierde la affordance estándar de "tap fuera para cerrar".

---

## 6. Estados de componentes

### 6.1 Estados base (cualquier control)
| Estado | Tratamiento |
|---|---|
| Default | Estilo descrito en cada patrón |
| Hover | Subir un nivel de slate (ej. text-slate-500 → text-slate-700) o bg-slate-100 |
| Focus | `focus:ring-2 focus:ring-slate-400` o `focus:border-slate-900 focus:outline-none` |
| Active / Selected | bg-slate-900 + text-white (alto contraste) |
| Disabled | `opacity-40 cursor-not-allowed` |
| Loading | Texto "Cargando..." o disabled visual |

### 6.2 Estados especiales del mapa
- **Sin data**: polígonos `#e5e7eb` (gris neutro)
- **Con data matched**: color de la paleta, fillOpacity completa
- **Con data NOT matched** (cuando hay un indicador activo pero ese polígono no tiene valor): mismo color base pero `fillOpacity * 0.6` para diferenciar visualmente

### 6.3 Estados especiales del upload
- **Pre-upload**: zona drag&drop con borde dashed
- **Dragging**: borde solid, bg slate-50
- **Con archivo + mapping incompleto**: card con dropdowns "elegir columna"
- **Con archivo + mapping completo + matches**: stats "N de M pintadas" + expandible "X sin match" en amber

### 6.4 Loading global
Suspense fallback: pantalla completa con `bg-slate-100 text-slate-500` y mensaje "Cargando mapa..."
Loading del adm: overlay translúcido `bg-white/70` con texto "Cargando mapa base..."

### 6.5 Errores
- Error de parsing CSV: `bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700` debajo del upload
- Error de load global: banner top con `bg-red-50 text-red-700` y mensaje

---

## 7. Iconografía

**Filosofía**: SVG inline lucide-style. **Cero librerías de iconos** (no `lucide-react`, no `heroicons`). Cada icono se escribe a mano cuando se necesita.

**Razón**: minimiza bundle, garantiza control visual, evita "icon soup" que típicamente acompaña a las librerías.

**Iconos actuales** (todos en Landing):
- IconLayers (capas)
- IconUpload (subir)
- IconLock (privacidad)
- IconPalette (personalización)

**Convención de estilo** (lucide-style):
- `viewBox="0 0 24 24"`
- `width="20" height="20"`
- `stroke="currentColor"` `strokeWidth="2"`
- `strokeLinecap="round" strokeLinejoin="round"`
- `fill="none"` salvo en accents puntuales (dots de palette)
- `aria-hidden="true"` cuando es decorativo

**Logo**: SVG inline con un path de "M" estilizada y gradient blue → slate-900. Tamaño base 64×64, escala por className.

---

## 8. Accesibilidad

### 8.1 Estructura semántica
- `<header>`, `<main>`, `<footer>` en landing
- `<aside>` en panel del app
- `<details>` / `<summary>` para disclosures
- `aria-labelledby` en cada sección con su h2 correspondiente

### 8.2 Roles y ARIA
- Botones reales (`<button type="button">`) salvo cuando hay anidación inválida (entonces `role="button"` + `tabIndex` + keyboard handler)
- `aria-label` en controles sin texto visible (icon buttons, language flag)
- `aria-pressed` en toggles de selección
- `aria-disabled` en items disabled
- `aria-hidden` en SVGs decorativos

### 8.3 Keyboard
- Focus rings visibles
- Enter / Space activan rows con `role="button"`
- `<details>` y `<summary>` heredan keyboard nativo

### 8.4 Contraste
- Texto principal `slate-900` sobre fondo blanco: ~21:1 (AAA)
- Texto secundario `slate-600` sobre blanco: ~7:1 (AAA)
- Texto sutil `slate-400` sobre blanco: ~3.5:1 (AA Large only) — usado solo para labels uppercase pequeños que son decorativos

### 8.5 Lo que falta verificar
- **Screen reader walkthrough completo** del flujo de upload
- **Navegación por teclado del mapa** (Leaflet tiene su propio sistema)
- **Reduced motion** para las transiciones (`transition` ubicuo)

---

## 9. Decisiones de diseño documentadas en código

El autor deja comentarios explícitos en el código sobre decisiones. Estas son las más significativas:

### 9.1 Cero gaps entre polígonos (TopoJSON + shape-rendering)
> *"Anti gaps: el browser hace anti-aliasing en bordes de paths SVG vecinos. geometricPrecision le dice 'respetá la geometría, no metas pixels semi-transparentes en los bordes'. Mantiene curvas suaves pero elimina las líneas blancas entre polígonos coloreados."*

Más:
> *"Cargamos TopoJSON (5x más chico) y lo decodificamos a GeoJSON. La clave: en TopoJSON las fronteras compartidas son arcs únicos; al decodificar, polígonos vecinos comparten exactamente las mismas coordenadas → cero gaps visuales."*

### 9.2 Stroke same-color como tapa-gaps adicional
> *"En modo noBorders, el stroke del mismo color del fill se usa para tapar gaps geométricos entre polígonos. A opacidad 100% el efecto necesita weight grueso (1.7); a opacidad baja el polígono ya está translúcido y un stroke grueso se ve desproporcionado, así que se va achicando."*

Implementación: interpolación lineal entre 1.7 (opacity ≥ 0.9) y 0.5 (opacity ≤ 0.3).

### 9.3 Badge `·N` en amber, no en rose
> *"Badge '·N': cantidad de entidades sin data al nivel actual. Click abre el modal con la lista. Color amber (warning sutil), no rose (alarma)."*

### 9.4 Lazy load del bundle del mapa
> *"Lazy load del mapa: ~280kb extra (Leaflet + react-leaflet + Turf cuando se requiera). La landing NO los necesita, así que sólo se descargan cuando el user navega a /#/app. Mejora drásticamente el LCP de la home."*

### 9.5 Bottom-sheet sin overlay oscuro
> *"Capa invisible solo en mobile: capta el tap fuera del panel para cerrar, pero NO oscurece el mapa"*

Decisión deliberada para que el mapa no pierda presencia visual.

### 9.6 Disclosures con `<details>` nativos
> *"Disclosure simple con estado local. Usamos <details>/<summary> nativos para accesibilidad gratis (Enter/Space, screen readers), con estilos custom."*

### 9.7 Color picker pasa a "custom" automáticamente
> *"Color pickers de start/end siempre visibles — editan la paleta. El editor de rango con histograma + 3 handles vive abajo."*

Smart UX: si cambiás un color picker mientras una paleta predefinida está activa, automáticamente cambia a paleta "custom" usando ese color. Cero fricción.

### 9.8 Document title dinámico por ruta
> *"Cambia el <title> del documento según la ruta. Mejora UX al compartir y mantenerse en el historial."*

### 9.9 Auto-clip de outliers con percentiles 2/98
Toggle "autoClipExtremes" (default ON): comprime el rango de la paleta usando percentil 2 y 98 en lugar de min/max raw, para que un outlier extremo no aplane todo el resto.

### 9.10 Persistencia liviana
> *"Solo serializamos cosas livianas. La geo data se re-fetchea al cargar."*

Persiste preferencias en localStorage, no geometrías (que pesan ~MB).

---

## 10. Inconsistencias visuales / de design a resolver

> **Para la auditoría de la biblia**:

### 10.1 Conteos de paletas
- Landing dice "13 paletas"
- README dice "5 paletas + custom"
- Código tiene `PALETTE_OPTIONS` + `PALETTE_EXTRA` (verificar cantidad real)

**Acción**: definir el número canónico y actualizar copy en landing.

### 10.2 Tracking inconsistente en labels uppercase
Distintas variantes en código:
- `tracking-wider` (~0.05em)
- `tracking-[0.14em]`
- `tracking-[0.22em]`

**Acción sugerida**: definir 2 tokens claros (ej. `tracking-label` y `tracking-brand`) en CSS, usar consistentemente.

### 10.3 Tamaños de texto granulares sin sistema
Hay text-[10px], text-[11px], text-[12px], text-[13px], text-[14px], text-[15px], text-[17px], text-[19px], text-[22px], text-[24px], text-[28px], text-[32px], text-[40px], text-[44px], text-[68px]. Es muy granular.

**Acción sugerida**: consolidar a una escala más estricta (~7 tamaños) o documentar la escala completa con propósito de cada uno.

### 10.4 Decisión pendiente: dark mode
`color-scheme: light` está explícito en `index.css`. No hay dark mode. ¿Es deliberado y permanente?

**Pregunta abierta**: ¿el dark mode es un "no" filosófico (siempre claro para mapas) o un "todavía no"?

### 10.5 Font custom potencial
Hoy se usan system fonts. Si Mapitas quiere reforzar identidad propia, podría considerarse una font display sutil (Inter, IBM Plex Sans, etc.). Trade-off claro: + peso de bundle, + tiempo de render, + identidad.

**Pregunta abierta**: ¿es deliberado mantener system fonts forever o se puede revisar cuando haya identidad de brand más madura?

---

## 11. Lo que NO está documentado y debería resolverse

> **[TODO: requiere input o screenshots para completar estas secciones]**

- **Animaciones / motion**: hay `transition` ubicuos pero no hay un sistema de duraciones/easings declarado
- **Empty states**: ¿cómo se ve la app si no hay ningún indicador activo? ¿Qué hace el usuario en ese estado?
- **Estados de error específicos**: capa temática que falla al cargar, geo que no responde, etc.
- **Brand identity más allá del logo**: ¿hay paleta de brand para uso en redes / posters? ¿Tono de voz?
- **Cobertura visual de los 11 capas temáticas**: cada capa tiene su color en el manifest, ¿están armónicos entre sí?
- **Imágenes / screenshots**: la landing no tiene screenshots del producto — ¿deliberado o pendiente?

---

## 12. Tokens propuestos para sistema de diseño formal

Si en algún momento se quiere extraer un design system explícito (Tailwind config o tokens JSON), una primera propuesta:

```ts
// colors
const colors = {
  text: {
    primary: 'slate-900',
    secondary: 'slate-600',
    tertiary: 'slate-500',
    muted: 'slate-400',
    inverse: 'white',
  },
  surface: {
    base: 'white',
    raised: 'slate-50',
    border: 'slate-200',
    divider: 'slate-100',
  },
  brand: {
    accent: 'blue-500',
    gradient: 'from-blue-500 to-slate-900',
  },
  status: {
    ok: 'emerald-500',
    warning: 'amber-600',
    error: 'red-700',
    errorBg: 'red-50',
  },
}

// typography
const fontSize = {
  micro: '10px',
  caption: '11px',
  small: '12px',
  body: '13px',
  base: '14px',
  lead: '15px',
  subhead: '17px',
  large: '19px',
  display: '22px',
  h3: '28px',
  h2: '40px',
  h1: '68px',
}

// radii
const radius = {
  sm: '2px',  // thumbnails de paleta
  md: '6px',  // botones segmented
  lg: '8px',  // icon containers
  xl: '16px', // bottom-sheet
  pill: '9999px', // CTAs apple-style
}

// shadows
const shadow = {
  sm: 'shadow-sm',  // botones primarios
  xl: 'shadow-xl',  // FAB
  '2xl': 'shadow-2xl', // bottom-sheet
}
```

---

*Documento mantenido en `DESIGN.md`. Última actualización: 2026-05-23.*
