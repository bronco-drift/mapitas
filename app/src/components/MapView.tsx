import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import type { Layer, PathOptions } from 'leaflet'
import L from 'leaflet'
import type { Feature } from 'geojson'
import { useStore } from '../store'
import type { MapStyle } from '../store'
import type { Adm0Props, Adm1Props, Adm2Props, AdmGeoJSON } from '../lib/types'
import { formatIndicatorValue } from '../data/indicators'
import { getBasemap, CARTO_LABELS_OVERLAY_URL } from '../lib/basemaps'

const VENEZUELA_BOUNDS = L.latLngBounds(L.latLng(0.5, -73.5), L.latLng(13.0, -58.0))

// Puente para sacar el zoom de Leaflet hacia React state Y exponer el map
// hacia afuera vía ref. Necesitamos las dos cosas: leer el zoom para mostrarlo
// y poder llamar map.setZoom(z) desde un slider que vive fuera del MapContainer.
// Suscribimos a `zoom` (no `zoomend`) para que el slider se sienta vivo durante
// el drag (sino solo updateamos al soltar).
function ZoomBridge({
  onChange,
  mapRef,
}: {
  onChange: (z: number) => void
  mapRef: { current: L.Map | null }
}) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    onChange(map.getZoom())
    const handler = () => onChange(map.getZoom())
    map.on('zoom', handler)
    map.on('zoomend', handler)
    return () => {
      map.off('zoom', handler)
      map.off('zoomend', handler)
    }
  }, [map, onChange, mapRef])
  return null
}

function MapBootstrap({ bgColor, bounds }: { bgColor: string; bounds: L.LatLngBounds }) {
  const map = useMap()
  // boundsRef nos permite reaccionar a cambios de bounds (toggle de vista)
  // sin perder el "fitted" inicial dentro del mismo bounds.
  const lastBoundsRef = useRef<L.LatLngBounds>(bounds)
  // Pane custom para el basemap de contornos: z-index 300 = encima de los
  // tiles (200) pero debajo del overlayPane default (400) donde vive el
  // choropleth de VE. Así los polígonos de Venezuela siempre quedan arriba.
  useEffect(() => {
    if (!map.getPane('worldOutlinesPane')) {
      const pane = map.createPane('worldOutlinesPane')
      pane.style.zIndex = '300'
      pane.style.pointerEvents = 'none'
    }
    // Pane para el contorno del polígono hoverado: z-index 500 = encima de
    // TODO (overlayPane 400, símbolos, borders, tooltips bajos). El path del
    // polígono captura el evento abajo, pero el outline visible se dibuja en
    // este pane para que no quede tapado por banderas/escudos ni por los
    // bordes de overlay (stateOverlay, countryBorder).
    if (!map.getPane('hoverPane')) {
      const pane = map.createPane('hoverPane')
      pane.style.zIndex = '500'
      pane.style.pointerEvents = 'none'
    }
    // Pane del contorno país (toggle "Borde país"): z-index 450 = encima de
    // overlayPane (400) y de los símbolos que se appendean al SVG, pero
    // debajo de hoverPane (500). Sin este pane el contorno quedaba tapado
    // por banderas/escudos cuando había un indicador simbólico activo.
    if (!map.getPane('countryBorderPane')) {
      const pane = map.createPane('countryBorderPane')
      pane.style.zIndex = '450'
      pane.style.pointerEvents = 'none'
    }
    // Pane de "Bordes de estado arriba" (toggle stateOverlayInMuni): z-index
    // 440, entre el data layer del choropleth (400) y el countryBorderPane
    // (450). Sin este pane, al cambiar de reporte el data layer se remonta
    // y queda en el DOM DESPUÉS del overlay, tapándolo. El user tenía que
    // toggle off/on para que el overlay vuelva a verse.
    if (!map.getPane('stateOverlayPane')) {
      const pane = map.createPane('stateOverlayPane')
      pane.style.zIndex = '440'
      pane.style.pointerEvents = 'none'
    }
  }, [map])
  useEffect(() => {
    const container = map.getContainer()
    let fitted = false
    const handleResize = () => {
      map.invalidateSize()
      if (!fitted && container.clientWidth > 50 && container.clientHeight > 50) {
        map.fitBounds(bounds, { padding: [16, 16] })
        fitted = true
      }
    }
    requestAnimationFrame(handleResize)
    const ro = new ResizeObserver(handleResize)
    ro.observe(container)
    window.addEventListener('resize', handleResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [map, bounds])

  // Si los bounds cambian (toggle de vista), reposicionar el mapa.
  useEffect(() => {
    if (lastBoundsRef.current === bounds) return
    lastBoundsRef.current = bounds
    map.fitBounds(bounds, { padding: [16, 16] })
  }, [map, bounds])

  // react-leaflet no actualiza el style del container en re-renders, así que
  // sincronizamos el background imperativamente cuando cambia desde el sidebar.
  useEffect(() => {
    map.getContainer().style.background = bgColor
    // Sólo es 'transparent' si el caller ya lo seteó (cf. MapView).
  }, [map, bgColor])

  return null
}

// En modo noBorders, el stroke del mismo color del fill se usa para tapar
// gaps geométricos entre polígonos. A opacidad 100% el efecto necesita
// weight grueso (1.7); a opacidad baja el polígono ya está translúcido y
// un stroke grueso se ve desproporcionado, así que se va achicando.
//   opacity ≥ 0.9 → weight 1.7  (tapa-gaps al máximo)
//   opacity ≤ 0.3 → weight 0.5  (mínimo útil)
//   entre        → interpolación lineal
import wikiInfo from '../data/wiki-info.json'
type WikiEntry = { hasFlag?: boolean; hasShield?: boolean }
const wikiCountry = (wikiInfo as { country?: Record<string, WikiEntry> }).country ?? {}
const wikiStates = (wikiInfo as { states: Record<string, WikiEntry> }).states
const wikiMunis = (wikiInfo as { munis: Record<string, WikiEntry> }).munis

type SymbolLevel = 'country' | 'state' | 'muni'

// Resuelve la URL del asset para un símbolo (bandera/escudo) de una entidad.
// Maneja excepción: VE-GE usa .svg (placeholder tricolor manual). Resto .png.
function symbolAssetUrl(kind: 'flag' | 'shield', level: SymbolLevel, id: string): string {
  const dir = kind === 'flag' ? 'flags' : 'shields'
  const ext = level === 'state' && id === 'VE-GE' ? 'svg' : 'png'
  return `${import.meta.env.BASE_URL}data/${dir}/${level}/${id}.${ext}`
}

function entityHasSymbol(kind: 'flag' | 'shield', level: SymbolLevel, id: string): boolean {
  const source = level === 'country' ? wikiCountry : level === 'state' ? wikiStates : wikiMunis
  const entry = source[id]
  return !!(kind === 'flag' ? entry?.hasFlag : entry?.hasShield)
}

// Modo simbólico: cada entidad (estado o muni) se rellena con su bandera o
// escudo RECORTADO EXACTAMENTE al polígono geográfico. Técnica: SVG
// <clipPath> con el path del polígono + <image> clipeada con
// preserveAspectRatio="cover".
//
// Generalizado para 4 indicadores: banderas estados, escudos estados,
// banderas munis, escudos munis. Props: kind + level + data del geo.
//
// En cada zoom/move recalculamos:
//   1. Polígono de la entidad en pixel coords del SVG de Leaflet
//   2. <clipPath> con ese path
//   3. <image> posicionada en el bounding box del polígono, con clip aplicado
function SymbolClippedLayer({
  kind,
  level,
  geo,
  opacity,
}: {
  kind: 'flag' | 'shield'
  level: SymbolLevel
  geo: AdmGeoJSON<Adm0Props> | AdmGeoJSON<Adm1Props> | AdmGeoJSON<Adm2Props>
  opacity: number
}) {
  const map = useMap()
  useEffect(() => {
    if (!map || !geo) return
    let cancelled = false
    let cleanup: Array<() => void> = []

    function setup() {
      if (cancelled) return
      const overlayPane = map.getPanes().overlayPane
      const svg = overlayPane?.querySelector('svg')
      if (!svg) {
        requestAnimationFrame(setup)
        return
      }

      const SVG_NS = 'http://www.w3.org/2000/svg'
      const defsAttr = `data-symbol-defs-${kind}-${level}`
      const groupAttr = `data-symbol-group-${kind}-${level}`

      let defs = svg.querySelector(`defs[${defsAttr}="true"]`) as SVGDefsElement | null
      if (!defs) {
        defs = document.createElementNS(SVG_NS, 'defs')
        defs.setAttribute(defsAttr, 'true')
        svg.insertBefore(defs, svg.firstChild)
      }
      let group = svg.querySelector(`g[${groupAttr}="true"]`) as SVGGElement | null
      if (!group) {
        group = document.createElementNS(SVG_NS, 'g')
        group.setAttribute(groupAttr, 'true')
        svg.appendChild(group)
      }

      function update() {
        if (cancelled || !defs || !group) return
        defs.textContent = ''
        group.textContent = ''

        for (const feature of geo.features) {
          // ID de la entidad según nivel: 'VE' para país, iso para estados,
          // sourceID para munis.
          const id =
            level === 'country' ? 'VE'
            : level === 'state' ? (feature.properties as Adm1Props).iso
            : (feature.properties as Adm2Props).sourceID
          if (!entityHasSymbol(kind, level, id)) continue

          // Convertir geometría a pixel coords del SVG de Leaflet.
          const geom = feature.geometry as
            | { type: 'Polygon'; coordinates: number[][][] }
            | { type: 'MultiPolygon'; coordinates: number[][][][] }
          const polygons =
            geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates

          let minX = Infinity
          let minY = Infinity
          let maxX = -Infinity
          let maxY = -Infinity
          const pathSegments: string[] = []

          for (const rings of polygons) {
            for (const ring of rings) {
              const pixels: Array<[number, number]> = []
              for (const [lng, lat] of ring) {
                const p = map.latLngToLayerPoint([lat, lng])
                if (p.x < minX) minX = p.x
                if (p.x > maxX) maxX = p.x
                if (p.y < minY) minY = p.y
                if (p.y > maxY) maxY = p.y
                pixels.push([p.x, p.y])
              }
              const seg =
                pixels
                  .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
                  .join('') + 'Z'
              pathSegments.push(seg)
            }
          }

          // <clipPath> con el polígono en pixel coords. ID único por
          // kind + level + id para que múltiples capas no colisionen.
          const clipId = `clip-${kind}-${level}-${id}`
          const clipPath = document.createElementNS(SVG_NS, 'clipPath')
          clipPath.setAttribute('id', clipId)
          clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse')
          const clipPathPath = document.createElementNS(SVG_NS, 'path')
          clipPathPath.setAttribute('d', pathSegments.join(' '))
          clipPathPath.setAttribute('fill-rule', 'evenodd')
          clipPath.appendChild(clipPathPath)
          defs.appendChild(clipPath)

          // <image> en el bbox del polígono, recortada con el clip-path.
          // preserveAspectRatio="none" garantiza que la imagen llena 100%
          // el bbox (sin gaps por aspect ratio interno de SVG fuente).
          const w = maxX - minX
          const h = maxY - minY
          const img = document.createElementNS(SVG_NS, 'image')
          img.setAttribute('href', symbolAssetUrl(kind, level, id))
          img.setAttribute('x', String(minX))
          img.setAttribute('y', String(minY))
          img.setAttribute('width', String(w))
          img.setAttribute('height', String(h))
          img.setAttribute('preserveAspectRatio', 'none')
          img.setAttribute('clip-path', `url(#${clipId})`)
          img.setAttribute('opacity', String(opacity))
          img.setAttribute('pointer-events', 'none')
          group.appendChild(img)
        }
      }

      update()
      map.on('zoomend moveend viewreset', update)
      cleanup.push(() => map.off('zoomend moveend viewreset', update))
      cleanup.push(() => {
        defs?.remove()
        group?.remove()
      })
    }

    requestAnimationFrame(setup)

    return () => {
      cancelled = true
      cleanup.forEach(fn => fn())
      cleanup = []
    }
  }, [map, geo, opacity, kind, level])

  return null
}

function strokeWeightForOpacity(opacity: number): number {
  if (opacity >= 0.9) return 1.7
  if (opacity <= 0.3) return 0.5
  const t = (opacity - 0.3) / (0.9 - 0.3)
  return 0.5 + t * (1.7 - 0.5)
}


function fillStyleFor(
  style: MapStyle,
  _level: 'adm0' | 'adm1' | 'adm2',
): (feature?: Feature) => PathOptions {
  return feature => {
    const props = feature?.properties as Adm1Props | Adm2Props | undefined
    const fillColor = props?._color ?? '#e5e7eb'

    // Cuando "Sin bordes" está ON: stroke del mismo color del fill, weight
    // que se ajusta a la opacidad. fillOpacity y opacity comparten valor para
    // que TODO el polígono (relleno + stroke superpuesto) se atenúe parejo
    // cuando el user mueve el slider.
    if (style.noBorders) {
      const op = props?._matched ? style.fillOpacity : Math.min(style.fillOpacity * 0.6, 0.5)
      return {
        fillColor,
        color: fillColor,
        weight: strokeWeightForOpacity(style.fillOpacity),
        fillOpacity: op,
        opacity: op,
      }
    }

    // Grosor bajo: mismo truco pero con weight del slider (mínimo 0.5)
    const useFillForStroke = style.lineWidth < 0.5
    const strokeColor = useFillForStroke ? fillColor : style.borderColor
    const weight = useFillForStroke ? Math.max(style.lineWidth, 0.5) : style.lineWidth
    return {
      fillColor,
      color: strokeColor,
      weight,
      fillOpacity: props?._matched ? style.fillOpacity : Math.min(style.fillOpacity * 0.6, 0.5),
      opacity: style.borderOpacity,
    }
  }
}

function stateOverlayStyle(style: MapStyle): PathOptions {
  // Solo bordes, sin relleno, levemente más gruesos para destacar la jerarquía
  return {
    fillOpacity: 0,
    color: style.borderColor,
    weight: Math.max(style.lineWidth * 2, 1.2),
    opacity: 0.85,
  }
}

// Contorno del país (adm0). Se renderea en countryBorderPane (z-index 450)
// para garantizar que quede ARRIBA de cualquier capa simbólica (banderas,
// escudos, vista política) cuyas imágenes se appendean al final del SVG
// del overlayPane y antes tapaban el contorno.
//
// Weight ~2px porque la línea original de 0.5px era casi invisible y el
// toggle "Borde país" no parecía hacer nada. Se ajusta con lineWidth para
// que herede el grosor general del style.
function countryBorderStyle(style: MapStyle): PathOptions {
  return {
    fillOpacity: 0,
    color: style.borderColor,
    weight: Math.max(1.5, style.lineWidth * 2.5),
    opacity: 1,
  }
}

function hoverStyle(style: MapStyle): PathOptions {
  // Sólo resalta el borde — NO toca fillOpacity para no pisar el slider del user
  return {
    weight: Math.max(style.lineWidth * 3, 1.8),
    color: '#0f172a',
  }
}

export function MapView() {
  // MapView solo se monta en view='venezuela'. La vista Global usa
  // WorldMapView (d3-geo) y es un componente totalmente distinto.
  const level = useStore(s => s.level)
  const adm0 = useStore(s => s.adm0)
  const adm1 = useStore(s => s.adm1)
  const adm2 = useStore(s => s.adm2)
  const palette = useStore(s => s.palette)
  const setSelected = useStore(s => s.setSelected)
  const source = useStore(s => s.source)
  const mapStyle = useStore(s => s.mapStyle)
  const thematic = useStore(s => s.thematic)
  const activeIndicator = source?.kind === 'indicator' ? source.indicator : null

  // Geojson dedicado del basemap "Contornos" (Natural Earth 1:50m simplificado,
  // ~1.27MB). NO reusa el geojson de la vista Global (110m con properties para
  // matchear migrantes_ve) — son archivos distintos con propósitos distintos:
  // el de Global necesita las properties; el basemap solo necesita geometrías.
  const [worldOutlinesGeo, setWorldOutlinesGeo] = useState<object | null>(null)

  const [zoom, setZoom] = useState<number | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  const activeThematic = Object.values(thematic).filter(t => t.enabled && t.data)
  // Cuando el basemap es "solid", usa el mismo bgColor del style (el color picker "Fondo").
  // Cuando es "transparent", transparente. Si no, el bgColor solo se ve si el basemap real falla.
  const isSolidBasemap = mapStyle.basemap === 'solid'
  const isWorldOutlines = mapStyle.basemap === 'world-outlines'
  // El basemap "Contornos" override el bgColor con el gris-azul suave del
  // océano (estilo Mapbox basic / Google Maps default). La tierra va en
  // blanco casi puro con bordes rojos sutiles, replicando el patrón clásico
  // de mapas administrativos.
  const effectiveBg = mapStyle.transparentBg
    ? 'transparent'
    : isWorldOutlines
      ? '#e3e8eb'
      : mapStyle.bgColor
  // Esconde tiles si "isolate", basemap solid o world-outlines (no hay tiles que cargar
  // para esos tres — solid usa bgColor, world-outlines pinta el geojson como capa)
  const hideBasemap = mapStyle.isolateCountry || isSolidBasemap || isWorldOutlines

  // Carga lazy del geojson 50m la primera vez que el user elige el basemap
  // de contornos. Cancelable: si el user navega a otra cosa antes de que
  // termine el fetch, no seteamos state stale.
  useEffect(() => {
    if (!isWorldOutlines || worldOutlinesGeo) return
    let cancelled = false
    const base = import.meta.env.BASE_URL
    fetch(`${base}data/world-outlines-50m.geojson`)
      .then(r => r.json())
      .then(geo => {
        if (!cancelled) setWorldOutlinesGeo(geo)
      })
      .catch(err => console.error('Error cargando basemap Contornos:', err))
    return () => {
      cancelled = true
    }
  }, [isWorldOutlines, worldOutlinesGeo])

  const data = (level === 'adm0' ? adm0 : level === 'adm1' ? adm1 : adm2) as AdmGeoJSON<
    Adm0Props | Adm1Props | Adm2Props
  > | null

  // Sólo incluimos cosas que afectan la *forma* de los datos (qué features
  // hay, qué colores tiene cada uno por el indicador). Los cambios de estilo
  // (border, opacities, width) se aplican imperativamente abajo vía setStyle,
  // así NO desmontamos cientos de polígonos en cada tick del color picker.
  const layerKey = useMemo(() => {
    if (!data) return 'empty'
    const sourceKey =
      source?.kind === 'indicator'
        ? `i:${source.indicator.id}`
        : source?.kind === 'upload'
          ? `u:${source.dataset.filename}:${source.dataset.valueColumn ?? ''}:${source.dataset.geoColumn ?? ''}`
          : 'none'
    return [level, palette, sourceKey, data.features.length].join('-')
  }, [data, level, palette, source])

  const overlayKey = useMemo(() => {
    if (!adm1) return 'no-overlay'
    return `overlay-${level}`
  }, [adm1, level])

  const layerRef = useRef<L.GeoJSON | null>(null)
  const overlayRef = useRef<L.GeoJSON | null>(null)
  const countryBorderRef = useRef<L.GeoJSON | null>(null)
  // Layer L.GeoJSON temporal que dibuja sólo el outline del polígono hoverado
  // en el hoverPane (z-index 500). Se crea on-mouseover y se destruye on-mouseout.
  // Garantiza visibilidad del contorno aunque haya banderas, escudos, stateOverlay
  // o countryBorder tapando los bordes del path original.
  const hoverOutlineRef = useRef<L.GeoJSON | null>(null)
  // Outline persistente del polígono seleccionado al click. Vive en el mismo
  // hoverPane (z-index 500) — reemplaza al rectángulo focus default del browser,
  // que es el bbox del <path> SVG (no la forma del polígono) y queda enterrado
  // por los vecinos. Se actualiza en cada click; cleanup al cambiar layerKey.
  const selectedOutlineRef = useRef<L.GeoJSON | null>(null)
  // Marcador para distinguir "primera vez que veo esta layer" vs "data cambió
  // dentro de la misma layer". react-leaflet sólo aplica data en mount.
  const lastLayerRef = useRef<L.GeoJSON | null>(null)

  // Helper: remueve un layer del map de forma defensiva. Si el map está en
  // proceso de destruirse (ej. al cambiar de vista VE↔Global), removeLayer
  // puede tirar "Cannot read properties of undefined (reading '_removePath')"
  // porque el renderer del pane ya fue limpiado. Silenciamos esos casos.
  function safeRemoveLayer(map: L.Map | null, layer: L.Layer | null) {
    if (!map || !layer) return
    try {
      map.removeLayer(layer)
    } catch {
      // map ya destruyéndose o layer huérfano; no es accionable.
    }
  }

  // Limpia los outlines (hover y selected) cuando cambia el nivel o el data
  // layer se remontea. Sin esto, un mouseover o click seguido de cambio de
  // nivel deja contornos fantasma en el hoverPane.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    safeRemoveLayer(map, hoverOutlineRef.current)
    hoverOutlineRef.current = null
    safeRemoveLayer(map, selectedOutlineRef.current)
    selectedOutlineRef.current = null
  }, [layerKey])

  // Cleanup al desmontar MapView (ej. user cambia a vista Global). Sin esto,
  // los outlines quedan huérfanos referenciando el map viejo y al volver a
  // Venezuela puede haber leaks o errores.
  useEffect(() => {
    return () => {
      const map = mapRef.current
      safeRemoveLayer(map, hoverOutlineRef.current)
      hoverOutlineRef.current = null
      safeRemoveLayer(map, selectedOutlineRef.current)
      selectedOutlineRef.current = null
    }
  }, [])

  // Cuando data cambia SIN que la key haga remount (cambia palette custom,
  // colores start/end del custom, customRange), react-leaflet no propaga el
  // nuevo data al Leaflet layer — los _color recién calculados nunca se ven.
  // Fix: re-sincronizamos imperativamente con clearLayers + addData.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !data) return
    if (lastLayerRef.current !== layer) {
      // Layer recién montada o remontada via key: react-leaflet ya construyó
      // la layer con el data correcto. No tocar.
      lastLayerRef.current = layer
      return
    }
    layer.clearLayers()
    layer.addData(data as never)
  }, [data])

  // Re-aplicar estilos imperativamente cuando cambia mapStyle. Esto evita
  // remount completo del GeoJSON en cada tick del color picker, que era lo
  // que hacía "romper" visualmente al cambiar el color de borde.
  // Importante: actualizamos también options.style para que el resetStyle()
  // que dispara el hover-out vuelva al estilo nuevo, no al de cuando se montó.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const styleFn = fillStyleFor(mapStyle, level)
    layer.options.style = styleFn
    layer.setStyle(styleFn)
  }, [mapStyle, level])

  useEffect(() => {
    const layer = overlayRef.current
    if (!layer) return
    const styleObj = stateOverlayStyle(mapStyle)
    layer.options.style = styleObj
    layer.setStyle(styleObj)
  }, [mapStyle])

  useEffect(() => {
    const layer = countryBorderRef.current
    if (!layer) return
    const styleObj = countryBorderStyle(mapStyle)
    layer.options.style = styleObj
    layer.setStyle(styleObj)
  }, [mapStyle])

  const showOverlay = level === 'adm2' && mapStyle.stateOverlayInMuni && adm1
  const showCountryBorder = mapStyle.countryBorder && adm0

  return (
    <div className="relative h-full w-full" style={{ background: effectiveBg }}>
      <MapContainer
        center={[7, -66]}
        zoom={5}
        minZoom={4}
        maxZoom={12}
        zoomSnap={0.1}
        zoomDelta={0.5}
        wheelDebounceTime={40}
        wheelPxPerZoomLevel={120}
        className="h-full w-full"
        style={{ background: effectiveBg }}
      >
        {/* MapBootstrap PRIMERO en el orden de children: su useEffect crea
            los panes custom (worldOutlinesPane, hoverPane). React ejecuta los
            useEffect de siblings en el orden en que aparecen en el JSX, así
            que cualquier layer que use esos panes (ej. world-outlines basemap
            abajo) debe ir DESPUÉS. Si los panes no existieran al montarse la
            layer, el renderer SVG fallaría al hacer getPane() y al desmontar
            tiraría "Cannot read properties of undefined (reading '_removePath')". */}
        <MapBootstrap bgColor={effectiveBg} bounds={VENEZUELA_BOUNDS} />
        <ZoomBridge onChange={setZoom} mapRef={mapRef} />
        {!hideBasemap && (() => {
          const bm = getBasemap(mapStyle.basemap)
          return (
            <TileLayer
              key={bm.id}
              attribution={bm.attribution}
              url={bm.url}
              maxZoom={bm.maxZoom}
            />
          )
        })()}
        {/* Basemap "Contornos países": en vez de un TileLayer, montamos un
            GeoJSON con los polígonos de Natural Earth en un pane custom
            debajo del overlayPane. Mapa casi blanco con divisiones grises
            de países, sin nombres ni relieve. */}
        {isWorldOutlines && !mapStyle.isolateCountry && worldOutlinesGeo && (
          <GeoJSON
            key="world-outlines-basemap"
            data={worldOutlinesGeo as never}
            pane="worldOutlinesPane"
            interactive={false}
            style={() => ({
              // Estilo Mapbox basic / Google Maps default:
              //   - tierra: #fafaf9 (blanco casi puro, ligero warm)
              //   - bordes país: #c89898 (rojo apagado, no gris)
              //   - océano (bg): #e3e8eb (gris-azul suave)
              // Es el patrón clásico de los mapas administrativos: tierra
              // limpia, agua suave, fronteras destacadas en color cálido
              // para separarlas de cualquier borde de polígono interno.
              fillColor: '#fafaf9',
              color: '#c89898',
              weight: 0.7,
              fillOpacity: 1,
              opacity: 1,
            })}
          />
        )}
        {/* Overlay de etiquetas: tile solo-labels de Carto encima del basemap.
            Permite usar el basemap limpio (sin nombres) y prender los nombres
            independiente. Pane "tooltipPane" para que quede sobre los
            polígonos pero debajo de los markers/tooltips temáticos. */}
        {mapStyle.showLabels && !mapStyle.isolateCountry && (
          <TileLayer
            key="labels-overlay"
            url={CARTO_LABELS_OVERLAY_URL}
            attribution=""
            maxZoom={19}
            pane="tooltipPane"
            opacity={0.9}
          />
        )}
        {data && (
          <GeoJSON
            key={layerKey}
            ref={layerRef}
            data={data as never}
            style={fillStyleFor(mapStyle, level)}
            onEachFeature={(feature, layer: Layer) => {
              const props = feature.properties as Adm1Props | Adm2Props
              const name = (props as Adm1Props).name
              const value = props._value
              const subtitle =
                level === 'adm1'
                  ? (props as Adm1Props).iso
                  : `${(props as Adm2Props).parentState ?? ''}`
              const valueLine = (() => {
                if (value == null) return '<div style="color:#94a3b8;font-size:11px">sin dato</div>'
                const formatted = activeIndicator
                  ? formatIndicatorValue(value, activeIndicator)
                  : value.toLocaleString('es-VE')
                const unit = activeIndicator ? ` <span style="color:#94a3b8">${activeIndicator.unit}</span>` : ''
                return `<div style="font-weight:600">${formatted}${unit}</div>`
              })()
              layer.bindTooltip(
                `<div style="font-size:13px"><div style="font-weight:600">${name}</div><div style="color:#64748b;font-size:11px">${subtitle}</div>${valueLine}</div>`,
                { sticky: true, direction: 'auto' },
              )
              layer.on({
                mouseover: e => {
                  const target = e.target as L.Path
                  target.setStyle(hoverStyle(mapStyle))
                  // Outline duplicado en hoverPane (z-index 500) para que se vea
                  // por encima de cualquier capa: banderas/escudos (que tapan el
                  // path original), stateOverlay (que tapa bordes compartidos en
                  // modo munis) y countryBorder. El path real sigue capturando
                  // mouseout abajo; este es puramente visual.
                  const map = mapRef.current
                  if (!map) return
                  if (hoverOutlineRef.current) {
                    map.removeLayer(hoverOutlineRef.current)
                    hoverOutlineRef.current = null
                  }
                  hoverOutlineRef.current = L.geoJSON(feature as never, {
                    pane: 'hoverPane',
                    interactive: false,
                    style: {
                      color: '#0f172a',
                      weight: Math.max(mapStyle.lineWidth * 3, 1.8),
                      opacity: 1,
                      fillOpacity: 0,
                      fill: false,
                    },
                  }).addTo(map)
                },
                mouseout: e => {
                  layerRef.current?.resetStyle(e.target as L.Path)
                  const map = mapRef.current
                  if (map && hoverOutlineRef.current) {
                    map.removeLayer(hoverOutlineRef.current)
                    hoverOutlineRef.current = null
                  }
                },
                click: () => {
                  setSelected({
                    name,
                    nombreOficial: props.nombreOficial ?? null,
                    parentState: (props as Adm2Props).parentState ?? null,
                    iso: (props as Adm1Props).iso ?? (props as Adm2Props).parentISO,
                    value,
                  })
                  // Outline persistente en hoverPane: sigue la forma real del
                  // polígono y queda siempre arriba (encima de banderas,
                  // overlays y vecinos). Reemplaza el rectángulo focus default
                  // del browser que vivía a nivel <path> SVG.
                  const map = mapRef.current
                  if (!map) return
                  if (selectedOutlineRef.current) {
                    map.removeLayer(selectedOutlineRef.current)
                    selectedOutlineRef.current = null
                  }
                  selectedOutlineRef.current = L.geoJSON(feature as never, {
                    pane: 'hoverPane',
                    interactive: false,
                    style: {
                      color: '#0f172a',
                      weight: Math.max(mapStyle.lineWidth * 3, 1.8),
                      opacity: 1,
                      fillOpacity: 0,
                      fill: false,
                    },
                  }).addTo(map)
                },
              })
            }}
          />
        )}
        {/* Indicadores simbólicos: bandera o escudo de cada entidad
            recortado al polígono geográfico exacto. Se monta el componente
            correcto según el indicador activo + nivel. Para indicadores de
            estados aplicamos en adm1; para munis en adm2. */}
        {source?.kind === 'indicator' && (() => {
          const sid = source.indicator.id
          if (sid === 'banderas_pais' && level === 'adm0' && adm0) {
            return <SymbolClippedLayer kind="flag" level="country" geo={adm0} opacity={mapStyle.fillOpacity} />
          }
          if (sid === 'escudos_pais' && level === 'adm0' && adm0) {
            return <SymbolClippedLayer kind="shield" level="country" geo={adm0} opacity={mapStyle.fillOpacity} />
          }
          if (sid === 'banderas_estados' && level === 'adm1' && adm1) {
            return <SymbolClippedLayer kind="flag" level="state" geo={adm1} opacity={mapStyle.fillOpacity} />
          }
          if (sid === 'escudos_estados' && level === 'adm1' && adm1) {
            return <SymbolClippedLayer kind="shield" level="state" geo={adm1} opacity={mapStyle.fillOpacity} />
          }
          if (sid === 'banderas_munis' && level === 'adm2' && adm2) {
            return <SymbolClippedLayer kind="flag" level="muni" geo={adm2} opacity={mapStyle.fillOpacity} />
          }
          if (sid === 'escudos_munis' && level === 'adm2' && adm2) {
            return <SymbolClippedLayer kind="shield" level="muni" geo={adm2} opacity={mapStyle.fillOpacity} />
          }
          return null
        })()}
        {activeThematic.map(t => (
          <GeoJSON
            key={`thematic-${t.meta.id}`}
            data={t.data as never}
            style={() => thematicStyleFor(t.meta)}
            pointToLayer={(feature, latlng) => {
              const m = L.circleMarker(latlng, {
                radius: 3,
                fillColor: t.meta.color,
                color: t.meta.color,
                fillOpacity: 0.85,
                weight: 1,
              })
              const props = feature.properties as Record<string, string | undefined>
              const labelKey = t.meta.labelKey
              const label = labelKey
                ? props[labelKey]
                : props.nombre_cen ?? props.nombre ?? Object.values(props)[0]
              if (label) {
                // permanentLabels=true → tooltip siempre visible al lado del
                // punto (capitales de estado). Sin permanent, solo en hover.
                if (t.meta.permanentLabels) {
                  m.bindTooltip(String(label), {
                    permanent: true,
                    direction: 'right',
                    offset: [6, 0],
                    className: 'thematic-label-permanent',
                  })
                } else {
                  m.bindTooltip(String(label), { sticky: true, direction: 'top' })
                }
              }
              return m
            }}
            onEachFeature={(feature, layer: Layer) => {
              if (feature.geometry?.type === 'Point' || feature.geometry?.type === 'MultiPoint') return
              const props = feature.properties as Record<string, string | undefined>
              const label = props.nombre ?? props.Nombre ?? props.nombre_cen ?? props.tipo ?? '—'
              const sub = props.categoria ?? props.etnias ?? props.cat_UICN ?? props.tipo
              layer.bindTooltip(
                `<div style="font-size:12px"><div style="font-weight:600">${label}</div>${sub ? `<div style="color:#64748b;font-size:10px">${sub}</div>` : ''}</div>`,
                { sticky: true, direction: 'auto' },
              )
            }}
          />
        ))}
        {showOverlay && (
          <GeoJSON
            key={overlayKey}
            ref={overlayRef}
            data={adm1 as never}
            pane="stateOverlayPane"
            style={stateOverlayStyle(mapStyle)}
            interactive={false}
          />
        )}
        {showCountryBorder && (
          <GeoJSON
            key="country-border"
            ref={countryBorderRef}
            data={adm0 as never}
            pane="countryBorderPane"
            style={countryBorderStyle(mapStyle)}
            interactive={false}
          />
        )}
      </MapContainer>

      {/* Badge de zoom: click abre un slider para ajuste fino (step 0.1). */}
      {zoom != null && (
        <ZoomControl
          zoom={zoom}
          minZoom={4}
          maxZoom={12}
          onChange={z => mapRef.current?.setZoom(z)}
        />
      )}
    </div>
  )
}

function ZoomControl({
  zoom,
  minZoom,
  maxZoom,
  onChange,
}: {
  zoom: number
  minZoom: number
  maxZoom: number
  onChange: (z: number) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Click fuera del control cierra el slider.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={rootRef} className="absolute right-3 top-3 z-[500]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-md bg-white/95 px-2 py-1 text-[10px] font-medium uppercase tracking-wider tabular-nums shadow-sm ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
          open
            ? 'text-slate-900 ring-slate-400'
            : 'text-slate-600 ring-slate-200/80 hover:text-slate-900'
        }`}
        aria-expanded={open}
        aria-label="Ajustar zoom"
      >
        Zoom <span className="text-slate-900">{zoom.toFixed(1)}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-48 rounded-md bg-white p-3 shadow-lg ring-1 ring-slate-200"
          onMouseDown={e => e.stopPropagation()}
        >
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            step={0.1}
            value={zoom}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="w-full accent-slate-900"
            aria-label="Nivel de zoom"
          />
          <div className="mt-1 flex items-baseline justify-between text-[10px] tabular-nums text-slate-400">
            <span>{minZoom}</span>
            <span className="font-medium text-slate-700">{zoom.toFixed(1)}</span>
            <span>{maxZoom}</span>
          </div>
        </div>
      )}
    </div>
  )
}

import type { ThematicMeta } from '../store'

function thematicStyleFor(meta: ThematicMeta): PathOptions {
  // Diferentes estilos según tipo de geometría
  if (meta.geometryType === 'LineString' || meta.geometryType === 'MultiLineString') {
    const style: PathOptions = {
      color: meta.color,
      weight: meta.weight ?? 1,
      opacity: 0.85,
      fillOpacity: 0,
    }
    // dashArray Leaflet: '4 6' = trazo de 4px, espacio de 6px. Patrón clásico
    // de líneas punteadas para distinguir fronteras "reclamadas" o "en disputa"
    // de las administrativas de facto.
    if (meta.dashed) style.dashArray = '4 6'
    return style
  }
  return {
    fillColor: meta.color,
    color: meta.color,
    weight: meta.weight ?? 0.8,
    fillOpacity: 0.28,
    opacity: 0.8,
  }
}
