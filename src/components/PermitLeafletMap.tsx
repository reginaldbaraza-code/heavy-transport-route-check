import { useEffect, useRef } from 'react'
import L, { type LayerGroup, type Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Route } from 'lucide-react'
import { ROUTE_FIT_MAX_ZOOM, ROUTE_FIT_PADDING_PX } from '../lib/mapBounds'
import { downsampleTrack, escapeHtml, loadGpxTrack, type LatLng } from '../lib/gpxTrack'
import { VERDICT_TRACK_COLORS, overviewVerdictForPermit, type OverviewVerdict } from '../lib/overviewTracks'
import type { TestPermit } from '../lib/routeCheck'

export type PermitLeafletMapProps = {
  permits: TestPermit[]
  badgeTitle: string
  badgeSubtitle: string
  endpointMode: 'cities' | 'start-dest'
  showLegend: boolean
  selectedPermitId?: string
}

type DrawnTrack = {
  permit: TestPermit
  verdict: OverviewVerdict
  coordinates: LatLng[]
}

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function endpointIcon(label: string, kind: 'origin' | 'destination', mode: 'cities' | 'start-dest', flip = false) {
  const placeLeft = kind === 'destination' ? !flip : flip
  if (mode === 'cities') {
    return L.divIcon({
      className: 'permit-endpoint-host',
      html: `<div class="permit-city-label${placeLeft ? ' is-left' : ''}">${escapeHtml(label)}</div>`,
      iconSize: [120, 28],
      iconAnchor: placeLeft ? [124, 14] : [-8, 14],
    })
  }
  const prefix = kind === 'origin' ? 'START' : 'DESTINATION'
  return L.divIcon({
    className: 'permit-endpoint-host',
    html: `<div class="permit-endpoint ${kind} ${placeLeft ? 'label-left' : 'label-right'}"><i></i><span><small>${prefix}</small><strong>${escapeHtml(label)}</strong></span></div>`,
    iconSize: [176, 52],
    iconAnchor: placeLeft ? [162, 26] : [14, 26],
  })
}

export default function PermitLeafletMap({
  permits,
  badgeTitle,
  badgeSubtitle,
  endpointMode,
  showLegend,
  selectedPermitId,
}: PermitLeafletMapProps) {
  const mapNode = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const trackGroupRef = useRef<LayerGroup | null>(null)
  const permitsRef = useRef(permits)
  permitsRef.current = permits
  const permitsKey = permits.map(permit => permit.id).join(',')

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return

    const map = L.map(mapNode.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 16,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      touchZoom: true,
      keyboard: true,
      boxZoom: false,
    })
    map.attributionControl?.setPrefix(false)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer(OSM_TILES, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map)

    map.setView([51.16, 10.45], 6)
    map.on('click', () => {
      map.scrollWheelZoom.enable()
    })
    const disableWheel = () => map.scrollWheelZoom.disable()
    map.getContainer().addEventListener('mouseleave', disableWheel)

    mapRef.current = map
    trackGroupRef.current = L.layerGroup().addTo(map)

    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    observer.observe(mapNode.current)

    return () => {
      map.getContainer().removeEventListener('mouseleave', disableWheel)
      observer.disconnect()
      map.remove()
      mapRef.current = null
      trackGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !trackGroupRef.current) return
    let cancelled = false

    async function drawTracks() {
      const loaded: DrawnTrack[] = []
      for (const permit of permitsRef.current) {
        try {
          const coordinates = downsampleTrack(await loadGpxTrack(permit.gpxFile), 240)
          if (coordinates.length < 2) continue
          loaded.push({
            permit,
            verdict: overviewVerdictForPermit(permit),
            coordinates,
          })
        } catch {
          // Keep other tracks if one GPX fails to load.
        }
      }
      const liveMap = mapRef.current
      const liveGroup = trackGroupRef.current
      if (cancelled || !liveMap || !liveGroup) return

      liveGroup.clearLayers()
      const allPoints = loaded.flatMap(track => track.coordinates)
      if (allPoints.length < 2) return

      loaded.forEach(track => {
        const color = VERDICT_TRACK_COLORS[track.verdict]
        L.polyline(track.coordinates, { color: '#fff', weight: 8, opacity: 0.95, interactive: false }).addTo(liveGroup)
        L.polyline(track.coordinates, { color, weight: 4, opacity: 1, interactive: false }).addTo(liveGroup)
        const start = track.coordinates[0]
        const end = track.coordinates[track.coordinates.length - 1]
        ;[start, end].forEach(point => {
          L.circleMarker(point, {
            radius: 6,
            color: '#fff',
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
            interactive: false,
          }).addTo(liveGroup)
        })
      })

      liveMap.invalidateSize({ animate: false })
      const pad = ROUTE_FIT_PADDING_PX
      liveMap.fitBounds(L.latLngBounds(allPoints), {
        padding: [pad, pad],
        maxZoom: ROUTE_FIT_MAX_ZOOM,
        animate: false,
      })

      loaded.forEach(track => {
        const start = track.coordinates[0]
        const end = track.coordinates[track.coordinates.length - 1]
        const width = liveMap.getSize().x
        const startFlip = liveMap.latLngToContainerPoint(start).x > width * 0.62
        const endFlip = liveMap.latLngToContainerPoint(end).x < width * 0.38
        L.marker(start, {
          interactive: false,
          icon: endpointIcon(
            endpointMode === 'start-dest' ? track.permit.origin : track.permit.originShort,
            'origin',
            endpointMode,
            startFlip,
          ),
        }).addTo(liveGroup)
        L.marker(end, {
          interactive: false,
          icon: endpointIcon(
            endpointMode === 'start-dest' ? track.permit.destination : track.permit.destinationShort,
            'destination',
            endpointMode,
            endFlip,
          ),
        }).addTo(liveGroup)
      })
    }

    void drawTracks()
    return () => {
      cancelled = true
    }
  }, [endpointMode, permitsKey])

  return (
    <div
      className="heatmap-shell heatmap-compact permit-leaflet-shell"
      data-permit-map={endpointMode === 'cities' ? 'overview' : 'sample'}
      data-selected-permit={selectedPermitId ?? permits[0]?.id ?? ''}
    >
      <div className="heatmap-canvas" role="img" aria-label={badgeSubtitle}>
        <div ref={mapNode} className="permit-leaflet-map" />
        <div className="permit-map-badge">
          <Route size={16} />
          <span>
            <strong>{badgeTitle}</strong>
            <small>{badgeSubtitle}</small>
          </span>
        </div>
        {showLegend ? (
          <div className="permit-map-legend overview-route-legend">
            <span><i className="alert-key ready" /> Ready</span>
            <span><i className="alert-key verify" /> Verify</span>
            <span><i className="alert-key hold" /> Hold</span>
          </div>
        ) : (
          <div className="permit-map-legend">
            <span><i className="route-line-key" /> Sample GPX</span>
          </div>
        )}
      </div>
    </div>
  )
}
