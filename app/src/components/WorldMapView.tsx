// Vista Global · d3-geo + SVG (no Leaflet).
//
// Por qué d3-geo y no Leaflet:
//   - Leaflet está atado a Web Mercator, que distorsiona áreas en latitudes
//     altas (Groenlandia se ve gigante). Para un mapa mundial honesto
//     necesitamos proyecciones igual-área tipo Equal Earth.
//   - d3-geo soporta nativamente Equal Earth, Orthographic (globo),
//     Natural Earth 1, Mercator, Equirectangular y otras. Sin tiles porque
//     a esa escala no aportan info y la mayoría solo existen en Mercator.
//
// Interacción (sin d3-zoom, manejado manual con PointerEvents + wheel):
//   - Orthographic: drag rota el globo (cambia rotation del store).
//   - Proyecciones planas: drag hace pan (translate del SVG).
//   - Wheel/pinch: zoom (scale del SVG) en todas.
// Usamos PointerEvents porque cubren mouse + touch + pen en una sola API.

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  geoEqualEarth,
  geoEquirectangular,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
  geoPath,
  type GeoProjection,
} from 'd3-geo'
import { useStore, getPaintContext } from '../store'
import type { DiasporaProps } from '../lib/types'
import type { ProjectionId } from '../lib/projections'
import { getGlobeTheme } from '../lib/globe-themes'
import { getGlobalReportByMode } from '../data/global-reports'
import { getRegion, isInRegion } from '../lib/regions'

// Mapping ProjectionId → factory d3. Vive acá porque arrastra d3 (lazy load).
const PROJECTIONS: Record<
  ProjectionId,
  { factory: () => GeoProjection; isGlobe: boolean }
> = {
  equalEarth: { factory: geoEqualEarth, isGlobe: false },
  orthographic: { factory: geoOrthographic, isGlobe: true },
  naturalEarth: { factory: geoNaturalEarth1, isGlobe: false },
  mercator: { factory: geoMercator, isGlobe: false },
  equirectangular: { factory: geoEquirectangular, isGlobe: false },
}

export function WorldMapView() {
  const diaspora = useStore(s => s.diaspora)
  const mapStyle = useStore(s => s.mapStyle)
  const setSelected = useStore(s => s.setSelected)
  const projection = useStore(s => s.projection)
  const rotation = useStore(s => s.rotation)
  const mobilePanelHeight = useStore(s => s.mobilePanelHeight)
  const globalMetric = useStore(s => s.globalMetric)
  const globalRegion = useStore(s => s.globalRegion)
  const cosmosTweaks = useStore(s => s.cosmosTweaks)
  const paint = useStore(s => s.paint)
  const paintModeActive = useStore(s => s.paintModeActive)
  const paintFeature = useStore(s => s.paintFeature)
  const paintFeatureForce = useStore(s => s.paintFeatureForce)

  // Filtro por región: subset del geo con sólo los países incluidos en
  // la región activa. fitExtent debajo lo usa para auto-centrar/zoom
  // a la región. 'world' devuelve el geo entero sin tocar.
  const region = getRegion(globalRegion)
  const regionGeo = useMemo(() => {
    if (!diaspora) return null
    if (region.isos.length === 0) return diaspora
    const features = diaspora.features.filter(f =>
      isInRegion((f.properties as DiasporaProps).iso_a3, region),
    )
    return { ...diaspora, features }
  }, [diaspora, region])
  const baseTheme = getGlobeTheme(mapStyle.globeTheme)
  const activeReport = getGlobalReportByMode(globalMetric)

  // Painter: en vista Global el contexto es siempre 'countries'. Cuando el
  // tab activo es 'dibujar' Y hay color seleccionado, los clicks pintan
  // en lugar de seleccionar. Override del fill se aplica siempre que un
  // feature esté en assignments[countries] (la pintura es persistente
  // incluso fuera del tab Dibujar, así el user no la pierde al navegar).
  //
  // Mientras el tab Dibujar está activo, el mapa IGNORA el color del
  // indicador (diáspora) y muestra todo en el color "missing" del tema —
  // así el user arranca con un lienzo limpio, no con datos preseleccionados.
  // La pintura persiste en localStorage; al volver a Datos el indicador
  // se vuelve a ver de fondo (y la pintura encima si quiere).
  const paintAssignments = paint.assignments.countries
  const isOnPaintTab = paintModeActive
  const isPainting = paintModeActive && paint.activeColor != null && getPaintContext('global', 'adm0') === 'countries'

  // Si el tema activo es Cosmos, los colores base salen de cosmosTweaks
  // (editables por el user). Para otros temas usamos los presets de
  // globe-themes.ts directamente.
  const isCosmosTheme = mapStyle.globeTheme === 'cosmos'
  const theme = isCosmosTheme
    ? { ...baseTheme, space: cosmosTweaks.space, globe: cosmosTweaks.globe, missing: cosmosTweaks.missing }
    : baseTheme

  // Hover state: país bajo el pointer + posición del tooltip flotante.
  // null cuando no hay hover (mobile, drag, fuera del mapa). El tooltip
  // se monta como sibling del SVG, no como <title> HTML nativo, para
  // poder estilizarlo coherente con el resto del producto.
  const [hovered, setHovered] = useState<{
    iso: string
    name: string
    value: number | null
    matched: boolean
    x: number
    y: number
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  // null hasta el primer measure del ResizeObserver. Evita flash con tamaño
  // hardcodeado que se recalcula a los pocos ms.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // Mobile detection para anclar el globo a la mitad superior del container.
  // Esto evita que el panel drawer (mobile) cubra el globo cuando expande.
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ResizeObserver: ajustar el SVG al tamaño real del container
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    // Inicializar con tamaño real ya (sin esperar al primer resize event)
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setSize({ w: rect.width, h: rect.height })
    }
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) setSize({ w: width, h: height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Proyección configurada para el size actual + rotación.
  // - Para proyecciones tipo globo (Orthographic): scale manual basado en
  //   min(w, h) para que el globo SIEMPRE quede completo (no recortado en
  //   pantallas verticales/móviles). El globo se centra en el container.
  // - Para proyecciones planas (Equal Earth, etc.): fitExtent al rect con
  //   margen interno, para que el mapa entero entre con aire.
  const MARGIN = 24
  const pathGen = useMemo(() => {
    const p = PROJECTIONS[projection].factory()
    if (p.rotate) p.rotate(rotation)
    if (!size) {
      return geoPath(p)
    }

    // En mobile, el área visible del mapa es lo que NO está cubierto por el
    // drawer del ControlPanel. mobilePanelHeight (0–1) viene del store y se
    // actualiza al arrastrar el drawer. visibleH = altura no cubierta.
    // En desktop esto siempre es size.h (panel es sidebar lateral).
    const visibleH = isMobile ? size.h * (1 - mobilePanelHeight) : size.h
    // Margen mínimo arriba (debajo del TopBar) para que el globo no se pegue
    const visibleTop = isMobile ? 0 : 0
    const visibleBottom = visibleTop + visibleH

    const isGlobe = PROJECTIONS[projection].isGlobe
    if (isGlobe) {
      const radius = Math.max(20, Math.min(size.w, visibleH) / 2 - MARGIN)
      const centerY = (visibleTop + visibleBottom) / 2
      p.translate([size.w / 2, centerY])
      p.scale(radius)
      // Recortar al hemisferio frontal: los países "detrás" del globo
      // dejan de renderizarse, evitando overlap visual.
      if (p.clipAngle) p.clipAngle(90)
    } else if (regionGeo && regionGeo.features.length > 0 && p.fitExtent) {
      // fitExtent al subset de región: si el user filtra a Suramérica,
      // la proyección zoomea/centra ahí. 'world' usa el geo completo.
      p.fitExtent(
        [
          [MARGIN, visibleTop + MARGIN],
          [size.w - MARGIN, visibleBottom - MARGIN],
        ],
        regionGeo as never,
      )
    } else {
      p.translate([size.w / 2, (visibleTop + visibleBottom) / 2])
    }
    return geoPath(p)
  }, [projection, rotation, size, regionGeo, isMobile, mobilePanelHeight])

  // ─── Interacción: drag + wheel + pinch ──────────────────────────────────
  // En lugar de d3-zoom (que conflictúa con drag-to-rotate en Orthographic),
  // manejamos todo con PointerEvents + wheel events. Más control, más simple.
  //
  // - Orthographic: drag → setRotation. Wheel/pinch → scale.
  // - Planas: drag → translate (pan). Wheel/pinch → scale.
  const setRotation = useStore(s => s.setRotation)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const isGlobeProjection = PROJECTIONS[projection].isGlobe

  // Estado del drag actual. Guardamos snapshot al pointerdown para calcular
  // deltas relativos al inicio del drag (más estable que diferenciar entre
  // movimientos consecutivos).
  type DragState = {
    pointerId: number
    startX: number
    startY: number
    startRotation: [number, number, number]
    startPan: { x: number; y: number }
  }
  const dragRef = useRef<DragState | null>(null)
  // Cache del segundo pointer para pinch-to-zoom (multi-touch).
  // startPan guarda el pan al inicio del pinch para que el reescalado del
  // pan (que mantiene anclado el centro al zoomear) parta del valor
  // congelado al touchstart, no del pan corriente que se actualiza con
  // cada setPan dentro del propio pinch (eso causaría drift exponencial).
  const pinchRef = useRef<{ p1: { id: number; x: number; y: number }; p2: { id: number; x: number; y: number }; startDist: number; startScale: number; startPan: { x: number; y: number } } | null>(null)
  // Marcador: si el pointer se movió más que el threshold, el siguiente click
  // sobre un país NO debe dispararse (es el final de un drag, no un tap).
  const wasDraggedRef = useRef(false)
  // Path SVG que recibió el pointerdown. Lo guardamos para resolver el "click"
  // en pointerup vía event delegation. En iOS, asignar onClick directamente a
  // cada <path> hace que Safari intercepte los touch events y NO los propague
  // al SVG padre — eso rompía el drag-to-rotate del globo: tocando agua/sphere
  // funcionaba, tocando un país no. Resolviendo el tap acá liberamos los paths
  // de cualquier handler de touch/click y el drag funciona en toda la sphere.
  const downTargetRef = useRef<SVGPathElement | null>(null)

  // Reset pan/scale al cambiar dimensiones (rotación pantalla, abrir/cerrar
  // panel mobile). Sin reset, el pan queda con coordenadas viejas.
  useEffect(() => {
    setPan({ x: 0, y: 0 })
    setScale(1)
  }, [size?.w, size?.h])

  // Refs a state/props que los handlers de window leen. Como los handlers
  // viven en window y son llamados desde fuera del ciclo de render de React,
  // necesitan refs estables para no leer valores stale al cerrar sobre el
  // state inicial.
  const rotationRef = useRef(rotation)
  const panRef = useRef(pan)
  const scaleRef = useRef(scale)
  const sizeRef = useRef(size)
  const mobilePanelHeightRef = useRef(mobilePanelHeight)
  const isGlobeRef = useRef(isGlobeProjection)
  const diasporaRef = useRef(diaspora)
  const isPaintingRef = useRef(isPainting)
  useEffect(() => { rotationRef.current = rotation }, [rotation])
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { sizeRef.current = size }, [size])
  useEffect(() => { mobilePanelHeightRef.current = mobilePanelHeight }, [mobilePanelHeight])
  useEffect(() => { isGlobeRef.current = isGlobeProjection }, [isGlobeProjection])
  useEffect(() => { diasporaRef.current = diaspora }, [diaspora])
  useEffect(() => { isPaintingRef.current = isPainting }, [isPainting])

  // Handlers de window con identidad ESTABLE (definidos en useRef, no
  // recreados por render). Sin esto, removeEventListener no encuentra los
  // handlers a remover y se acumulan listeners zombie cada drag.
  const handlersRef = useRef<{
    onMove: (e: PointerEvent) => void
    onUp: (e: PointerEvent) => void
  } | null>(null)

  if (!handlersRef.current) {
    const endDrag = () => {
      dragRef.current = null
      pinchRef.current = null
      if (!handlersRef.current) return
      window.removeEventListener('pointermove', handlersRef.current.onMove)
      window.removeEventListener('pointerup', handlersRef.current.onUp)
      window.removeEventListener('pointercancel', handlersRef.current.onUp)
    }
    handlersRef.current = {
      onMove: (e: PointerEvent) => {
        // Pinch en progreso: actualizar scale + pan.
        // El pan se reescala por el mismo factor que el scale para que el
        // centro del viewport quede anclado durante el zoom (sin esto, el
        // mapa se desplaza al zoomear si previamente hubo pan).
        if (pinchRef.current) {
          const { p1, p2, startDist, startScale, startPan } = pinchRef.current
          const p = e.pointerId === p1.id ? p1 : e.pointerId === p2.id ? p2 : null
          if (!p) return
          p.x = e.clientX
          p.y = e.clientY
          const newDist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
          const newScale = Math.max(0.5, Math.min(8, startScale * (newDist / startDist)))
          const factor = newScale / startScale
          setScale(newScale)
          setPan({ x: startPan.x * factor, y: startPan.y * factor })
          return
        }
        const d = dragRef.current
        if (!d || d.pointerId !== e.pointerId) return
        const dx = e.clientX - d.startX
        const dy = e.clientY - d.startY
        if (Math.hypot(dx, dy) > 5) wasDraggedRef.current = true
        if (isGlobeRef.current) {
          const s = sizeRef.current
          const radius = Math.max(20, Math.min(s?.w ?? 800, (s?.h ?? 600) * (1 - mobilePanelHeightRef.current)) / 2 - 24)
          const k = 90 / radius
          const newLambda = d.startRotation[0] + dx * k
          const newPhi = Math.max(-89, Math.min(89, d.startRotation[1] - dy * k))
          setRotation([newLambda, newPhi, d.startRotation[2]])
        } else {
          setPan({ x: d.startPan.x + dx, y: d.startPan.y + dy })
        }
      },
      onUp: (e: PointerEvent) => {
        if (pinchRef.current && (e.pointerId === pinchRef.current.p1.id || e.pointerId === pinchRef.current.p2.id)) {
          endDrag()
          return
        }
        if (dragRef.current?.pointerId === e.pointerId) {
          // Tap → paint (modo Dibujar) o setSelected (otros tabs).
          // En modo Dibujar Y con color activo, el click pinta el país.
          // Sin color activo, el click sigue seleccionando (lectura).
          if (!wasDraggedRef.current && downTargetRef.current && diasporaRef.current) {
            const iso = downTargetRef.current.dataset.iso
            const feature = diasporaRef.current.features.find(
              f => (f.properties as DiasporaProps).iso_a3 === iso,
            )
            if (feature && iso) {
              const props = feature.properties as DiasporaProps
              if (isPaintingRef.current) {
                paintFeature('countries', iso)
              } else {
                setSelected({
                  name: props.name,
                  iso: props.iso_a3,
                  value: props._value ?? null,
                })
              }
            }
          }
          downTargetRef.current = null
          endDrag()
        }
      },
    }
  }

  // Pointer move hover (desktop): identifica el path bajo el cursor y muestra
  // tooltip flotante con nombre + valor. Si hay drag activo, no hace nada
  // (queremos cursor=grabbing limpio). En mobile el hover no aplica: pointer
  // coarse no tiene "estado hover", así que solo nos importa para mouse/pen.
  function handlePointerMoveContainer(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current || pinchRef.current) {
      if (hovered) setHovered(null)
      return
    }
    // Solo nos interesan pointers tipo mouse/pen. Los touch generan pointermove
    // entre touches pero no es un "hover" real.
    if (e.pointerType === 'touch') return
    const t = e.target as Element
    if (t instanceof SVGPathElement && t.dataset.iso) {
      const iso = t.dataset.iso
      // Brush: Ctrl + hover en modo Pintar → pinta sin toggle. La acción
      // es idempotente (si el feature ya tiene el color activo, no hace
      // nada), así que se puede llamar en cada pointermove sin throttle.
      if (isPainting && e.ctrlKey) {
        paintFeatureForce('countries', iso)
      }
      const feature = diaspora?.features.find(
        f => (f.properties as DiasporaProps).iso_a3 === iso,
      )
      if (feature) {
        const p = feature.properties as DiasporaProps
        setHovered({
          iso,
          name: p.name,
          value: typeof p._value === 'number' ? p._value : null,
          matched: !!p._matched,
          x: e.clientX,
          y: e.clientY,
        })
        return
      }
    }
    if (hovered) setHovered(null)
  }

  function handlePointerLeaveContainer() {
    if (hovered) setHovered(null)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Segundo dedo: arrancar pinch
    if (dragRef.current && !pinchRef.current) {
      const p1 = { id: dragRef.current.pointerId, x: dragRef.current.startX, y: dragRef.current.startY }
      const p2 = { id: e.pointerId, x: e.clientX, y: e.clientY }
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      pinchRef.current = {
        p1, p2,
        startDist: Math.hypot(dx, dy),
        startScale: scaleRef.current,
        startPan: { ...panRef.current },
      }
      dragRef.current = null
      return
    }
    // Primer pointer: arrancar drag con listeners en WINDOW (no en el div ni
    // el SVG). En iOS Safari, los pointer events sobre elementos SVG sufren
    // problemas: setPointerCapture no funciona bien, y el browser cancela
    // gestos a los pocos pixels ("se mueve un poquito y se para"). Window
    // listeners reciben TODOS los eventos del browser sin pasar por el
    // árbol DOM, lo que evita esos problemas.
    wasDraggedRef.current = false
    const t = e.target as Element
    downTargetRef.current = t instanceof SVGPathElement && t.dataset.iso ? t : null
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRotation: rotationRef.current,
      startPan: panRef.current,
    }
    const h = handlersRef.current
    if (h) {
      window.addEventListener('pointermove', h.onMove)
      window.addEventListener('pointerup', h.onUp)
      window.addEventListener('pointercancel', h.onUp)
    }
  }

  // Cleanup al desmontar: remover cualquier listener pendiente.
  useEffect(() => {
    return () => {
      const h = handlersRef.current
      if (h) {
        window.removeEventListener('pointermove', h.onMove)
        window.removeEventListener('pointerup', h.onUp)
        window.removeEventListener('pointercancel', h.onUp)
      }
    }
  }, [])

  // React monta onWheel como passive: true, por lo que e.preventDefault() es
  // un no-op. Para que la rueda haga zoom sin scrollear la página, registramos
  // un wheel listener nativo con passive: false. Va en el container (div, no
  // SVG) para emparejarse con los pointer handlers que también viven ahí.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const currentScale = scaleRef.current
      const newScale = Math.max(0.5, Math.min(8, currentScale * factor))
      if (newScale === currentScale) return // clamped al límite
      // Ancla el zoom al centro del viewport: el transform es
      //   T(P) = scale*P + (1-scale)*(cx,cy) + pan
      // Para que el centro (cx,cy) quede fijo al pasar de oldScale a newScale,
      // pan_new = (newScale/oldScale) * pan. Sin esta línea el zoom desplaza
      // el mapa cuando previamente hubo pan (bug histórico reportado).
      const actualFactor = newScale / currentScale
      setScale(newScale)
      setPan(p => ({ x: p.x * actualFactor, y: p.y * actualFactor }))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Zoom centrado en el ÁREA VISIBLE (no en el container completo). El truco
  // es translate(cx,cy) → scale → translate(-cx,-cy): el contenido se escala
  // alrededor del centro pasado como pivot. Ese pivot debe matchear el lugar
  // donde la esfera/mapa están posicionados — en mobile la esfera vive arriba
  // (centerY = visibleH/2, ver pathGen líneas arriba) porque el panel drawer
  // tapa la mitad inferior. Si usáramos size.h/2 como pivot, el zoom anclaría
  // un punto debajo del panel y el globo se desplaza al zoomear.
  // En desktop visibleH === size.h, así que el cálculo coincide con size.h/2.
  const visibleH = size ? (isMobile ? size.h * (1 - mobilePanelHeight) : size.h) : 0
  const cx = size ? size.w / 2 : 0
  const cy = visibleH / 2
  const transform = `translate(${cx + pan.x},${cy + pan.y}) scale(${scale}) translate(${-cx},${-cy})`

  // Sphere de fondo (solo en Orthographic): es el "borde del globo"
  const showSphere = PROJECTIONS[projection].isGlobe

  // ─── Efectos visuales del tema Cosmos ──────────────────────────────────
  // El tema Cosmos agrega tres elementos para reforzar el feel espacial:
  //   1. Radial gradient en el sphere → ilusión 3D (highlight + shadow)
  //   2. Drop shadow tenue azul → halo atmosférico alrededor del globo
  //   3. Estrellas determinísticas (seed fijo) en el fondo del viewport
  // Sólo aplican cuando globeTheme === 'cosmos'; otros temas quedan idénticos.
  const isCosmos = isCosmosTheme

  // Stops del radial gradient derivados del color base (cosmosTweaks.globe).
  // Lighten/darken simple por mezcla RGB con blanco/negro, escalados por
  // highlightIntensity (0 = sin efecto, 1 = default, 2 = exagerado).
  // Cap a 0.85/0.7 para que en intensity=2 no se vuelva blanco/negro puro.
  const gradientStops = useMemo(() => {
    const lightenAmt = Math.min(0.85, 0.35 * cosmosTweaks.highlightIntensity)
    const darkenAmt = Math.min(0.7, 0.3 * cosmosTweaks.highlightIntensity)
    return {
      highlight: lightenHex(cosmosTweaks.globe, lightenAmt),
      base: cosmosTweaks.globe,
      shadow: darkenHex(cosmosTweaks.globe, darkenAmt),
    }
  }, [cosmosTweaks.globe, cosmosTweaks.highlightIntensity])

  // Estrellas: posiciones determinísticas (mulberry32 con seed fijo) para
  // que la "constelación" sea estable entre renders y rotaciones. Densidad
  // base ≈ 1 estrella cada 7000 px² del viewport, multiplicada por el
  // tweak starsDensity (0 = sin estrellas, 1 = default, hasta 3x).
  const stars = useMemo(() => {
    if (!isCosmos || !size || cosmosTweaks.starsDensity <= 0) return []
    const baseCount = Math.round((size.w * size.h) / 7000)
    const count = Math.max(0, Math.min(420, Math.round(baseCount * cosmosTweaks.starsDensity)))
    if (count === 0) return []
    const rand = mulberry32(42)
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      cx: rand() * size.w,
      cy: rand() * size.h,
      r: rand() * 0.9 + 0.3, // 0.3 – 1.2 px
      opacity: rand() * 0.55 + 0.25, // 0.25 – 0.8
    }))
  }, [isCosmos, size?.w, size?.h, cosmosTweaks.starsDensity])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        background: mapStyle.transparentBg ? 'transparent' : theme.space,
        // touchAction y handlers van acá (no en el SVG) porque iOS Safari
        // no respeta setPointerCapture cuando se invoca sobre elementos SVG:
        // los touches se quedan "pegados" al child path donde empezaron y
        // los pointermove jamás llegan al handler → drag muerto sobre toda
        // forma rellena (países y sphere). En el div HTML funciona estable.
        touchAction: 'none',
        cursor: isGlobeProjection ? 'grab' : 'move',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMoveContainer}
      onPointerLeave={handlePointerLeaveContainer}
    >
      {(!diaspora || !size) ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
          Cargando mapa mundial…
        </div>
      ) : (
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{ shapeRendering: 'geometricPrecision' }}
        className="world-map-svg"
      >
        {/* Defs del tema Cosmos: radial gradient (efecto 3D del sphere) +
            drop shadow azul (halo atmosférico). Sólo se montan cuando el
            tema activo es Cosmos para no agregar nodos vacíos en otros temas. */}
        {isCosmos && (
          <defs>
            <radialGradient
              id="cosmos-globe-gradient"
              cx={`${cosmosTweaks.highlightX}%`}
              cy={`${cosmosTweaks.highlightY}%`}
              r="75%"
            >
              <stop offset="0%" stopColor={gradientStops.highlight} stopOpacity="1" />
              <stop offset="55%" stopColor={gradientStops.base} stopOpacity="1" />
              <stop offset="100%" stopColor={gradientStops.shadow} stopOpacity="1" />
            </radialGradient>
            <filter
              id="cosmos-globe-shadow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="10"
                floodColor={cosmosTweaks.globe}
                floodOpacity={cosmosTweaks.haloIntensity}
              />
            </filter>
          </defs>
        )}

        {/* Estrellas: FUERA del <g transform> para que no rote/escale con el
            mapa — quedan fijas al viewport como si fueran del espacio real,
            no del mundo. pointerEvents=none para no interferir con el drag. */}
        {isCosmos && stars.length > 0 && (
          <g pointerEvents="none">
            {stars.map(s => (
              <circle
                key={s.id}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill="#ffffff"
                opacity={s.opacity}
              />
            ))}
          </g>
        )}

        <g ref={gRef} transform={transform}>
          {/* Cuerpo del globo. En proyecciones tipo globo (Orthographic) la
              sphere actúa como "agua/atmósfera" detrás de los continentes.
              En proyecciones planas (Equal Earth) actúa como background sutil
              que recorta los países al área del mundo.
              En tema Cosmos + Orthographic: aplicamos radial gradient
              (centro claro, bordes oscuros) + drop shadow azul para halo. */}
          <path
            d={pathGen({ type: 'Sphere' } as never) ?? undefined}
            fill={isCosmos && showSphere ? 'url(#cosmos-globe-gradient)' : theme.globe}
            stroke={showSphere ? theme.border : 'none'}
            strokeWidth={showSphere ? 0.5 : 0}
            filter={isCosmos && showSphere ? 'url(#cosmos-globe-shadow)' : undefined}
          />

          {/* Países. Bordes respetan los toggles del panel Estilo (noBorders,
              lineWidth, borderColor, borderOpacity) — antes estaban hardcoded
              a negro 0.6px "por legibilidad", pero el user pidió control real.
              Aplica el mismo patrón anti-gap que MapView/RegionTestView:
                - noBorders=true → stroke same-color del fill (sin bordes
                  visibles, tapando slivers que dejaría weight=0)
                - lineWidth < 0.5 → same-color con weight mínimo 0.5
                - sino → stroke con borderColor y weight del slider */}
          {(regionGeo ?? diaspora).features.map((f, i) => {
            const props = f.properties as DiasporaProps
            // Override del paint: si el feature está pintado por el user en
            // modo Dibujar, ese color manda. En el tab Dibujar el indicador
            // se ignora (lienzo limpio); fuera del tab, _color del indicador
            // se ve normal (paint encima cuando hay).
            const paintColor = paintAssignments[props.iso_a3]
            const fillColor =
              paintColor ??
              (isOnPaintTab ? theme.missing : (props._color ?? theme.missing))
            // En paint mode el opacity es uniforme (lienzo plano). Fuera, los
            // unmatched del indicador se atenúan al 60% para resaltar matched.
            const op = isOnPaintTab
              ? mapStyle.fillOpacity
              : (props._matched || paintColor)
                ? mapStyle.fillOpacity
                : Math.min(mapStyle.fillOpacity * 0.6, 0.5)

            // Lógica de bordes idéntica a la de MapView/RegionTestView.
            let stroke: string
            let weight: number
            let strokeOp: number
            if (mapStyle.noBorders) {
              stroke = fillColor
              weight = 0.6
              strokeOp = mapStyle.fillOpacity
            } else if (mapStyle.lineWidth < 0.5) {
              stroke = fillColor
              weight = Math.max(mapStyle.lineWidth, 0.5)
              strokeOp = mapStyle.borderOpacity
            } else {
              stroke = mapStyle.borderColor
              weight = mapStyle.lineWidth
              strokeOp = mapStyle.borderOpacity
            }

            const d = pathGen(f as never)
            if (!d) return null
            return (
              <path
                key={props.iso_a3 || i}
                data-iso={props.iso_a3}
                d={d}
                fill={fillColor}
                fillOpacity={op}
                stroke={stroke}
                strokeWidth={weight}
                strokeOpacity={strokeOp}
                style={{ cursor: 'pointer' }}
              />
            )
          })}

          {/* Outline del feature hovered: contorno oscuro encima del path
              original. Se renderiza al final para quedar por encima de todos
              los países (evita que un vecino con z mayor lo tape). */}
          {hovered && (() => {
            const feature = diaspora.features.find(
              f => (f.properties as DiasporaProps).iso_a3 === hovered.iso,
            )
            if (!feature) return null
            const d = pathGen(feature as never)
            if (!d) return null
            return (
              <path
                d={d}
                fill="none"
                stroke="#0f172a"
                strokeWidth={1.4}
                strokeOpacity={0.95}
                pointerEvents="none"
                style={{ vectorEffect: 'non-scaling-stroke' }}
              />
            )
          })()}

          {/* Etiquetas de país (toggle "Etiquetas de país" del panel Estilo).
              Texto centrado en el centroide proyectado de cada feature visible.
              paintOrder="stroke" + stroke blanco grueso = halo de legibilidad
              sobre fondos arbitrarios (tierra, agua, banderas, etc.) sin
              acoplar al colorScheme.

              Filtramos: centroides no finitos (NaN cuando el país está detrás
              del globo en Orthographic con clipAngle), y countries cuyo
              centroide cae fuera del viewport visible (no tiene sentido
              renderear texto que el user no ve).

              No throttleamos por bounding-box-size — los países chicos
              pueden quedar con label encimado, pero el user puede:
              (a) zoomear, (b) cambiar región, (c) apagar el toggle. */}
          {mapStyle.showCountryLabels &&
            (regionGeo ?? diaspora).features.map(f => {
              const props = f.properties as DiasporaProps
              const name = props.name
              if (!name) return null
              const centroid = pathGen.centroid(f as never)
              if (
                !centroid ||
                !isFinite(centroid[0]) ||
                !isFinite(centroid[1])
              ) {
                return null
              }
              return (
                <text
                  key={`label-${props.iso_a3 || name}`}
                  x={centroid[0]}
                  y={centroid[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={600}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  pointerEvents="none"
                  style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  {name}
                </text>
              )
            })}
        </g>
      </svg>
      )}

      {/* Tooltip flotante (solo desktop con pointer mouse/pen). Posición
          fixed para que no se recorte por el container y siga al cursor.
          El formato del valor sale del reporte global activo. */}
      {hovered && (
        <div
          className="pointer-events-none fixed z-[1100] rounded-md bg-slate-900/95 px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg"
          style={{
            left: hovered.x + 14,
            top: hovered.y + 14,
            // Si el tooltip queda muy cerca del borde derecho, lo movemos
            // a la izquierda del cursor para que no se recorte
            transform:
              size && hovered.x + 220 > size.w ? 'translateX(calc(-100% - 28px))' : undefined,
          }}
        >
          <div className="font-semibold">{hovered.name}</div>
          <div className="mt-0.5 tabular-nums text-slate-300">
            {hovered.value != null
              ? formatHoverValue(hovered.value, globalMetric)
              : 'sin dato'}
          </div>
          {activeReport && hovered.matched && (
            <div className="mt-0.5 text-[10px] text-slate-400">{activeReport.short}</div>
          )}
        </div>
      )}
    </div>
  )
}

// Formato del valor en el tooltip flotante. Cada modo tiene su propia
// unidad: el formato debe coincidir con el del panel para que el usuario
// reconozca el mismo número. Ver DiasporaPanel.formatValue.
// PRNG determinístico (mulberry32). Lo usamos para que las estrellas del
// tema Cosmos queden en las mismas posiciones entre renders — sin esto,
// Math.random() generaría una "constelación" nueva en cada repaint y se
// vería ruidoso al hacer drag o resize.
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Lighten/darken simple en RGB: mezcla lineal con blanco (#ffffff) o negro
// (#000000). amount ∈ [0,1]. Lo usamos para derivar los stops del radial
// gradient del globo Cosmos a partir del color base editable por el user.
// No es HSL-perfecto, pero para los rangos pastel de Cosmos da resultado
// visualmente consistente.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}
function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

function formatHoverValue(value: number, metric: string): string {
  if (metric === 'porcentaje') return `${value.toFixed(2)}%`
  if (metric === 'pib_pc')
    return `$${value.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
  if (metric === 'idh') return value.toFixed(3)
  // migrantes / venezolanos / poblacion: número con separador de miles.
  return value.toLocaleString('es-VE', { maximumFractionDigits: 0 })
}
