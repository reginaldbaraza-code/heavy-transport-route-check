// @refresh reset
import { useEffect, useRef } from 'react'
import L, { type LayerGroup, type Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Layers3, Minus, Plus, Route, Snowflake, Truck } from 'lucide-react'
import {
  cities, germanyOutline, regionalCities, rivers, roadVectors, stateBoundaries,
} from '../data/germanyMap'
import type { MapAlert } from '../data/routeChecks'

export type HeatmapLayer = {
  id: string
  label: string
  unit: string
}

type HeatPoint = {
  id: number
  lat: number
  lng: number
  intensity: number
  label: string
  value: string
}

type Props = {
  mode?: 'weather' | 'transport' | 'quality'
  compact?: boolean
  layers?: HeatmapLayer[]
  activeLayer?: string
  onLayerChange?: (layer: string) => void
  showRoute?: boolean
  interactivePoints?: boolean
  onPointSelect?: (id: number) => void
  className?: string
  routeCoordinates?: [number, number][]
  routeOrigin?: string
  routeDestination?: string
  routePermitId?: string
  routeCorridor?: string
  routeAlert?: MapAlert | null
  routeMarkers?: MapAlert[]
  routeLegendLabel?: string
  emptyLayerMessage?: string
  routeOverlays?: Array<{
    id: string
    coordinates: [number, number][]
    verdict: 'READY' | 'HOLD' | 'VERIFY'
  }>
}

const defaultLayers: HeatmapLayer[] = [
  { id: 'weather', label: 'Weather risk', unit: 'Risk index' },
  { id: 'traffic', label: 'Traffic', unit: 'Congestion' },
  { id: 'restrictions', label: 'Restrictions', unit: 'Constraints' },
]

const pointsByMode: Record<string, HeatPoint[]> = {
  weather: [
    { id: 5, lat: 48.05, lng: 8.15, intensity: .92, label: 'Black Forest', value: 'Severe ice risk' },
    { id: 9, lat: 50.11, lng: 8.68, intensity: .76, label: 'Frankfurt region', value: 'Heavy rain' },
    { id: 14, lat: 48.14, lng: 11.58, intensity: .58, label: 'Munich', value: 'Moderate snowfall' },
    { id: 10, lat: 50.94, lng: 6.96, intensity: .42, label: 'Cologne', value: 'Low visibility' },
  ],
  transport: [
    { id: 14, lat: 49.79, lng: 9.95, intensity: .88, label: 'A3 near Würzburg', value: 'Roadworks unconfirmed' },
    { id: 3, lat: 50.11, lng: 8.68, intensity: .52, label: 'Frankfurt route area', value: 'Width check passed' },
    { id: 12, lat: 51.22, lng: 6.77, intensity: .34, label: 'Düsseldorf route area', value: 'No active restriction' },
    { id: 13, lat: 48.14, lng: 11.58, intensity: .25, label: 'Munich approach', value: 'Permit window active' },
  ],
  quality: [
    { id: 1, lat: 48.62, lng: 11.55, intensity: .24, label: 'Bavaria', value: '98% coverage' },
    { id: 2, lat: 50.48, lng: 9.10, intensity: .42, label: 'Hesse', value: '91% coverage' },
    { id: 3, lat: 51.35, lng: 7.35, intensity: .72, label: 'North Rhine-Westphalia', value: '78% coverage' },
    { id: 4, lat: 52.52, lng: 13.40, intensity: .31, label: 'Berlin', value: '95% coverage' },
  ],
}

const defaultRoutePoints: [number, number][] = [
  [51.43, 6.76], [50.94, 6.96], [50.11, 8.68], [49.79, 9.95], [49.45, 11.08], [48.14, 11.58],
]

function pointColor(mode: Props['mode'], intensity: number) {
  if (mode === 'quality') return intensity > .65 ? '#e68a00' : intensity > .38 ? '#4cae72' : '#168a55'
  if (mode === 'weather') return intensity > .8 ? '#dc3f52' : intensity > .55 ? '#7c5ce5' : '#3988d8'
  return intensity > .8 ? '#e24b3f' : intensity > .55 ? '#e59b24' : '#2c78c4'
}

export default function MobilityHeatmap({
  mode = 'weather',
  compact = false,
  layers = defaultLayers,
  activeLayer = layers[0]?.id,
  onLayerChange,
  showRoute = false,
  interactivePoints = false,
  onPointSelect,
  className = '',
  routeCoordinates = defaultRoutePoints,
  routeOrigin = 'Duisburg',
  routeDestination = 'Munich',
  routePermitId = 'DE-NW-2026-04821',
  routeCorridor = 'A3 / A9',
  routeAlert,
  routeMarkers,
  routeLegendLabel,
  emptyLayerMessage,
  routeOverlays,
}: Props) {
  const mapNode = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const overlayGroupRef = useRef<LayerGroup | null>(null)
  const routeGroupRef = useRef<LayerGroup | null>(null)
  const selectedLayer = layers.find(layer => layer.id === activeLayer) ?? layers[0]
  const lowColor = mode === 'quality' ? '#168a55' : '#3988d8'
  const highColor = mode === 'quality' ? '#e68a00' : mode === 'weather' ? '#dc3f52' : '#e24b3f'
  const primaryRouteMarker = routeMarkers?.[0] ?? routeAlert

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return

    const map = L.map(mapNode.current, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 5,
      maxZoom: 10,
      dragging: !compact,
      scrollWheelZoom: !compact,
      doubleClickZoom: !compact,
      touchZoom: !compact,
      keyboard: !compact,
      boxZoom: false,
    })
    mapRef.current = map

    const baseGroup = L.layerGroup().addTo(map)
    overlayGroupRef.current = L.layerGroup().addTo(map)
    routeGroupRef.current = L.layerGroup().addTo(map)

    L.polygon(germanyOutline, {
      color: '#315b7d',
      weight: 2,
      fillColor: '#fbfcfd',
      fillOpacity: 1,
      interactive: false,
    }).addTo(baseGroup)

    stateBoundaries.forEach(boundary => {
      L.polyline(boundary, {
        color: '#c5d0d8',
        weight: 1,
        opacity: .9,
        dashArray: '4 4',
        interactive: false,
      }).addTo(baseGroup)
    })

    rivers.forEach(river => {
      L.polyline(river.points, {
        color: '#85bedf',
        weight: 1.5,
        opacity: .9,
        interactive: false,
      }).addTo(baseGroup)
    })

    roadVectors.forEach(road => {
      L.polyline(road.points, {
        color: '#fff',
        weight: 5,
        opacity: .98,
        interactive: false,
      }).addTo(baseGroup)
      L.polyline(road.points, {
        color: road.name === 'A7' || road.name === 'A3' ? '#e4a80d' : '#557f9e',
        weight: 2,
        opacity: .95,
        interactive: false,
      }).addTo(baseGroup)

      if (!showRoute && ['A1', 'A2', 'A3', 'A7', 'A8', 'A9'].includes(road.name)) {
        const labelPoint = road.points[Math.floor(road.points.length / 2)]
        L.marker(labelPoint, {
          interactive: false,
          icon: L.divIcon({
            className: 'local-road-label',
            html: road.name,
            iconSize: [44, 24],
            iconAnchor: [22, 12],
          }),
        }).addTo(baseGroup)
      }
    })

    const overviewCities = new Set(['Hamburg', 'Kassel', 'Duisburg', 'Munich', 'Bremen', 'Hannover', 'Leipzig', 'Nuremberg'])
    const visibleCities = showRoute
      ? routeOverlays?.length ? [...cities, ...regionalCities].filter(([name]) => overviewCities.has(name)) : []
      : compact ? cities : [...cities, ...regionalCities]
    visibleCities.forEach(([name, lat, lng]) => {
      L.circleMarker([lat, lng], {
        radius: 2.5,
        color: '#0a2540',
        weight: 1,
        fillOpacity: 1,
        interactive: false,
      }).addTo(baseGroup)
      L.marker([lat, lng], {
        interactive: false,
        icon: L.divIcon({
          className: 'vector-city-label',
          html: name,
          iconSize: [110, 24],
          iconAnchor: [-5, 12],
        }),
      }).addTo(baseGroup)
    })

    map.fitBounds(germanyOutline, {
      padding: compact ? [10, 10] : [28, 28],
      animate: false,
    })

    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    observer.observe(mapNode.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      overlayGroupRef.current = null
      routeGroupRef.current = null
    }
  }, [compact, routeOverlays, showRoute])

  useEffect(() => {
    const group = overlayGroupRef.current
    if (!group) return
    group.clearLayers()

    const markerPoints = routeMarkers ?? (routeAlert ? [routeAlert] : [])
    const visiblePoints = routeMarkers === undefined && routeAlert === undefined
      ? pointsByMode[mode]
      : markerPoints.map((marker, index) => ({
          id: 100 + index,
          lat: marker.lat,
          lng: marker.lng,
          intensity: marker.severity === 'HOLD' ? .92 : marker.severity === 'VERIFY' ? .7 : .35,
          label: marker.title,
          value: marker.detail,
        }))

    visiblePoints.forEach(point => {
      const color = pointColor(mode, point.intensity)
      L.circle([point.lat, point.lng], {
        radius: 22000 + point.intensity * 26000,
        stroke: false,
        fillColor: color,
        fillOpacity: compact ? .14 : .18,
        interactive: false,
      }).addTo(group)
      L.circle([point.lat, point.lng], {
        radius: 8500 + point.intensity * 5000,
        color,
        weight: 1,
        opacity: .42,
        dashArray: '3 4',
        fillColor: color,
        fillOpacity: .08,
        interactive: false,
      }).addTo(group)
      L.circleMarker([point.lat, point.lng], {
        radius: compact ? 5 : 6,
        color: '#fff',
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
        interactive: interactivePoints,
        keyboard: interactivePoints,
      })
        .bindTooltip(`<strong>${point.label}</strong><br>${point.value}`, { direction: 'top', offset: [0, -6] })
        .on('click', () => onPointSelect?.(point.id))
        .addTo(group)
    })
  }, [compact, interactivePoints, mode, onPointSelect, routeAlert, routeMarkers])

  useEffect(() => {
    const group = routeGroupRef.current
    const map = mapRef.current
    if (!group || !map) return
    group.clearLayers()
    if (!showRoute) {
      map.fitBounds(germanyOutline, {
        padding: compact ? [10, 10] : [28, 28],
        animate: false,
      })
      return
    }

    if (routeOverlays?.length) {
      const allPoints = routeOverlays.flatMap(route => route.coordinates)
      map.fitBounds(L.latLngBounds(allPoints), {
        padding: compact ? [24, 24] : [48, 58],
        animate: false,
        maxZoom: compact ? 6 : 7,
      })
      const colors = { READY: '#067647', HOLD: '#b42318', VERIFY: '#93370d' }
      routeOverlays.forEach(route => {
        L.polyline(route.coordinates, { color: '#fff', weight: 10, opacity: .95, interactive: false }).addTo(group)
        L.polyline(route.coordinates, { color: colors[route.verdict], weight: 5, opacity: 1, interactive: false }).addTo(group)
        const start = route.coordinates[0]
        const end = route.coordinates[route.coordinates.length - 1]
        ;[start, end].forEach(point => {
          L.circleMarker(point, {
            radius: 5,
            color: '#fff',
            weight: 2,
            fillColor: colors[route.verdict],
            fillOpacity: 1,
            interactive: false,
          }).addTo(group)
        })
      })
      return
    }

    map.fitBounds(L.latLngBounds(routeCoordinates), {
      padding: compact ? [30, 26] : [54, 70],
      animate: false,
      maxZoom: compact ? 6 : 7,
    })

    L.polyline(routeCoordinates, {
      color: '#ffffff',
      weight: 11,
      opacity: 1,
      interactive: false,
    }).addTo(group)
    L.polyline(routeCoordinates, {
      color: '#175cd3',
      weight: 5,
      opacity: 1,
      interactive: false,
    }).addTo(group)
    L.polyline(routeCoordinates, {
      color: '#ffffff',
      weight: 1.5,
      opacity: .9,
      dashArray: '2 10',
      interactive: false,
    }).addTo(group)

    const first = routeCoordinates[0]
    const last = routeCoordinates[routeCoordinates.length - 1]
    ;[
      { point: first, label: routeOrigin, type: 'Start' },
      { point: last, label: routeDestination, type: 'Destination' },
    ].forEach(({ point, label, type }, index) => {
      L.marker(point, {
        interactive: false,
        icon: L.divIcon({
          className: 'permit-endpoint-host',
          html: `<div class="permit-endpoint ${index ? 'destination' : 'origin'}"><i></i><span><small>${type}</small><strong>${label}</strong></span></div>`,
          iconSize: [164, 52],
          iconAnchor: [index ? 150 : 14, 26],
        }),
      }).addTo(group)
    })

    const markers = routeMarkers ?? (routeAlert ? [routeAlert] : [])
    const occupiedAlertLabels: L.Point[] = []
    const markerPlacements = markers.map(marker => {
      const markerPoint = map.latLngToContainerPoint([marker.lat, marker.lng])
      const labelCentered = map.getSize().x < 520
      const labelLeft = !labelCentered && markerPoint.x > map.getSize().x * .52
      const labelCenter = markerPoint.add(labelCentered ? [0, -48] : [labelLeft ? -92 : 92, -22])
      const hideLabel = occupiedAlertLabels.some(occupied =>
        Math.abs(labelCenter.x - occupied.x) < 210
        && Math.abs(labelCenter.y - occupied.y) < 62
      )
      if (!hideLabel) occupiedAlertLabels.push(labelCenter)
      return { marker, markerPoint, labelCenter, hideLabel, labelLeft, labelCentered }
    })
    markerPlacements.forEach(({ marker, hideLabel, labelLeft, labelCentered }) => {
      const alertSymbol = marker.severity === 'READY' ? '✓' : '!'
      L.marker([marker.lat, marker.lng], {
        interactive: false,
        icon: L.divIcon({
          className: 'permit-alert-host',
          html: `<div class="permit-alert-marker ${marker.severity.toLowerCase()} ${hideLabel ? 'label-hidden' : labelCentered ? 'label-centered' : labelLeft ? 'label-left' : ''}"><span>${alertSymbol}</span><p><strong>${marker.title}</strong><small>${marker.detail}</small></p></div>`,
          iconSize: hideLabel ? [32, 32] : labelCentered ? [230, 82] : [230, 60],
          iconAnchor: hideLabel ? [16, 16] : labelCentered ? [115, 76] : [labelLeft ? 217 : 20, 52],
        }),
      }).addTo(group)
    })

    const occupiedLabels = [
      { point: map.latLngToContainerPoint(first).add([70, 0]), radiusX: 98, radiusY: 32 },
      { point: map.latLngToContainerPoint(last).add([-70, 0]), radiusX: 98, radiusY: 32 },
      ...markerPlacements.map(({ markerPoint, labelCenter, hideLabel }) => ({
        point: hideLabel ? markerPoint : labelCenter,
        radiusX: hideLabel ? 20 : 122,
        radiusY: hideLabel ? 20 : 38,
      })),
    ]
    const corridorLabels = routeCorridor.split('/').map(label => label.trim())
    corridorLabels.map((label, index) => {
      const routeIndex = Math.min(
        routeCoordinates.length - 2,
        Math.max(1, Math.round(((index + 1) / (corridorLabels.length + 1)) * (routeCoordinates.length - 1))),
      )
      const point = routeCoordinates[routeIndex]
      const projectedPoint = map.latLngToContainerPoint(point)
      const offsetY = [-26, 26, -44, 44].find(offset => {
        const candidate = projectedPoint.add([0, offset])
        return occupiedLabels.every(occupied =>
          Math.abs(candidate.x - occupied.point.x) > occupied.radiusX + 44
          || Math.abs(candidate.y - occupied.point.y) > occupied.radiusY + 16
        )
      })
      if (offsetY === undefined) return null
      occupiedLabels.push({
        point: projectedPoint.add([0, offsetY]),
        radiusX: 44,
        radiusY: 16,
      })
      return { point, label, offsetY }
    }).forEach(item => {
      if (!item) return
      const { point, label, offsetY } = item
      L.marker(point, {
        interactive: false,
        icon: L.divIcon({
          className: 'permit-road-label-host',
          html: `<span class="permit-road-label">${label}</span>`,
          iconSize: [82, 28],
          iconAnchor: [41, 14 - offsetY],
        }),
      }).addTo(group)
    })
  }, [compact, routeAlert, routeCoordinates, routeCorridor, routeDestination, routeMarkers, routeOrigin, routeOverlays, showRoute])

  return (
    <div className={`heatmap-shell heatmap-${mode} ${compact ? 'heatmap-compact' : ''} ${className}`}>
      {!compact && (
        <div className="heatmap-toolbar">
          <div className="heatmap-layer-list" role="group" aria-label="Map layers">
            <Layers3 size={14} aria-hidden="true" />
            {layers.map(layer => (
              <button
                key={layer.id}
                type="button"
                className={`heatmap-layer ${activeLayer === layer.id ? 'is-active' : ''}`}
                onClick={() => onLayerChange?.(layer.id)}
                aria-pressed={activeLayer === layer.id}
              >
                {layer.label}
              </button>
            ))}
          </div>
          <span className="heatmap-live"><span /> Updated 2 min ago</span>
        </div>
      )}
      {!compact && showRoute && emptyLayerMessage && (
        <div className="map-layer-empty-inline" role="status">
          <Layers3 size={16} />
          <span><strong>{emptyLayerMessage}</strong> The route is still being monitored.</span>
          <button type="button" onClick={() => onLayerChange?.(layers[0]?.id)}>Show roadworks</button>
        </div>
      )}

      <div className="heatmap-canvas" role="group" aria-label={`${selectedLayer?.label ?? 'Mobility'} coverage across Germany`}>
        <div ref={mapNode} className="shared-leaflet-map" />

        {compact && !routeOverlays?.length && (
          <div className="heatmap-map-caption">
            <strong>{showRoute ? `${routeOrigin} → ${routeDestination}` : 'Germany'}</strong>
            <span>{showRoute ? `Approved route · ${routeCorridor}` : 'Local MDS vector map'}</span>
          </div>
        )}

        {!compact && (
          <>
            <div className="heatmap-zoom" aria-label="Map zoom controls">
              <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={14} /></button>
              <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={14} /></button>
            </div>
            {!showRoute && (
              <div className="heatmap-status">
                {mode === 'weather' ? <Snowflake size={13} /> : mode === 'transport' ? <Truck size={13} /> : <Route size={13} />}
                <div>
                  <strong>{mode === 'quality' ? '4 monitored regions' : mode === 'transport' ? '1 route alert' : '2 route alerts'}</strong>
                  <span>{mode === 'quality' ? '1 coverage gap detected' : mode === 'transport' ? 'Exact approved route' : 'Forecast reliability 92%'}</span>
                </div>
                {mode !== 'quality' && <AlertTriangle size={13} className="heatmap-warning" />}
              </div>
            )}
          </>
        )}

        {showRoute && <div className="permit-map-badge"><Route size={16} /><span><strong>{routePermitId}</strong><small>{routeOverlays?.length ? routeCorridor : `Approved route · ${routeCorridor}`}</small></span></div>}
        {showRoute && routeOverlays?.length ? (
          <div className="permit-map-legend overview-route-legend">
            <span><i className="alert-key ready" /> Ready</span>
            <span><i className="alert-key verify" /> Verify</span>
            <span><i className="alert-key hold" /> Hold</span>
          </div>
        ) : showRoute ? (
          <div className="permit-map-legend">
            <span><i className="route-line-key" /> Permitted route</span>
            <span><i className={`alert-key ${primaryRouteMarker?.severity.toLowerCase() ?? 'ready'}`} /> {routeLegendLabel ?? (primaryRouteMarker ? primaryRouteMarker.severity === 'VERIFY' ? 'Verification required' : primaryRouteMarker.severity === 'HOLD' ? 'Blocking issue' : 'Checked evidence' : 'No items on layer')}</span>
          </div>
        ) : (
          <div className="heatmap-legend">
            <span>{mode === 'quality' ? 'Healthy' : 'Low'}</span>
            <i style={{ background: `linear-gradient(90deg, ${lowColor}, ${mode === 'weather' ? '#7c5ce5' : '#e59b24'}, ${highColor})` }} />
            <span>{mode === 'quality' ? 'Gap' : 'Severe'}</span>
            {!compact && <b>{selectedLayer?.unit}</b>}
          </div>
        )}
      </div>
    </div>
  )
}
