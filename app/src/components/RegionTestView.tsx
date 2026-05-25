// Vista experimental "Test Leaflet" para una región arbitraria. Es la
// contraparte Leaflet de la vista Global (que usa d3-geo + SVG). Misma
// data, distinto motor de render — sirve para comparar:
//   - feel del pan/zoom Leaflet vs gestures custom SVG
//   - tiles del basemap vs SVG limpio
//   - legibilidad de polígonos a escala continental
//
// La región a mostrar sale de `globalRegion` del store (mismo state que
// usa WorldMapView para filtrar). Cambiar la región re-fitea los bounds
// automáticamente sin recargar geojson (filtra el mismo asset).

import { useEffect, useMemo, useRef } from 'react'
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet'
import type { Layer } from 'leaflet'
import L from 'leaflet'
import { useStore } from '../store'
import { getBasemap } from '../lib/basemaps'
import { getRegion, isInRegion } from '../lib/regions'
import type { DiasporaProps } from '../lib/types'

// Bounds máximos del planeta para "world" (sin estirar polos al infinito).
const WORLD_BOUNDS = L.latLngBounds(L.latLng(-60, -180), L.latLng(75, 180))

export function RegionTestView() {
  const diaspora = useStore(s => s.diaspora)
  const loadDiasporaData = useStore(s => s.loadDiasporaData)
  const mapStyle = useStore(s => s.mapStyle)
  const globalRegion = useStore(s => s.globalRegion)
  const paint = useStore(s => s.paint)
  const paintModeActive = useStore(s => s.paintModeActive)
  const paintFeature = useStore(s => s.paintFeature)
  const paintFeatureForce = useStore(s => s.paintFeatureForce)
  const setSelected = useStore(s => s.setSelected)

  useEffect(() => {
    if (!diaspora) loadDiasporaData()
  }, [diaspora, loadDiasporaData])

  const region = getRegion(globalRegion)

  // Subset filtrado al ISO_A3 de la región (igual lógica que WorldMapView).
  const regionGeo = useMemo(() => {
    if (!diaspora) return null
    if (region.isos.length === 0) return diaspora
    return {
      ...diaspora,
      features: diaspora.features.filter(f =>
        isInRegion((f.properties as DiasporaProps).iso_a3, region),
      ),
    }
  }, [diaspora, region])

  // Bounds para el fitBounds de Leaflet. Para "world" usamos un bbox
  // razonable (sin polos extremos); para el resto computamos desde las
  // coordenadas reales de los features filtrados.
  const bounds = useMemo(() => {
    if (region.id === 'world' || !regionGeo) return WORLD_BOUNDS
    return computeBounds(regionGeo.features) ?? WORLD_BOUNDS
  }, [region.id, regionGeo])

  const paintAssignments = paint.assignments.countries
  const isPainting = paintModeActive && paint.activeColor != null
  const isOnPaintTab = paintModeActive

  // Ref para evitar closure stale en el onEachFeature de Leaflet (que se
  // ejecuta una sola vez al montar el layer y captura los valores iniciales).
  const isPaintingRef = useRef(isPainting)
  useEffect(() => {
    isPaintingRef.current = isPainting
  }, [isPainting])

  const basemap = getBasemap(mapStyle.basemap)
  const showTiles =
    !!basemap.url && !mapStyle.isolateCountry && mapStyle.basemap !== 'solid'
  const bgColor = mapStyle.transparentBg ? 'transparent' : mapStyle.bgColor

  if (!diaspora || !regionGeo) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
        Cargando mapa de {region.label}…
      </div>
    )
  }

  return (
    <div className="relative h-full w-full" style={{ background: bgColor }}>
      <MapContainer
        // Key incluye region.id para forzar re-mount al cambiar región,
        // así Leaflet aplica los bounds nuevos (fitBounds NO es reactivo
        // a cambios de prop, sólo al montaje).
        key={`region-test-${region.id}`}
        bounds={bounds}
        zoom={3}
        minZoom={1}
        maxZoom={10}
        worldCopyJump={false}
        className="h-full w-full"
        style={{ background: bgColor }}
      >
        {showTiles && (
          <TileLayer
            url={basemap.url}
            attribution={basemap.attribution}
            maxZoom={basemap.maxZoom}
          />
        )}
        <GeoJSON
          // Re-mount cuando cambia basemap, región, asignaciones del painter,
          // tweaks de estilo que requieren restyle del polígono, o el modo
          // Pintar (que cambia la lógica de bordes — ver style abajo). Sin
          // esto, Leaflet conserva el style viejo del layer porque
          // GeoJSON.style solo se evalúa en mount.
          key={`region-geo-${region.id}-${mapStyle.basemap}-${mapStyle.lineWidth}-${mapStyle.borderColor}-${mapStyle.noBorders}-${isOnPaintTab}-${Object.keys(paintAssignments).length}-${JSON.stringify(paintAssignments)}`}
          data={regionGeo as never}
          style={feature => {
            const iso = (feature?.properties as DiasporaProps | undefined)?.iso_a3
            const paintColor = iso ? paintAssignments[iso] : undefined
            const fillColor =
              paintColor ??
              (isOnPaintTab
                ? '#e5e7eb'
                : (feature?.properties as DiasporaProps | undefined)?._color ?? '#e5e7eb')

            // Decisión: respetamos el state real de los toggles SIEMPRE,
            // incluso en modo Pintar. Antes había un override que forzaba
            // bordes en modo Pintar (para que polígonos pintados del mismo
            // color se distinguieran), pero el user pidió control completo
            // — incluyendo poder pintar "sin bordes" en regional Leaflet.
            // Si dos regiones adyacentes quedan del mismo color sin borde,
            // queda como decisión visual del usuario, no del producto.
            if (mapStyle.noBorders) {
              // Stroke same-color del fill: tapa los slivers que deja
              // Natural Earth 110m entre países (no tiene topología
              // compartida tipo TopoJSON). Weight de 0.6 hardcoded — el
              // slider está disabled cuando noBorders=true; usar lineWidth
              // acá podría dejar weight=0 y reaparecer los gaps.
              return {
                fillColor,
                color: fillColor,
                weight: 0.6,
                fillOpacity: mapStyle.fillOpacity,
                opacity: mapStyle.fillOpacity,
              }
            }
            // Bordes normales — respeta lineWidth/borderColor/borderOpacity.
            // Para grosores muy bajos (< 0.5) usamos same-color con mínimo
            // 0.5 de weight para tapar gaps que serían visibles a esa escala.
            const useFillForStroke = mapStyle.lineWidth < 0.5
            const strokeColor = useFillForStroke ? fillColor : mapStyle.borderColor
            const weight = useFillForStroke
              ? Math.max(mapStyle.lineWidth, 0.5)
              : mapStyle.lineWidth
            return {
              fillColor,
              color: strokeColor,
              weight,
              fillOpacity: mapStyle.fillOpacity,
              opacity: mapStyle.borderOpacity,
            }
          }}
          onEachFeature={(feature, layer: Layer) => {
            const props = feature.properties as DiasporaProps
            layer.bindTooltip(props.name, {
              sticky: true,
              direction: 'auto',
            })
            layer.on('click', () => {
              if (isPaintingRef.current) {
                paintFeature('countries', props.iso_a3)
                return
              }
              setSelected({
                name: props.name,
                iso: props.iso_a3,
                value: typeof props._value === 'number' ? props._value : null,
              })
            })
            // Brush: Ctrl + hover pinta sin toggle.
            layer.on('mouseover', e => {
              const native = (e as unknown as { originalEvent?: MouseEvent }).originalEvent
              if (isPaintingRef.current && native?.ctrlKey) {
                paintFeatureForce('countries', props.iso_a3)
              }
            })
          }}
        />
      </MapContainer>
    </div>
  )
}

// ─── Utils ────────────────────────────────────────────────────────────────

// Computa el bbox de un array de features GeoJSON sin depender de turf.
// Itera todas las coordenadas (incluido MultiPolygon nested) y trackea
// min/max de lng/lat. Devuelve null si el array está vacío.
type Position = [number, number, ...number[]]
function computeBounds(features: Array<{ geometry: { type: string; coordinates: unknown } }>): L.LatLngBounds | null {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const f of features) {
    walkCoords(f.geometry as { type: string; coordinates: unknown }, (lng, lat) => {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    })
  }
  if (!isFinite(minLat) || !isFinite(maxLat)) return null
  return L.latLngBounds(L.latLng(minLat, minLng), L.latLng(maxLat, maxLng))
}

function walkCoords(
  geometry: { type: string; coordinates: unknown },
  cb: (lng: number, lat: number) => void,
): void {
  const c = geometry.coordinates
  if (geometry.type === 'Polygon') {
    for (const ring of c as Position[][]) {
      for (const [lng, lat] of ring) cb(lng, lat)
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of c as Position[][][]) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) cb(lng, lat)
      }
    }
  }
}
