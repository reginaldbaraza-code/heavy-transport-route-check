import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Import worker as URL for Vite to bundle it
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// Configure worker URL globally before any Map is created
setWorkerUrl(workerUrl);
import { Link } from 'react-router-dom'
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

const formatBerlinTime = (date: Date) => new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(date)

export default function LiveMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [events, setEvents] = useState<OperationalEvent[]>(() => createOperationalEvents())
  const [activeLayers, setActiveLayers] = useState<string[]>(['roadworks', 'warnings', 'closures', 'traffic'])
  const [selectedEvent, setSelectedEvent] = useState<OperationalEvent | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'national' | 'munich'>('national')
  const [baseMap, setBaseMap] = useState<'road' | 'contrast'>('road')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [liveStatus, setLiveStatus] = useState<'ready' | 'refreshing'>('ready')
  const [snowRisk, setSnowRisk] = useState<SnowCell[]>(snowCells.map(([lat, lng, intensity]) => ({ lat, lng, intensity, temperature: -1, snowfall: 0.6 })))
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [layerPanelOpen, setLayerPanelOpen] = useState(() => {
    // Collapse by default on mobile (< 768px)
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  })

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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
          },
        ],
      },
      center: [10.35, 51.12],
      zoom: 6,
      minZoom: 5,
      maxZoom: 13,
      cooperativeGestures: true,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    // Helper to add cluster layers
    const addClusterLayers = () => {
      // Remove existing if present
      ['unclustered-label', 'unclustered-point', 'cluster-count', 'clusters'].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      if (map.getSource('events')) map.removeSource('events')

      // Add GeoJSON source for clustered events
      map.addSource('events', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 9,
      })

      // Cluster circle layer
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6',
            10,
            '#f59e0b',
            25,
            '#ef4444'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,
            10,
            20,
            25,
            25
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })

      // Cluster count layer
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })

      // Unclustered point layer (visible at zoom >= 10)
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        minzoom: 10,
        paint: {
          'circle-color': [
            'match',
            ['get', 'type'],
            'roadworks', '#f59e0b',
            'warnings', '#ef4444',
            'closures', '#334155',
            'webcams', '#0ea5e9',
            'parking', '#6366f1',
            '#999999'
          ],
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      })

      // Unclustered label layer (visible at zoom >= 10)
      map.addLayer({
        id: 'unclustered-label',
        type: 'symbol',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        minzoom: 10,
        layout: {
          'text-field': ['get', 'title'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#333',
          'text-halo-color': '#fff',
          'text-halo-width': 1,
        },
      })

      // Click handlers
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        const clusterId = features[0]?.properties?.cluster_id
        if (clusterId) {
          const source = map.getSource('events') as maplibregl.GeoJSONSource
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || !features[0].geometry || features[0].geometry.type !== 'Point') return
            map.easeTo({
              center: features[0].geometry.coordinates as [number, number],
              zoom: zoom || 10,
            })
          })
        }
      })

      map.on('click', 'unclustered-point', (e) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties
          if (props) {
            setSelectedEvent({
              id: props.id,
              type: props.type,
              title: props.title,
              detail: props.detail,
              road: props.road,
              lat: props.lat,
              lng: props.lng,
              updated: props.updated,
              source: props.source,
              confidence: props.confidence,
              dataCategory: props.dataCategory,
              marketQuery: props.marketQuery,
            })

            // Create popup
            new maplibregl.Popup()
              .setLngLat([props.lng, props.lat])
              .setHTML(`
                <div class="live-popup">
                  <span>${eventMeta[props.type as OperationalEventType].label} · ${props.road}</span>
                  <strong>${props.title}</strong>
                  <p>${props.detail}</p>
                  <small>${props.source} · ${props.confidence}% confidence · Updated ${props.updated}</small>
                </div>
              `)
              .addTo(map)
          }
        }
      })

      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = ''
      })
    }

    // Add cluster layers once on load
    map.on('load', () => {
      addClusterLayers()
      setMapLoaded(true)
    })

    mapRef.current = map
    
    // Expose map instance for testing (non-production only)
    if (typeof window !== 'undefined' && import.meta.env.DEV === false) {
      (window as any).__TEST_CORRIDOR_MAP__ = map;
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update events GeoJSON when visibleEvents changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const source = map.getSource('events') as maplibregl.GeoJSONSource
    if (!source) return

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: visibleEvents.map(event => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [event.lng, event.lat],
        },
        properties: {
          id: event.id,
          type: event.type,
          title: event.title,
          detail: event.detail,
          road: event.road,
          lat: event.lat,
          lng: event.lng,
          updated: event.updated,
          source: event.source,
          confidence: event.confidence,
          dataCategory: event.dataCategory,
          marketQuery: event.marketQuery,
        },
      })),
    }

    source.setData(geojson)
  }, [visibleEvents, mapLoaded])

  // Handle scope changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    
    if (scope === 'munich') {
      map.flyTo({ center: [11.58, 48.14], zoom: 10, duration: 800 })
    } else {
      const bounds = germanyOutline.reduce((bounds, coord) => {
        return bounds.extend([coord[1], coord[0]] as [number, number])
      }, new maplibregl.LngLatBounds())
      map.fitBounds(bounds, { padding: 32, duration: 800 })
    }
  }, [scope, mapLoaded])

  const toggleLayer = (id: string) => {
    setActiveLayers(current => current.includes(id) ? current.filter(layer => layer !== id) : [...current, id])
  }

  const focusEvent = (event: OperationalEvent) => {
    setSelectedEvent(event)
    mapRef.current?.flyTo({ center: [event.lng, event.lat], zoom: 11, duration: 700 })
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
          <div className="live-map-title">
            <h1>Corridor monitor</h1>
            <span className={`feed-status ${liveStatus}`}>
              <Radio size={11} /> {liveStatus === 'refreshing' ? 'Fetching live data' : 'Live: Autobahn GmbH'}
            </span>
          </div>
          <p>See current roadworks, warnings, closures, and heavy-transport restrictions across Germany.</p>
        </div>
        <div className="live-map-header-actions">
          <span><Clock3 size={12} /> Updated {formatBerlinTime(lastUpdated)}</span>
          <button type="button" onClick={refreshEvents} disabled={liveStatus === 'refreshing'}>
            <RefreshCw size={13} className={liveStatus === 'refreshing' ? 'spin' : ''} /> Refresh data
          </button>
          <button type="button" onClick={() => {
            const map = mapRef.current
            if (!map) return
            const bounds = germanyOutline.reduce((bounds, coord) => {
              return bounds.extend([coord[1], coord[0]] as [number, number])
            }, new maplibregl.LngLatBounds())
            map.fitBounds(bounds, { padding: 32 })
          }}>
            <Maximize2 size={13} /> Fit Germany
          </button>
          <Link to="/discover" className="market-button primary">Find related offers</Link>
        </div>
      </header>

      <div className="live-map-tabs" role="tablist" aria-label="Map scope">
        <button type="button" className={scope === 'national' ? 'active' : ''} onClick={() => setScope('national')}>
          <MapIcon size={13} /> Germany data coverage
        </button>
        <button type="button" className={scope === 'munich' ? 'active' : ''} onClick={() => setScope('munich')}>
          <LocateFixed size={13} /> Munich mobility use case
        </button>
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
          <div ref={mapContainer} className="maplibre-map" aria-label="Interactive live mobility map of Germany" />

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
