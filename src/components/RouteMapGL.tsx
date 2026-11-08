import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AlertTriangle, CheckCircle2, CircleX, Layers3, Minus, Plus } from 'lucide-react';
import type { RouteEvidence } from '../data/routeChecks';

type Props = {
  coordinates: [number, number][];
  origin: string;
  destination: string;
  corridor?: [number, number][][];
  evidence: RouteEvidence[];
  verdict: 'READY' | 'HOLD' | 'VERIFY';
  activeLayer: string;
  layers: Array<{ id: string; label: string }>;
  onLayerChange: (layer: string) => void;
  onEvidenceSelect?: (evidence: RouteEvidence) => void;
  className?: string;
};

export type RouteMapHandle = {
  flyToEvidence: (evidence: RouteEvidence) => void;
};

const VERDICT_COLORS = {
  READY: '#12b76a',
  HOLD: '#dc3f52',
  VERIFY: '#e59b24',
};

const EVIDENCE_COLORS = {
  clear: '#12b76a',
  warning: '#e59b24',
  danger: '#dc3f52',
};

const RouteMapGL = forwardRef<RouteMapHandle, Props>(({
  coordinates,
  origin,
  destination,
  corridor,
  evidence,
  verdict,
  activeLayer,
  layers,
  onLayerChange,
  onEvidenceSelect,
  className = '',
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    flyToEvidence: (evidence: RouteEvidence) => {
      if (map.current && evidence.lat != null && evidence.lng != null) {
        map.current.flyTo({
          center: [evidence.lng, evidence.lat],
          zoom: 12,
          duration: 1500,
        });
      }
    },
  }));

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'openfree': {
            type: 'raster',
            tiles: ['https://tiles.openfreemap.com/natural/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenFreeMap contributors',
          },
        },
        layers: [
          {
            id: 'openfree-tiles',
            type: 'raster',
            source: 'openfree',
          },
        ],
      },
      center: [10.45, 51.16], // Center of Germany
      zoom: 6,
      attributionControl: true,
    });

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    mapInstance.on('load', () => {
      setMapLoaded(true);
    });
    
    // Fallback to OSM raster tiles if OpenFreeMap fails
    mapInstance.on('error', (e) => {
      if (e.error?.message?.includes('tiles') || e.error?.message?.includes('style')) {
        console.warn('Map tiles failed, falling back to OSM:', e.error);
        try {
          mapInstance.addSource('osm-fallback', {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          });
          mapInstance.addLayer({
            id: 'osm-fallback-tiles',
            type: 'raster',
            source: 'osm-fallback',
          }, 'openfree-tiles');
        } catch (fallbackError) {
          console.error('Fallback basemap also failed:', fallbackError);
        }
      }
    });

    map.current = mapInstance;

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update route and corridor
  useEffect(() => {
    if (!map.current || !mapLoaded || coordinates.length < 2) return;

    const mapInstance = map.current;
    
    // Helper to safely remove layer and source
    const removeLayerAndSource = (layerId: string, sourceId: string) => {
      try {
        if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
        if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      } catch (e) {
        console.warn(`Failed to remove ${layerId}:`, e);
      }
    };

    // Remove existing route layers
    removeLayerAndSource('route-corridor', 'route-corridor');
    removeLayerAndSource('route-line', 'route-line');

    // Convert coordinates to [lng, lat] for MapLibre
    const geoCoordinates = coordinates.map(([lat, lng]) => [lng, lat]);
    
    console.log('Adding route with', coordinates.length, 'points');
    console.log('First point (input):', coordinates[0], '→ (geo):', geoCoordinates[0]);

    // Add corridor if provided
    if (corridor && corridor.length > 0) {
      try {
        mapInstance.addSource('route-corridor', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: corridor,
            },
          },
        });

        mapInstance.addLayer({
          id: 'route-corridor',
          type: 'fill',
          source: 'route-corridor',
          paint: {
            'fill-color': VERDICT_COLORS[verdict],
            'fill-opacity': 0.1,
          },
        });
      } catch (e) {
        console.error('Failed to add corridor:', e);
      }
    }

    // Add route line
    try {
      mapInstance.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: geoCoordinates,
          },
        },
      });

      mapInstance.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        paint: {
          'line-color': VERDICT_COLORS[verdict],
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });
      
      console.log('✓ Route line added successfully');
    } catch (e) {
      console.error('Failed to add route line:', e);
    }

    // Fit to route bounds with padding
    try {
      const bounds = geoCoordinates.reduce(
        (bounds, [lng, lat]) => bounds.extend([lng, lat]),
        new maplibregl.LngLatBounds(geoCoordinates[0], geoCoordinates[0])
      );

      mapInstance.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 1000,
      });
      
      console.log('✓ Fitted to bounds');
    } catch (e) {
      console.error('Failed to fit bounds:', e);
    }
  }, [coordinates, corridor, verdict, mapLoaded]);

  // Update markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Filter evidence by active layer
    const layerEvidence = evidence.filter(e => e.category === activeLayer);

    // Add markers for evidence
    layerEvidence.forEach((item) => {
      if (!item.lat || !item.lng) return;

      const el = document.createElement('div');
      el.className = 'route-evidence-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = EVIDENCE_COLORS[item.state];
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      // Add icon based on state
      const icon = document.createElement('div');
      icon.innerHTML = item.state === 'danger' 
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
        : item.state === 'warning'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      el.appendChild(icon);

      const marker = new maplibregl.Marker(el)
        .setLngLat([item.lng, item.lat])
        .addTo(map.current!);

      // Add click handler
      el.addEventListener('click', () => {
        if (onEvidenceSelect) {
          onEvidenceSelect(item);
        }
        // Fly to marker
        map.current?.flyTo({
          center: [item.lng!, item.lat!],
          zoom: 11,
          duration: 1000,
        });
      });

      markers.current.push(marker);
    });
  }, [evidence, activeLayer, mapLoaded, onEvidenceSelect]);

  const VerdictIcon = verdict === 'READY' ? CheckCircle2 : verdict === 'HOLD' ? CircleX : AlertTriangle;
  const layerCounts = {
    roadworks: evidence.filter(e => e.category === 'roadworks').length,
    closures: evidence.filter(e => e.category === 'closures').length,
    observations: evidence.filter(e => e.category === 'observations').length,
  };

  return (
    <div className={`route-map-gl ${className}`}>
      <div ref={mapContainer} className="route-map-gl-container" />
      
      {/* Layer controls */}
      <div className="route-map-gl-layers">
        <div className="route-map-gl-layers-header">
          <Layers3 size={16} />
          <span>Layers</span>
        </div>
        {layers.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className={activeLayer === layer.id ? 'active' : ''}
            onClick={() => onLayerChange(layer.id)}
          >
            {layer.label}
            <span className="layer-count">
              {layerCounts[layer.id as keyof typeof layerCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* Route legend */}
      <div className="route-map-gl-legend">
        <VerdictIcon size={16} style={{ color: VERDICT_COLORS[verdict] }} />
        <div>
          <strong>{origin} → {destination}</strong>
          <span>
            {verdict === 'READY' ? 'Clear – no blocking issues' : 
             verdict === 'HOLD' ? 'Hold – blocking issue detected' :
             'Verify – requires confirmation'}
          </span>
        </div>
      </div>
    </div>
  );
});

RouteMapGL.displayName = 'RouteMapGL';

export default RouteMapGL;
