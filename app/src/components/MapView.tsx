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
function strokeWeightForOpacity(opacity: number): number {
  if (opacity >= 0.9) return 1.7
  if (opacity <= 0.3) return 0.5
  const t = (opacity - 0.3) / (0.9 - 0.3)
  return 0.5 + t * (1.7 - 0.5)
}

function fillStyleFor(style: MapStyle): (feature?: Feature) => PathOptions {
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

// Contorno del país (adm0) — grosor fijo 0.5, color del borderColor del style.
// Va por encima de los polígonos para que se vea siempre el contorno completo.
function countryBorderStyle(style: MapStyle): PathOptions {
  return {
    fillOpacity: 0,
    color: style.borderColor,
    weight: 0.5,
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

  const [zoom, setZoom] = useState<number | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  const activeThematic = Object.values(thematic).filter(t => t.enabled && t.data)
  // Cuando el basemap es "solid", usa el mismo bgColor del style (el color picker "Fondo").
  // Cuando es "transparent", transparente. Si no, el bgColor solo se ve si el basemap real falla.
  const isSolidBasemap = mapStyle.basemap === 'solid'
  const effectiveBg = mapStyle.transparentBg ? 'transparent' : mapStyle.bgColor
  // Esconde tiles si "isolate" o si el basemap es solid (no hay tiles que cargar)
  const hideBasemap = mapStyle.isolateCountry || isSolidBasemap

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
  // Marcador para distinguir "primera vez que veo esta layer" vs "data cambió
  // dentro de la misma layer". react-leaflet sólo aplica data en mount.
  const lastLayerRef = useRef<L.GeoJSON | null>(null)

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
    const styleFn = fillStyleFor(mapStyle)
    layer.options.style = styleFn
    layer.setStyle(styleFn)
  }, [mapStyle])

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
        <MapBootstrap bgColor={effectiveBg} bounds={VENEZUELA_BOUNDS} />
        <ZoomBridge onChange={setZoom} mapRef={mapRef} />
        {data && (
          <GeoJSON
            key={layerKey}
            ref={layerRef}
            data={data as never}
            style={fillStyleFor(mapStyle)}
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
                mouseover: e => (e.target as L.Path).setStyle(hoverStyle(mapStyle)),
                mouseout: e => layerRef.current?.resetStyle(e.target as L.Path),
                click: () => {
                  setSelected({
                    name,
                    nombreOficial: props.nombreOficial ?? null,
                    parentState: (props as Adm2Props).parentState ?? null,
                    iso: (props as Adm1Props).iso ?? (props as Adm2Props).parentISO,
                    value,
                  })
                },
              })
            }}
          />
        )}
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
            style={stateOverlayStyle(mapStyle)}
            interactive={false}
          />
        )}
        {showCountryBorder && (
          <GeoJSON
            key="country-border"
            ref={countryBorderRef}
            data={adm0 as never}
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
    return { color: meta.color, weight: 1, opacity: 0.7, fillOpacity: 0 }
  }
  return {
    fillColor: meta.color,
    color: meta.color,
    weight: 0.8,
    fillOpacity: 0.28,
    opacity: 0.8,
  }
}
