import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Import worker as URL for Vite to bundle it
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// Configure worker URL globally before any Map is created
setWorkerUrl(workerUrl);
import {
  AlertTriangle, ChevronDown, CircleParking, Clock3,
  Construction, Layers3, LocateFixed, Map as MapIcon, Maximize2,
  Radio, RefreshCw, Route, Search, XCircle
} from 'lucide-react'
import {
  germanyOutline, roadVectors,
} from '../data/germanyMap'
import {
  type OperationalEvent, type OperationalEventType,
} from '../data/mapOperations'
import { formatBerlinDateTime } from '../lib/formatTime'

const layerOptions = [
  { id: 'roadworks', label: 'Road condition signals', icon: Construction, color: '#f59e0b' },
  { id: 'warnings', label: 'Safety signals', icon: AlertTriangle, color: '#ef4444' },
  { id: 'closures', label: 'Restrictions', icon: XCircle, color: '#334155' },
  { id: 'parking', label: 'Lorry parking', icon: CircleParking, color: '#6366f1' },
] as const

const eventMeta: Record<OperationalEventType, { label: string; short: string; color: string; icon: typeof Construction }> = {
  roadworks: { label: 'Roadwork', short: 'R', color: '#f59e0b', icon: Construction },
  warnings: { label: 'Warning', short: '!', color: '#ef4444', icon: AlertTriangle },
  closures: { label: 'Closure', short: '×', color: '#334155', icon: XCircle },
  parking: { label: 'Parking', short: 'P', color: '#6366f1', icon: CircleParking },
  webcams: { label: 'Webcam', short: 'C', color: '#0ea5e9', icon: Construction },
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
  const [events, setEvents] = useState<OperationalEvent[]>([])
  const [activeLayers, setActiveLayers] = useState<string[]>(['roadworks', 'warnings', 'closures', 'traffic'])
  const [selectedEvent, setSelectedEvent] = useState<OperationalEvent | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'national' | 'munich'>('national')
  const [baseMap, setBaseMap] = useState<'road' | 'contrast'>('road')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [liveStatus, setLiveStatus] = useState<'ready' | 'refreshing'>('ready')
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

  const refreshEvents = useCallback(async () => {
    setLiveStatus('refreshing')
    try {
      const response = await fetch('/api/autobahn-events')
      if (!response.ok) {
        throw new Error('API unavailable')
      }
      const data = await response.json()
      
      // Convert API format to OperationalEvent format
      const convertedEvents: OperationalEvent[] = [
        ...data.roadworks.map((e: any) => ({
          id: e.id,
          type: 'roadworks' as const,
          title: e.title,
          detail: e.description,
          road: extractRoad(e.description) || 'Unknown',
          lat: e.lat,
          lng: e.lng,
          updated: e.age || [e.startTimestamp ? `Start: ${formatBerlinDateTime(e.startTimestamp)}` : 'Start: not published', e.retrievedAt ? `Retrieved ${formatBerlinDateTime(e.retrievedAt)}` : ''].filter(Boolean).join(' · '),
          confidence: e.confidence === 'high' ? 90 : 70,
          source: data.source,
          dataCategory: 'operational',
          marketQuery: 'roadworks',
        })),
        ...data.closures.map((e: any) => ({
          id: e.id,
          type: 'closures' as const,
          title: e.title,
          detail: e.description,
          road: extractRoad(e.description) || 'Unknown',
          lat: e.lat,
          lng: e.lng,
          updated: e.age || [e.startTimestamp ? `Start: ${formatBerlinDateTime(e.startTimestamp)}` : 'Start: not published', e.retrievedAt ? `Retrieved ${formatBerlinDateTime(e.retrievedAt)}` : ''].filter(Boolean).join(' · '),
          confidence: 95,
          source: data.source,
          dataCategory: 'operational',
          marketQuery: 'closures',
        })),
        ...data.warnings.map((e: any) => ({
          id: e.id,
          type: 'warnings' as const,
          title: e.title,
          detail: e.description,
          road: extractRoad(e.description) || 'Unknown',
          lat: e.lat,
          lng: e.lng,
          updated: e.age || [e.startTimestamp ? `Start: ${formatBerlinDateTime(e.startTimestamp)}` : 'Start: not published', e.retrievedAt ? `Retrieved ${formatBerlinDateTime(e.retrievedAt)}` : ''].filter(Boolean).join(' · '),
          confidence: e.confidence === 'high' ? 85 : 65,
          source: data.source,
          dataCategory: 'operational',
          marketQuery: 'warnings',
        })),
        ...(data.parking || []).map((e: any) => ({
          id: e.id,
          type: 'parking' as const,
          title: e.title,
          detail: e.description,
          road: extractRoad(`${e.title} ${e.description}`) || 'Unknown',
          lat: e.lat,
          lng: e.lng,
          updated: e.age || [e.startTimestamp ? `Start: ${formatBerlinDateTime(e.startTimestamp)}` : 'Start: not published', e.retrievedAt ? `Retrieved ${formatBerlinDateTime(e.retrievedAt)}` : ''].filter(Boolean).join(' · '),
          confidence: 70,
          source: data.source,
          dataCategory: 'parking',
          marketQuery: 'lorry parking',
        })),
      ]
      
      setEvents(convertedEvents)
      setLastUpdated(new Date())
      setLiveStatus('ready')
    } catch (error) {
      console.error('Failed to fetch events:', error)
      // On error, show empty state - do NOT fall back to fixtures
      setEvents([])
      setLiveStatus('ready')
    }
  }, [])
  
  // Helper to extract road name from description
  const extractRoad = (text: string): string | null => {
    const match = text.match(/\b(A\d+|B\d+)\b/)
    return match ? match[1] : null
  }

  // Initial fetch on mount
  useEffect(() => {
    refreshEvents()
  }, [refreshEvents])
  
  // Auto-refresh every 2 minutes
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
          void source.getClusterExpansionZoom(clusterId).then(zoom => {
            if (!features[0].geometry || features[0].geometry.type !== 'Point') return
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
        </div>
      </header>

      <div className="live-map-tabs" role="tablist" aria-label="Map scope">
        <button type="button" className={scope === 'national' ? 'active' : ''} onClick={() => setScope('national')}>
          <MapIcon size={13} /> Germany
        </button>
        <button type="button" className={scope === 'munich' ? 'active' : ''} onClick={() => setScope('munich')}>
          <LocateFixed size={13} /> Bavaria focus
        </button>
        <span />
        <button type="button" className={baseMap === 'road' ? 'active' : ''} onClick={() => setBaseMap('road')}>Road</button>
        <button type="button" className={baseMap === 'contrast' ? 'active' : ''} onClick={() => setBaseMap('contrast')}>High contrast</button>
      </div>

      <div className="live-map-workspace">
        <aside className="live-event-panel">
          <div className="live-event-search">
            <Search size={14} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search road or place…" />
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
                <div><dt>Road</dt><dd>{selectedEvent.road}</dd></div>
              </dl>
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
            {listedEvents.length === 0 && liveStatus === 'refreshing' && (
              <div className="live-event-skeleton" aria-busy="true" aria-live="polite">
                <span /><span /><span />
              </div>
            )}
            {listedEvents.length === 0 && liveStatus !== 'refreshing' && <div className="live-event-empty">No signals match the active layers, scope, and search.</div>}
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
            <div><AlertTriangle size={14} /><span>Warnings</span><strong>{events.filter(event => event.type === 'warnings').length}</strong></div>
            <div><RefreshCw size={14} /><span>Autobahns in view</span><strong>{roadVectors.length}</strong></div>
          </div>
        </main>
      </div>
    </div>
  )
}
