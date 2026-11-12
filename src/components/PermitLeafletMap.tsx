import { useEffect, useRef } from 'react'
import L, { type LayerGroup, type Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Route } from 'lucide-react'
import { ROUTE_FIT_MAX_ZOOM } from '../lib/mapBounds'
import { downsampleTrack, escapeHtml, loadGpxTrack, type LatLng } from '../lib/gpxTrack'
import {
  SAMPLE_ROUTE_COLOR,
  VERDICT_TRACK_COLORS,
  overviewVerdictForPermit,
  type OverviewVerdict,
} from '../lib/overviewTracks'
import type { TestPermit } from '../lib/routeCheck'

export type PermitLeafletMapProps = {
  permits: TestPermit[]
  badgeTitle: string
  badgeSubtitle: string
  endpointMode: 'cities' | 'start-dest'
  showLegend: boolean
  selectedPermitId?: string
  highlightPermitId?: string
  dataTestId?: string
}

type DrawnTrack = {
  permit: TestPermit
  verdict: OverviewVerdict
  coordinates: LatLng[]
}

type LabelSpec = {
  point: LatLng
  text: string
  prefix?: string
  kind: 'origin' | 'destination'
}

type LabelPlacement = LabelSpec & {
  side: 'left' | 'right'
  nudgeY: number
}

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const LINE_WEIGHT = 5
const CASING_WEIGHT = 9
const SAMPLE_FIT_PAD_X = 100
const SAMPLE_FIT_PAD_Y = 72
const OVERVIEW_FIT_PAD_X = 40
const OVERVIEW_FIT_PAD_Y = 64
const OVERVIEW_FIT_PAD_TOP = 108
const GERMANY_CENTER: LatLng = [51.16, 10.45]
const GERMANY_ZOOM = 6
const PREFERRED_LABEL: Record<string, { side: 'left' | 'right'; nudgeY: number }> = {
  Lübeck: { side: 'left', nudgeY: 18 },
  Rostock: { side: 'right', nudgeY: 0 },
  Hamburg: { side: 'right', nudgeY: 14 },
  Hannover: { side: 'left', nudgeY: 0 },
  Leipzig: { side: 'right', nudgeY: 0 },
  Nürnberg: { side: 'left', nudgeY: 0 },
  München: { side: 'right', nudgeY: 0 },
  Stuttgart: { side: 'left', nudgeY: 0 },
}

function trackColor(track: DrawnTrack, sampleLine: boolean) {
  return sampleLine ? SAMPLE_ROUTE_COLOR : VERDICT_TRACK_COLORS[track.verdict]
}

function pillIcon(placement: LabelPlacement) {
  const prefix = placement.prefix
    ? `<small>${escapeHtml(placement.prefix)}</small>`
    : ''
  return L.divIcon({
    className: `permit-pill-host is-${placement.side}${placement.nudgeY < 0 ? ' is-above' : placement.nudgeY > 0 ? ' is-below' : ''}`,
    html: `<span class="permit-map-pill permit-endpoint">${prefix}<strong>${escapeHtml(placement.text)}</strong></span>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  })
}

function estimateWidth(spec: LabelSpec) {
  return Math.ceil((spec.prefix ? spec.prefix.length * 6.2 + 8 : 0) + spec.text.length * 6.8 + 20)
}

function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

function placeLabels(map: LeafletMap, specs: LabelSpec[]): LabelPlacement[] {
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = []
  const height = 22
  return specs.map(spec => {
    const pt = map.latLngToContainerPoint(spec.point)
    const width = estimateWidth(spec)
    const preferred = { ...(PREFERRED_LABEL[spec.text] ?? {
      side: spec.kind === 'destination' ? 'left' as const : 'right' as const,
      nudgeY: 0,
    }) }
    if (spec.prefix) {
      preferred.nudgeY = -14
      if (pt.x > map.getSize().x * 0.62) preferred.side = 'left'
      if (pt.x < map.getSize().x * 0.38) preferred.side = 'right'
      if (pt.y < 48) preferred.nudgeY = 16
      if (pt.y > map.getSize().y - 48) preferred.nudgeY = -16
    }
    const other = preferred.side === 'left' ? 'right' as const : 'left' as const
    const candidates: Array<{ side: 'left' | 'right'; nudgeY: number }> = [
      preferred,
      { side: other, nudgeY: preferred.nudgeY },
      { side: preferred.side, nudgeY: preferred.nudgeY - 20 },
      { side: preferred.side, nudgeY: preferred.nudgeY + 20 },
      { side: other, nudgeY: -20 },
      { side: other, nudgeY: 20 },
    ]
    const pick = candidates.find(candidate => {
      const x = candidate.side === 'left' ? pt.x - 10 - width : pt.x + 10
      const y = pt.y - height / 2 + candidate.nudgeY
      const box = { x, y, w: width, h: height }
      return !occupied.some(item => boxesOverlap(item, box))
    }) ?? candidates[0]
    const x = pick.side === 'left' ? pt.x - 10 - width : pt.x + 10
    occupied.push({ x, y: pt.y - height / 2 + pick.nudgeY, w: width, h: height })
    return { ...spec, side: pick.side, nudgeY: pick.nudgeY }
  })
}

function fitMapToTracks(map: LeafletMap, points: LatLng[], padX: number, padY: number, padTop = padY) {
  map.invalidateSize({ animate: false })
  const sized = map.getSize()
  if (sized.x < 80 || sized.y < 80) return false
  const x = Math.min(padX, Math.max(28, Math.floor(sized.x / 4)))
  const y = Math.min(padY, Math.max(28, Math.floor(sized.y / 4)))
  const top = Math.min(Math.max(padTop, y), Math.max(48, Math.floor(sized.y / 2.6)))
  const bounds = L.latLngBounds(points).pad(padX >= 80 ? 0.18 : 0.06)
  map.fitBounds(bounds, {
    paddingTopLeft: [x, top],
    paddingBottomRight: [x, y],
    maxZoom: ROUTE_FIT_MAX_ZOOM,
    animate: false,
  })
  const start = map.latLngToContainerPoint(points[0])
  const end = map.latLngToContainerPoint(points[points.length - 1])
  const edge = Math.min(start.x, end.x, start.y, end.y, sized.x - start.x, sized.x - end.x, sized.y - start.y, sized.y - end.y)
  if (edge < 56) {
    map.setZoom(map.getZoom() - 0.5, { animate: false })
  }
  return true
}

export default function PermitLeafletMap({
  permits,
  badgeTitle,
  badgeSubtitle,
  endpointMode,
  showLegend,
  selectedPermitId,
  highlightPermitId,
  dataTestId,
}: PermitLeafletMapProps) {
  const mapNode = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const lineGroupRef = useRef<LayerGroup | null>(null)
  const labelGroupRef = useRef<LayerGroup | null>(null)
  const tracksRef = useRef<DrawnTrack[]>([])
  const pointsRef = useRef<LatLng[]>([])
  const permitsRef = useRef(permits)
  permitsRef.current = permits
  const endpointModeRef = useRef(endpointMode)
  endpointModeRef.current = endpointMode
  const highlightRef = useRef(highlightPermitId)
  highlightRef.current = highlightPermitId
  const permitsKey = permits.map(permit => permit.id).join(',')
  const sampleLine = endpointMode === 'start-dest'
  const fitPadX = sampleLine ? SAMPLE_FIT_PAD_X : OVERVIEW_FIT_PAD_X
  const fitPadY = sampleLine ? SAMPLE_FIT_PAD_Y : OVERVIEW_FIT_PAD_Y
  const fitPadTop = sampleLine ? SAMPLE_FIT_PAD_Y : OVERVIEW_FIT_PAD_TOP
  const applyFitRef = useRef(() => {})

  applyFitRef.current = () => {
    const map = mapRef.current
    const labelGroup = labelGroupRef.current
    const points = pointsRef.current
    const tracks = tracksRef.current
    if (!map || !labelGroup) return
    map.invalidateSize({ animate: false })
    if (points.length < 2) return
    const fitted = fitMapToTracks(map, points, fitPadX, fitPadY, fitPadTop)
    if (!fitted) return
    labelGroup.clearLayers()
    const cityMode = endpointModeRef.current === 'cities'
    const specs: LabelSpec[] = [...tracks].sort((a, b) => b.coordinates[0][0] - a.coordinates[0][0]).flatMap(track => {
      const start = track.coordinates[0]
      const end = track.coordinates[track.coordinates.length - 1]
      return [
        {
          point: start,
          text: track.permit.originShort,
          prefix: cityMode ? undefined : 'START',
          kind: 'origin' as const,
        },
        {
          point: end,
          text: track.permit.destinationShort,
          prefix: cityMode ? undefined : 'DESTINATION',
          kind: 'destination' as const,
        },
      ]
    })
    placeLabels(map, specs).forEach(placement => {
      L.marker(placement.point, {
        interactive: false,
        icon: pillIcon(placement),
        zIndexOffset: 400,
      }).addTo(labelGroup)
    })
  }

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return

    const map = L.map(mapNode.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 16,
      zoomSnap: 0,
      zoomDelta: 0.5,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      touchZoom: true,
      keyboard: true,
      boxZoom: false,
      center: GERMANY_CENTER,
      zoom: GERMANY_ZOOM,
    })
    map.attributionControl?.setPrefix(false)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer(OSM_TILES, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map)
    map.invalidateSize({ animate: false })

    map.on('click', () => {
      map.scrollWheelZoom.enable()
    })
    const disableWheel = () => map.scrollWheelZoom.disable()
    map.getContainer().addEventListener('mouseleave', disableWheel)

    mapRef.current = map
    lineGroupRef.current = L.layerGroup().addTo(map)
    labelGroupRef.current = L.layerGroup().addTo(map)

    let resizeTimer: number | undefined
    let lastW = 0
    let lastH = 0
    const observer = new ResizeObserver(() => {
      const live = mapRef.current
      if (!live) return
      live.invalidateSize({ animate: false })
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        const sized = mapRef.current
        if (!sized) return
        sized.invalidateSize({ animate: false })
        const rect = sized.getContainer().getBoundingClientRect()
        if (Math.abs(rect.width - lastW) < 8 && Math.abs(rect.height - lastH) < 8 && lastW > 0) return
        lastW = rect.width
        lastH = rect.height
        applyFitRef.current()
      }, 120)
    })
    observer.observe(mapNode.current)

    let sizeAttempts = 0
    const waitForSize = () => {
      const live = mapRef.current
      if (!live) return
      live.invalidateSize({ animate: false })
      const size = live.getSize()
      if (size.x >= 80 && size.y >= 80) {
        applyFitRef.current()
        return
      }
      if (sizeAttempts++ < 24) requestAnimationFrame(waitForSize)
    }

    map.whenReady(() => {
      map.invalidateSize({ animate: false })
      applyFitRef.current()
      requestAnimationFrame(waitForSize)
    })

    return () => {
      map.getContainer().removeEventListener('mouseleave', disableWheel)
      window.clearTimeout(resizeTimer)
      observer.disconnect()
      map.remove()
      mapRef.current = null
      lineGroupRef.current = null
      labelGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !lineGroupRef.current) return
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
      const lineGroup = lineGroupRef.current
      if (cancelled || !liveMap || !lineGroup) return

      loaded.sort((a, b) => {
        const aHi = a.permit.id === highlightRef.current ? 1 : 0
        const bHi = b.permit.id === highlightRef.current ? 1 : 0
        return aHi - bHi
      })

      lineGroup.clearLayers()
      loaded.forEach(track => {
        const color = trackColor(track, sampleLine)
        const highlighted = track.permit.id === highlightRef.current
        const weight = highlighted ? LINE_WEIGHT + 1 : LINE_WEIGHT
        const casing = highlighted ? CASING_WEIGHT + 2 : CASING_WEIGHT
        L.polyline(track.coordinates, { color: '#fff', weight: casing, opacity: 0.95, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(lineGroup)
        L.polyline(track.coordinates, { color, weight, opacity: 1, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(lineGroup)
        const start = track.coordinates[0]
        const end = track.coordinates[track.coordinates.length - 1]
        ;[start, end].forEach(point => {
          L.circleMarker(point, {
            radius: highlighted ? 7 : 6,
            color: '#fff',
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
            interactive: false,
          }).addTo(lineGroup)
        })
      })

      tracksRef.current = loaded
      pointsRef.current = loaded.flatMap(track => track.coordinates)
      liveMap.whenReady(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => applyFitRef.current())
        })
      })
    }

    void drawTracks()
    return () => {
      cancelled = true
    }
  }, [endpointMode, fitPadX, fitPadY, permitsKey, sampleLine])

  return (
    <div
      className="heatmap-shell heatmap-compact permit-leaflet-shell"
      data-permit-map={dataTestId ?? (endpointMode === 'cities' ? 'overview' : 'sample')}
      data-selected-permit={selectedPermitId ?? permits[0]?.id ?? ''}
      data-featured-permit={highlightPermitId ?? ''}
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
