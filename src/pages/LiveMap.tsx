import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L, { type LayerGroup, type Map as LeafletMap, type Marker } from 'leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import {
  AlertTriangle, ArrowRight, Camera, Car, ChevronDown, CircleParking, Clock3, CloudSnow,
  Construction, Layers3, LocateFixed, Map as MapIcon, Maximize2,
  Radio, RefreshCw, Route, Search, Truck, XCircle
} from 'lucide-react'
import {
  cities, germanyOutline, regionalCities, rivers, roadVectors, stateBoundaries,
} from '../data/germanyMap'
import {
  createOperationalEvents, type OperationalEvent, type OperationalEventType,
} from '../data/mapOperations'

const layerOptions = [
  { id: 'roadworks', label: 'Road condition signals', icon: Construction, color: '#f59e0b' },
  { id: 'warnings', label: 'Safety signals', icon: AlertTriangle, color: '#ef4444' },
  { id: 'closures', label: 'Restrictions', icon: XCircle, color: '#334155' },
  { id: 'webcams', label: 'Visual evidence', icon: Camera, color: '#0ea5e9' },
  { id: 'parking', label: 'Freight parking', icon: CircleParking, color: '#6366f1' },
  { id: 'traffic', label: 'Movement intensity', icon: Car, color: '#0071e3' },
  { id: 'snow', label: 'Weather exposure', icon: CloudSnow, color: '#7c3aed' },
  { id: 'heavy', label: 'Heavy transport constraints', icon: Truck, color: '#0f766e' },
] as const

const snowCells = [
  [47.68, 10.10, 86], [47.77, 11.60, 92], [48.12, 12.20, 67], [48.55, 13.05, 54],
  [50.48, 11.15, 48], [51.66, 10.62, 72], [50.80, 9.55, 43],
] as const

type SnowCell = { lat: number; lng: number; intensity: number; temperature: number; snowfall: number }

const heavyConstraints = [
  { lat: 53.09, lng: 9.12, title: 'Bridge weight limit', detail: 'Maximum gross weight 44 t', road: 'A1' },
  { lat: 52.16, lng: 9.98, title: 'Height restriction', detail: 'Maximum vehicle height 4.20 m', road: 'A7' },
  { lat: 50.26, lng: 8.67, title: 'Axle-load restriction', detail: 'Maximum axle load 11.5 t', road: 'A5' },
  { lat: 49.21, lng: 9.02, title: 'Permit corridor', detail: 'Advance notification required', road: 'A6' },
  { lat: 48.57, lng: 11.38, title: 'Width restriction', detail: 'Maximum width 3.50 m', road: 'A9' },
]

const eventMeta = {
  roadworks: { label: 'Roadwork', short: 'R', color: '#f59e0b', icon: Construction },
  warnings: { label: 'Warning', short: '!', color: '#ef4444', icon: AlertTriangle },
  closures: { label: 'Closure', short: '×', color: '#334155', icon: XCircle },
  webcams: { label: 'Webcam', short: 'C', color: '#0ea5e9', icon: Camera },
  parking: { label: 'Parking', short: 'P', color: '#3156a3', icon: CircleParking },
}

function popupContent(event: OperationalEvent) {
  const root = document.createElement('div')
  root.className = 'live-popup'
  const label = document.createElement('span')
  label.textContent = `${eventMeta[event.type].label} · ${event.road}`
  const title = document.createElement('strong')
  title.textContent = event.title
  const detail = document.createElement('p')
  detail.textContent = event.detail
  const updated = document.createElement('small')
  updated.textContent = `${event.source} · ${event.confidence}% confidence · Updated ${event.updated}`
  root.append(label, title, detail, updated)
  return root
}

function markerSymbol(type: OperationalEventType) {
  if (type === 'roadworks') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z"/><path d="M9 15h6M10.5 11h3"/></svg>'
  if (type === 'warnings') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z"/><path d="M12 8v5M12 16.5v.5"/></svg>'
  if (type === 'closures') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7 12h10"/></svg>'
  if (type === 'webcams') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="2"/><circle cx="12" cy="13" r="3"/><path d="m8 7 1.5-2h5L16 7"/></svg>'
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>'
}

const formatBerlinTime = (date: Date) => new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(date)

function eventIcon(type: OperationalEventType) {
  const meta = eventMeta[type]
  return L.divIcon({
    className: 'ops-marker-host',
    html: `<span class="ops-map-marker ${type}" style="--marker-color:${meta.color}">${markerSymbol(type)}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function clusterEvents(events: OperationalEvent[], zoom: number) {
  const cellSize = zoom <= 5.5 ? 1.35 : zoom <= 7 ? 0.5 : 0.35
  const groups = new Map<string, OperationalEvent[]>()
  events.forEach(event => {
    const key = `${Math.floor(event.lat / cellSize)}:${Math.floor(event.lng / cellSize)}`
    groups.set(key, [...(groups.get(key) ?? []), event])
  })
  return [...groups.values()].map(items => {
    const types = items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.type]: (counts[item.type] ?? 0) + 1 }), {})
    const dominantType = Object.entries(types).sort((a, b) => b[1] - a[1])[0][0] as OperationalEventType
    return {
      items,
      dominantType,
      lat: items.reduce((sum, item) => sum + item.lat, 0) / items.length,
      lng: items.reduce((sum, item) => sum + item.lng, 0) / items.length,
    }
  })
}

export default function LiveMap() {
  const mapNode = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const eventGroupRef = useRef<LayerGroup | null>(null)
  const overlayGroupRef = useRef<LayerGroup | null>(null)
  const markerRefs = useRef(new Map<string, Marker>())
  const baseLayerRef = useRef<LayerGroup | null>(null)
  const [events, setEvents] = useState<OperationalEvent[]>(() => createOperationalEvents())
  const [activeLayers, setActiveLayers] = useState<string[]>(['roadworks', 'warnings', 'closures', 'traffic'])
  const [selectedEvent, setSelectedEvent] = useState<OperationalEvent | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'national' | 'munich'>('national')
  const [baseMap, setBaseMap] = useState<'road' | 'contrast'>('road')
  const [mapZoom, setMapZoom] = useState(6)
  const [liveStatus, setLiveStatus] = useState<'ready' | 'refreshing'>('ready')
  const [snowRisk, setSnowRisk] = useState<SnowCell[]>(snowCells.map(([lat, lng, intensity]) => ({ lat, lng, intensity, temperature: -1, snowfall: 0.6 })))
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [layerPanelOpen, setLayerPanelOpen] = useState(true)

  const scopeEvents = useMemo(() => events.filter(event =>
    scope === 'national' || (Math.abs(event.lat - 48.14) < 1.15 && Math.abs(event.lng - 11.58) < 1.55),
  ), [events, scope])

  const visibleEvents = useMemo(() => scopeEvents
    .filter(event => activeLayers.includes(event.type))
    .filter(event => !query || `${event.title} ${event.road} ${event.detail} ${event.dataCategory}`.toLowerCase().includes(query.toLowerCase())),
  [scopeEvents, activeLayers, query])

  const listedEvents = useMemo(() => visibleEvents.slice(0, 80), [visibleEvents])

  const refreshEvents = useCallback(() => {
    setLiveStatus('refreshing')
    window.setTimeout(() => {
      setEvents(current => current.map((event, index) => ({
        ...event,
        updated: index % 4 === 0 ? 'just now' : event.updated,
        lat: event.lat + ((index % 3) - 1) * .002,
      })))
      setSnowRisk(current => current.map((cell, index) => ({
        ...cell,
        intensity: Math.max(0, Math.min(100, cell.intensity + (index % 2 ? 3 : -2))),
      })))
      setLastUpdated(new Date())
      setLiveStatus('ready')
    }, 700)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(refreshEvents, 120000)
    return () => window.clearInterval(interval)
  }, [refreshEvents])

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return
    const map = L.map(mapNode.current, { zoomControl: false, minZoom: 5, maxZoom: 13, attributionControl: false }).setView([51.12, 10.35], 6)
    mapRef.current = map
    baseLayerRef.current = L.layerGroup().addTo(map)
    eventGroupRef.current = L.layerGroup().addTo(map)
    overlayGroupRef.current = L.layerGroup().addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map)
    const syncZoom = () => setMapZoom(map.getZoom())
    map.on('zoomend', syncZoom)
    return () => {
      map.off('zoomend', syncZoom)
      map.remove()
      mapRef.current = null
      baseLayerRef.current = null
      eventGroupRef.current = null
      overlayGroupRef.current = null
      markerRefs.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const group = baseLayerRef.current
    if (!map || !group) return
    group.clearLayers()
    const contrast = baseMap === 'contrast'
    L.polygon(germanyOutline, {
      color: contrast ? '#f5c518' : '#315b7d', weight: contrast ? 3 : 2,
      fillColor: contrast ? '#17324a' : '#fbfcfd', fillOpacity: 1, interactive: false,
    }).addTo(group)
    stateBoundaries.forEach(boundary => {
      L.polyline(boundary, {
        color: contrast ? '#7794ab' : '#c5d0d8',
        weight: 1,
        opacity: .9,
        dashArray: '4 4',
        interactive: false,
      }).addTo(group)
    })
    rivers.forEach(river => {
      L.polyline(river.points, {
        color: contrast ? '#69a9d6' : '#85bedf',
        weight: contrast ? 2 : 1.5,
        opacity: .9,
      }).bindTooltip(river.name, { sticky: true, direction: 'top' }).addTo(group)
    })
    roadVectors.forEach(road => {
      L.polyline(road.points, { color: contrast ? '#0b1c2a' : '#fff', weight: 5, opacity: .98, interactive: false }).addTo(group)
      L.polyline(road.points, {
        color: road.name === 'A7' || road.name === 'A3' ? '#e4a80d' : contrast ? '#9fc6df' : '#557f9e',
        weight: 2, opacity: .95,
      }).bindTooltip(road.name, { sticky: true, direction: 'top' }).addTo(group)
      const labelPoint = road.points[Math.floor(road.points.length / 2)]
      L.marker(labelPoint, {
        interactive: false,
        icon: L.divIcon({ className: 'local-road-label', html: road.name, iconSize: [44, 24], iconAnchor: [22, 12] }),
      }).addTo(group)
    })
    ;[...cities, ...regionalCities].forEach(([name, lat, lng]) => {
      L.circleMarker([lat, lng], { radius: 2.5, color: contrast ? '#fff' : '#0a2540', weight: 1, fillOpacity: 1, interactive: false }).addTo(group)
      L.marker([lat, lng], {
        interactive: false,
        icon: L.divIcon({ className: 'vector-city-label', html: name, iconSize: [110, 24], iconAnchor: [-5, 12] }),
      }).addTo(group)
    })
  }, [baseMap])

  useEffect(() => {
    const map = mapRef.current
    const eventGroup = eventGroupRef.current
    const overlayGroup = overlayGroupRef.current
    if (!map || !eventGroup || !overlayGroup) return
    eventGroup.clearLayers()
    overlayGroup.clearLayers()
    markerRefs.current.clear()

    if (mapZoom < 8) {
      clusterEvents(visibleEvents, mapZoom).forEach(cluster => {
        const color = eventMeta[cluster.dominantType].color
        L.marker([cluster.lat, cluster.lng], {
          icon: L.divIcon({
            className: 'ops-cluster-host',
            html: `<span class="ops-cluster" style="--cluster-color:${color}"><strong>${cluster.items.length}</strong><small>signals</small></span>`,
            iconSize: [72, 58],
            iconAnchor: [36, 29],
          }),
          keyboard: true,
          title: `${cluster.items.length} operational signals`,
        })
          .on('click', () => map.flyTo([cluster.lat, cluster.lng], 8, { duration: .55 }))
          .addTo(eventGroup)
      })
    } else {
      visibleEvents.forEach(event => {
        const marker = L.marker([event.lat, event.lng], { icon: eventIcon(event.type), keyboard: true, title: event.title })
          .bindPopup(popupContent(event), { maxWidth: 280 })
          .on('click', () => setSelectedEvent(event))
          .addTo(eventGroup)
        markerRefs.current.set(event.id, marker)
      })
    }

    if (activeLayers.includes('traffic')) {
      roadVectors.forEach((road, index) => {
        const roadEvents = scopeEvents.filter(event => event.road === road.name)
        const restrictions = roadEvents.filter(event => event.type === 'closures').length
        const warnings = roadEvents.filter(event => event.type === 'warnings').length
        const color = restrictions > 1 ? '#ef4444' : warnings > 1 || index % 5 === 0 ? '#f59e0b' : '#2ca36b'
        L.polyline(road.points, {
          color,
          weight: 4,
          opacity: .58,
          interactive: false,
        }).addTo(overlayGroup)
      })
    }
    if (activeLayers.includes('snow')) {
      snowRisk.filter(cell => cell.intensity > 5).forEach(cell => {
        L.circle([cell.lat, cell.lng], {
          radius: 9000 + cell.intensity * 115,
          color: '#7c3aed',
          weight: 1,
          fillColor: cell.intensity > 75 ? '#7c3aed' : '#60a5fa',
          fillOpacity: .22,
        }).bindTooltip(`Snow & ice risk ${cell.intensity}% · ${cell.temperature} °C · ${cell.snowfall} cm`, { sticky: true }).addTo(overlayGroup)
      })
    }
    if (activeLayers.includes('heavy')) {
      heavyConstraints.forEach((constraint, index) => {
        const event: OperationalEvent = {
          ...constraint,
          id: `heavy-${index}`,
          type: 'warnings',
          updated: '6 min ago',
          source: 'Heavy transport restriction register',
          confidence: 96,
          dataCategory: 'Heavy transport constraints',
          marketQuery: 'heavy transport restrictions permits',
        }
        L.marker([constraint.lat, constraint.lng], {
          icon: L.divIcon({ className: 'ops-marker-host', html: '<span class="ops-map-marker heavy">H</span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
          title: constraint.title,
        }).bindPopup(popupContent(event)).addTo(overlayGroup)
      })
    }
  }, [activeLayers, mapZoom, scopeEvents, snowRisk, visibleEvents])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (scope === 'munich') map.flyTo([48.14, 11.58], 10, { duration: .8 })
    else map.fitBounds(germanyOutline, { padding: [32, 32], animate: true, duration: .8 })
  }, [scope])

  const toggleLayer = (id: string) => {
    setActiveLayers(current => current.includes(id) ? current.filter(layer => layer !== id) : [...current, id])
  }

  const focusEvent = (event: OperationalEvent) => {
    setSelectedEvent(event)
    mapRef.current?.flyTo([event.lat, event.lng], 8, { duration: .7 })
    window.setTimeout(() => markerRefs.current.get(event.id)?.openPopup(), 750)
  }

  const layerCount = (id: string) => {
    if (id === 'traffic') return scopeEvents.length
    if (id === 'snow') return snowRisk.length
    if (id === 'heavy') return heavyConstraints.length
    return scopeEvents.filter(event => event.type === id).length
  }

  return (
    <div className="live-map-page">
      <header className="live-map-header">
        <div>
          <div className="live-map-title"><h1>Corridor monitor</h1><span className={`feed-status ${liveStatus}`}><Radio size={11} /> {liveStatus === 'refreshing' ? 'Fetching live data' : 'Live: Autobahn GmbH'}</span></div>
          <p>See current roadworks, warnings, closures, and heavy-transport restrictions across Germany.</p>
        </div>
        <div className="live-map-header-actions">
          <span><Clock3 size={12} /> Updated {formatBerlinTime(lastUpdated)}</span>
          <button type="button" onClick={refreshEvents} disabled={liveStatus === 'refreshing'}><RefreshCw size={13} className={liveStatus === 'refreshing' ? 'spin' : ''} /> Refresh data</button>
          <button type="button" onClick={() => mapRef.current?.fitBounds(germanyOutline, { padding: [32, 32], animate: true })}><Maximize2 size={13} /> Fit Germany</button>
          <Link to="/discover" className="market-button primary">Find related offers</Link>
        </div>
      </header>

      <div className="live-map-tabs" role="tablist" aria-label="Map scope">
        <button type="button" className={scope === 'national' ? 'active' : ''} onClick={() => setScope('national')}><MapIcon size={13} /> Germany data coverage</button>
        <button type="button" className={scope === 'munich' ? 'active' : ''} onClick={() => setScope('munich')}><LocateFixed size={13} /> Munich mobility use case</button>
        <span />
        <button type="button" className={baseMap === 'road' ? 'active' : ''} onClick={() => setBaseMap('road')}>Road</button>
        <button type="button" className={baseMap === 'contrast' ? 'active' : ''} onClick={() => setBaseMap('contrast')}>High contrast</button>
      </div>

      <div className="live-map-workspace">
        <aside className="live-event-panel">
          <div className="live-event-search">
            <Search size={14} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search road, place, or mobility signal…" />
            {query && <button type="button" onClick={() => setQuery('')}><XCircle size={13} /></button>}
          </div>
          <div className="live-event-summary">
            <div><strong>{visibleEvents.length}</strong><span>matched signals</span></div>
            <div><strong>{scopeEvents.filter(event => event.type === 'warnings').length}</strong><span>safety signals</span></div>
            <div><strong>{roadVectors.length}</strong><span>Autobahns modeled</span></div>
          </div>
          {selectedEvent && (
            <div className="selected-map-evidence">
              <span>Selected evidence · {selectedEvent.road}</span>
              <strong>{selectedEvent.title}</strong>
              <p>{selectedEvent.detail}</p>
              <dl>
                <div><dt>Evidence</dt><dd>{selectedEvent.source} · {selectedEvent.confidence}% confidence</dd></div>
                <div><dt>Data need</dt><dd>{selectedEvent.dataCategory} could support routing, safety, or infrastructure decisions here.</dd></div>
              </dl>
              <Link to={`/discover?q=${encodeURIComponent(`${selectedEvent.marketQuery} ${selectedEvent.road}`)}`}>Find data for this problem <ArrowRight size={12} /></Link>
            </div>
          )}
          <div className="live-event-list">
            <div className="live-event-list-heading"><span>Operational evidence</span><b>{visibleEvents.length} matched</b></div>
            {listedEvents.map(event => {
              const meta = eventMeta[event.type]
              const EventIcon = meta.icon
              return (
                <button type="button" key={event.id} className={selectedEvent?.id === event.id ? 'selected' : ''} onClick={() => focusEvent(event)}>
                  <span className="event-type-icon" style={{ background: meta.color }}><EventIcon size={12} /></span>
                  <div><strong>{event.title}</strong><span>{event.road} · {event.detail}</span><small>{event.updated}</small></div>
                  <ChevronDown size={12} />
                </button>
              )
            })}
            {listedEvents.length === 0 && <div className="live-event-empty">No signals match the active layers, scope, and search.</div>}
          </div>
        </aside>

        <main className="live-map-stage">
          <div ref={mapNode} className="leaflet-map" aria-label="Interactive live mobility map of Germany" />

          <section className={`live-layer-panel ${layerPanelOpen ? 'open' : ''}`}>
            <button type="button" className="layer-panel-heading" onClick={() => setLayerPanelOpen(open => !open)}>
              <span><Layers3 size={14} /> Layers</span><ChevronDown size={13} />
            </button>
            {layerPanelOpen && (
              <>
                <div className="layer-panel-list">
                  {layerOptions.map(layer => {
                    const Icon = layer.icon
                    const active = activeLayers.includes(layer.id)
                    return (
                      <button type="button" key={layer.id} onClick={() => toggleLayer(layer.id)} aria-pressed={active}>
                        <span className="layer-icon" style={{ color: layer.color, background: `${layer.color}16` }}><Icon size={13} /></span>
                        <strong>{layer.label}</strong>
                        <small>{layerCount(layer.id)}</small>
                        <i className={active ? 'active' : ''}><span /></i>
                      </button>
                    )
                  })}
                </div>
                <div className="layer-panel-footer"><span>Data source</span><strong>Live: Autobahn GmbH · Updated {formatBerlinTime(lastUpdated)}</strong></div>
              </>
            )}
          </section>

          <div className="live-map-legend">
            <span>Corridor pressure</span><i className="legend-low" /><small>Flowing</small><i className="legend-mid" /><small>Pressure</small><i className="legend-high" /><small>Restricted</small>
          </div>

          <div className="live-map-kpis">
            <div><Route size={14} /><span>Operational signals</span><strong>{events.length}</strong></div>
            <div><AlertTriangle size={14} /><span>Potential data needs</span><strong>{events.filter(event => event.type === 'warnings').length}</strong></div>
            <div><RefreshCw size={14} /><span>Network coverage</span><strong>{roadVectors.length} Autobahns</strong></div>
          </div>
        </main>
      </div>
    </div>
  )
}
