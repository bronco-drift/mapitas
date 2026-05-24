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
import { useStore } from '../store'
import type { DiasporaProps } from '../lib/types'
import type { ProjectionId } from '../lib/projections'
import { getGlobeTheme } from '../lib/globe-themes'

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
  const theme = getGlobeTheme(mapStyle.globeTheme)

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
    } else if (diaspora && p.fitExtent) {
      p.fitExtent(
        [
          [MARGIN, visibleTop + MARGIN],
          [size.w - MARGIN, visibleBottom - MARGIN],
        ],
        diaspora as never,
      )
    } else {
      p.translate([size.w / 2, (visibleTop + visibleBottom) / 2])
    }
    return geoPath(p)
  }, [projection, rotation, size, diaspora, isMobile, mobilePanelHeight])

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
  // Cache del segundo pointer para pinch-to-zoom (multi-touch)
  const pinchRef = useRef<{ p1: { id: number; x: number; y: number }; p2: { id: number; x: number; y: number }; startDist: number; startScale: number } | null>(null)
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
  useEffect(() => { rotationRef.current = rotation }, [rotation])
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { sizeRef.current = size }, [size])
  useEffect(() => { mobilePanelHeightRef.current = mobilePanelHeight }, [mobilePanelHeight])
  useEffect(() => { isGlobeRef.current = isGlobeProjection }, [isGlobeProjection])
  useEffect(() => { diasporaRef.current = diaspora }, [diaspora])

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
        // Pinch en progreso: actualizar scale
        if (pinchRef.current) {
          const { p1, p2, startDist, startScale } = pinchRef.current
          const p = e.pointerId === p1.id ? p1 : e.pointerId === p2.id ? p2 : null
          if (!p) return
          p.x = e.clientX
          p.y = e.clientY
          const newDist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
          const newScale = Math.max(0.5, Math.min(8, startScale * (newDist / startDist)))
          setScale(newScale)
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
          // Tap → setSelected (event delegation desde el div).
          if (!wasDraggedRef.current && downTargetRef.current && diasporaRef.current) {
            const iso = downTargetRef.current.dataset.iso
            const feature = diasporaRef.current.features.find(
              f => (f.properties as DiasporaProps).iso_a3 === iso,
            )
            if (feature) {
              const props = feature.properties as DiasporaProps
              setSelected({
                name: props.name,
                iso: props.iso_a3,
                value: props._value ?? null,
              })
            }
          }
          downTargetRef.current = null
          endDrag()
        }
      },
    }
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
      setScale(s => Math.max(0.5, Math.min(8, s * factor)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Zoom centrado en el viewport (no en (0,0) del SVG). El truco es
  // translate(cx,cy) → scale → translate(-cx,-cy): el contenido se escala
  // alrededor del centro pantalla y el centro mismo queda inmóvil. El pan
  // adicional se aplica DESPUÉS del scale (no se escala con el zoom).
  const cx = size ? size.w / 2 : 0
  const cy = size ? size.h / 2 : 0
  const transform = `translate(${cx + pan.x},${cy + pan.y}) scale(${scale}) translate(${-cx},${-cy})`

  // Sphere de fondo (solo en Orthographic): es el "borde del globo"
  const showSphere = PROJECTIONS[projection].isGlobe

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
      >
        <g ref={gRef} transform={transform}>
          {/* Cuerpo del globo. En proyecciones tipo globo (Orthographic) la
              sphere actúa como "agua/atmósfera" detrás de los continentes.
              En proyecciones planas (Equal Earth) actúa como background sutil
              que recorta los países al área del mundo. */}
          <path
            d={pathGen({ type: 'Sphere' } as never) ?? undefined}
            fill={theme.globe}
            stroke={showSphere ? theme.border : 'none'}
            strokeWidth={showSphere ? 0.5 : 0}
          />

          {/* Países */}
          {diaspora.features.map((f, i) => {
            const props = f.properties as DiasporaProps
            const fillColor = props._color ?? theme.missing
            const matched = props._matched
            const op = matched ? mapStyle.fillOpacity : Math.min(mapStyle.fillOpacity * 0.6, 0.5)
            // En vista Global "sin bordes" significa literalmente sin stroke
            // (weight=0). En vista VE el modo activa un tapa-gaps con
            // stroke=fillColor + weight expandido (strokeWeightForOpacity)
            // porque los polígonos comparten arcs del TopoJSON simplificado
            // y dejan hilitos del fondo. En Global los países NO comparten
            // arcs entre sí (cada uno es un feature independiente), así que
            // ese hack no aplica y solo introducía artefactos visuales.
            const stroke = mapStyle.borderColor
            const weight = mapStyle.noBorders ? 0 : mapStyle.lineWidth
            const strokeOp = mapStyle.borderOpacity
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
              >
                <title>
                  {`${props.name}${
                    typeof props._value === 'number'
                      ? ` · ${props._value.toLocaleString('es-VE')} ${
                          props.is_origin ? 'habitantes (origen)' : 'migrantes'
                        }`
                      : ' · sin dato'
                  }${props.as_of ? ` (${props.as_of})` : ''}`}
                </title>
              </path>
            )
          })}
        </g>
      </svg>
      )}
    </div>
  )
}
