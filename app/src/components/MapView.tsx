import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import type { Layer, PathOptions } from 'leaflet'
import L from 'leaflet'
import type { Feature } from 'geojson'
import { useStore } from '../store'
import type { MapStyle } from '../store'
import type { Adm0Props, Adm1Props, Adm2Props, AdmGeoJSON } from '../lib/types'
import { formatIndicatorValue } from '../data/indicators'
import { getBasemap } from '../lib/basemaps'

const VENEZUELA_BOUNDS = L.latLngBounds(L.latLng(0.5, -73.5), L.latLng(13.0, -58.0))

function MapBootstrap({ bgColor }: { bgColor: string }) {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    let fitted = false
    const handleResize = () => {
      map.invalidateSize()
      if (!fitted && container.clientWidth > 50 && container.clientHeight > 50) {
        map.fitBounds(VENEZUELA_BOUNDS, { padding: [16, 16] })
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
  }, [map])

  // react-leaflet no actualiza el style del container en re-renders, así que
  // sincronizamos el background imperativamente cuando cambia desde el sidebar.
  useEffect(() => {
    map.getContainer().style.background = bgColor
  }, [map, bgColor])

  return null
}

function fillStyleFor(style: MapStyle): (feature?: Feature) => PathOptions {
  return feature => {
    const props = feature?.properties as Adm1Props | Adm2Props | undefined
    const fillColor = props?._color ?? '#e5e7eb'
    return {
      fillColor,
      color: style.borderColor,
      weight: style.lineWidth,
      fillOpacity: (props?._matched ? style.fillOpacity : Math.min(style.fillOpacity * 0.6, 0.5)),
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

function hoverStyle(style: MapStyle): PathOptions {
  return {
    weight: Math.max(style.lineWidth * 3, 1.8),
    color: '#0f172a',
    fillOpacity: 0.92,
  }
}

export function MapView() {
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

  const activeThematic = Object.values(thematic).filter(t => t.enabled && t.data)

  const data = (level === 'adm0' ? adm0 : level === 'adm1' ? adm1 : adm2) as AdmGeoJSON<Adm0Props | Adm1Props | Adm2Props> | null

  const layerKey = useMemo(() => {
    if (!data) return 'empty'
    const sourceKey =
      source?.kind === 'indicator'
        ? `i:${source.indicator.id}`
        : source?.kind === 'upload'
          ? `u:${source.dataset.filename}:${source.dataset.valueColumn ?? ''}:${source.dataset.geoColumn ?? ''}`
          : 'none'
    return `${level}-${palette}-${sourceKey}-${data.features.length}-${mapStyle.lineWidth}-${mapStyle.borderColor}`
  }, [data, level, palette, source, mapStyle.lineWidth, mapStyle.borderColor])

  const overlayKey = useMemo(() => {
    if (!adm1) return 'no-overlay'
    return `overlay-${mapStyle.lineWidth}-${mapStyle.borderColor}-${level}`
  }, [adm1, mapStyle.lineWidth, mapStyle.borderColor, level])

  const layerRef = useRef<L.GeoJSON | null>(null)

  const showOverlay = level === 'adm2' && mapStyle.stateOverlayInMuni && adm1

  return (
    <div className="relative h-full w-full" style={{ background: mapStyle.bgColor }}>
      <MapContainer
        center={[7, -66]}
        zoom={5}
        minZoom={4}
        maxZoom={12}
        className="h-full w-full"
        style={{ background: mapStyle.bgColor }}
      >
        {!mapStyle.isolateCountry && (() => {
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
        <MapBootstrap bgColor={mapStyle.bgColor} />
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
              const label = props.nombre_cen ?? props.nombre ?? Object.values(props)[0]
              if (label) m.bindTooltip(String(label), { sticky: true, direction: 'top' })
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
            data={adm1 as never}
            style={stateOverlayStyle(mapStyle)}
            interactive={false}
          />
        )}
      </MapContainer>
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
