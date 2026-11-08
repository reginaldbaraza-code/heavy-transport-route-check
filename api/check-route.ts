import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as turf from '@turf/turf';
import xml2js from 'xml2js';

export const config = {
  maxDuration: 30,
};

type GPXPoint = {
  lat: number;
  lng: number;
  ele?: number;
  name?: string;
};

type VehicleDimensions = {
  width: number;
  height: number;
  length: number;
  grossWeight: number;
};

type RouteEvidence = {
  id: string;
  title: string;
  detail: string;
  source: string;
  age: string;
  confidence: 'high' | 'medium';
  state: 'clear' | 'warning' | 'danger';
  category: 'roadworks' | 'closures' | 'observations';
  lat?: number;
  lng?: number;
};

type RouteCheckResult = {
  verdict: 'READY' | 'HOLD' | 'VERIFY';
  title: string;
  summary: string;
  impact: string;
  confidence: 'high' | 'medium';
  issueCount: number;
  evidence: RouteEvidence[];
  route: {
    coordinates: [number, number][];
    origin: string;
    destination: string;
    distance: number;
    corridor: string;
  };
  degraded: boolean;
};

async function parseGPX(gpxContent: string): Promise<GPXPoint[]> {
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
    });
    
    const parsed = await parser.parseStringPromise(gpxContent);

    const points: GPXPoint[] = [];
    const track = parsed?.gpx?.trk;
    
    if (!track) {
      throw new Error('No track data found in GPX file');
    }

    const segment = Array.isArray(track) ? track[0]?.trkseg : track?.trkseg;
    const trackPoints = Array.isArray(segment) ? segment[0]?.trkpt : segment?.trkpt;
    
    if (!trackPoints) {
      throw new Error('No track points found in GPX file');
    }

    const pointsArray = Array.isArray(trackPoints) ? trackPoints : [trackPoints];
    
    for (const pt of pointsArray) {
      const lat = parseFloat(pt.lat || pt.$.lat);
      const lon = parseFloat(pt.lon || pt.$.lon || pt.long);
      
      if (isNaN(lat) || isNaN(lon)) {
        continue;
      }

      points.push({
        lat,
        lng: lon,
        ele: pt.ele ? parseFloat(pt.ele) : undefined,
        name: pt.name || undefined,
      });
    }

    if (points.length < 2) {
      throw new Error('GPX file must contain at least 2 valid track points');
    }

    return points;
  } catch (error) {
    console.error('GPX parsing error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('track') || error.message.includes('points')) {
        throw error;
      }
      throw new Error(`Invalid GPX file format: ${error.message}`);
    }
    
    throw new Error('Invalid GPX file: Unable to parse XML structure');
  }
}

function createRouteCorridor(points: GPXPoint[], bufferKm: number = 5): turf.Feature<turf.Polygon | turf.MultiPolygon> {
  const line = turf.lineString(points.map(p => [p.lng, p.lat]));
  const buffered = turf.buffer(line, bufferKm, { units: 'kilometers' });
  return buffered;
}

function checkIntersection(
  corridor: turf.Feature<turf.Polygon | turf.MultiPolygon>,
  eventLat: number,
  eventLng: number
): boolean {
  const point = turf.point([eventLng, eventLat]);
  return turf.booleanPointInPolygon(point, corridor);
}

function calculateRouteDistance(points: GPXPoint[]): number {
  if (points.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = turf.point([points[i].lng, points[i].lat]);
    const to = turf.point([points[i + 1].lng, points[i + 1].lat]);
    totalDistance += turf.distance(from, to, { units: 'kilometers' });
  }
  
  return Math.round(totalDistance);
}

function determineAffectedRoads(points: GPXPoint[]): string[] {
  // Simple heuristic: determine which Autobahn roads (A1-A99) the route might touch
  // based on rough geographic areas in Germany
  
  const minLat = Math.min(...points.map(p => p.lat));
  const maxLat = Math.max(...points.map(p => p.lat));
  const minLng = Math.min(...points.map(p => p.lng));
  const maxLng = Math.max(...points.map(p => p.lng));
  
  const roads: string[] = [];
  
  // North-South routes
  if (minLng < 10 && maxLng > 8) roads.push('A7'); // Hamburg-Kassel-Würzburg
  if (minLng < 9 && maxLng > 7) roads.push('A1'); // Hamburg-Bremen-Dortmund-Köln
  if (minLng < 12 && maxLng > 10) roads.push('A9'); // Berlin-Leipzig-Nürnberg-München
  
  // East-West routes
  if (minLat < 52 && maxLat > 50 && minLng < 9 && maxLng > 6) roads.push('A2'); // Dortmund-Hannover-Berlin
  if (minLat < 51 && maxLat > 49 && minLng < 9 && maxLng > 6) roads.push('A3'); // Köln-Frankfurt-Nürnberg
  if (minLat < 49 && maxLat > 47 && minLng < 11 && maxLng > 8) roads.push('A8'); // Stuttgart-München
  
  // Add some major connectors
  if (minLat < 53 && maxLat > 51 && minLng < 11) roads.push('A27'); // Bremen area
  if (minLat < 52 && maxLat > 50 && minLng < 10) roads.push('A31', 'A33'); // Northern routes
  
  // If no roads determined, return main ones to check
  if (roads.length === 0) {
    return ['A1', 'A3', 'A7', 'A8', 'A9'];
  }
  
  return [...new Set(roads)];
}

function extractWidthRestriction(description: string): number | null {
  const patterns = [
    /(\d+[.,]\d+)\s*m/i,
    /width[:\s]*(\d+[.,]\d+)/i,
    /breite[:\s]*(\d+[.,]\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(value) && value > 0 && value < 10) {
        return value;
      }
    }
  }
  
  return null;
}

function checkVehicleAgainstEvent(
  event: any,
  vehicle: VehicleDimensions
): { exceeds: boolean; restriction?: number; type?: string } {
  const description = [event.title, event.description].join(' ').toLowerCase();
  
  const widthRestriction = extractWidthRestriction(description);
  if (widthRestriction && vehicle.width > widthRestriction) {
    return { exceeds: true, restriction: widthRestriction, type: 'width' };
  }
  
  if (event.isBlocked && event.isBlocked.length > 0) {
    const blockedText = event.isBlocked.join(' ').toLowerCase();
    if (blockedText.includes('all') || blockedText.includes('alle')) {
      return { exceeds: true, type: 'full closure' };
    }
  }
  
  return { exceeds: false };
}

async function fetchRoadEvents(road: string, type: 'roadworks' | 'closure' | 'warning'): Promise<any[]> {
  try {
    const response = await fetch(
      `https://verkehr.autobahn.de/o/autobahn/${road}/services/${type}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const key = type === 'roadworks' ? 'roadworks' : type === 'closure' ? 'closure' : 'warning';
    return data[key] || [];
  } catch (error) {
    console.error(`Error fetching ${type} for ${road}:`, error);
    return [];
  }
}

function calculateAge(timestamp?: string): string {
  if (!timestamp) return 'Recently';
  
  try {
    const eventTime = new Date(timestamp);
    if (isNaN(eventTime.getTime())) return 'Recently';
    
    const now = new Date();
    const diffMs = now.getTime() - eventTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  } catch {
    return 'Recently';
  }
}

async function fetchAutobahnEventsForRoute(roads: string[]): Promise<any> {
  try {
    const allEvents = await Promise.all(
      roads.map(async (road) => {
        const [roadworks, closures, warnings] = await Promise.all([
          fetchRoadEvents(road, 'roadworks'),
          fetchRoadEvents(road, 'closure'),
          fetchRoadEvents(road, 'warning'),
        ]);
        
        return { road, roadworks, closures, warnings };
      })
    );
    
    const processedRoadworks = allEvents.flatMap(({ roadworks }) =>
      roadworks.map((item: any) => ({
        id: item.identifier || `rw-${Date.now()}-${Math.random()}`,
        title: item.title || 'Roadworks',
        description: [
          ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
          ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : [])
        ].filter(Boolean).join(' · ') || 'Roadworks in progress',
        lat: parseFloat(item.coordinate?.lat),
        lng: parseFloat(item.coordinate?.long),
        type: 'roadworks' as const,
        severity: item.isBlocked?.length ? 'warning' as const : 'info' as const,
        extent: item.extent,
        isBlocked: item.isBlocked,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp),
        confidence: 'high' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    const processedClosures = allEvents.flatMap(({ closures }) =>
      closures.map((item: any) => ({
        id: item.identifier || `cl-${Date.now()}-${Math.random()}`,
        title: item.title || 'Closure',
        description: [
          ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
          ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : [])
        ].filter(Boolean).join(' · ') || 'Road closure in effect',
        lat: parseFloat(item.coordinate?.lat),
        lng: parseFloat(item.coordinate?.long),
        type: 'closures' as const,
        severity: 'danger' as const,
        extent: item.extent,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp),
        confidence: 'high' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    const processedWarnings = allEvents.flatMap(({ warnings }) =>
      warnings.map((item: any) => ({
        id: item.identifier || `wn-${Date.now()}-${Math.random()}`,
        title: item.title || 'Warning',
        description: [
          ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
          ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : [])
        ].filter(Boolean).join(' · ') || 'Traffic warning',
        lat: parseFloat(item.coordinate?.lat),
        lng: parseFloat(item.coordinate?.long),
        type: 'warnings' as const,
        severity: 'warning' as const,
        extent: item.extent,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp),
        confidence: 'medium' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    return {
      roadworks: processedRoadworks,
      closures: processedClosures,
      warnings: processedWarnings,
      source: 'Autobahn GmbH (verkehr.autobahn.de)',
      roads: roads.join(', '),
    };
  } catch (error) {
    console.error('Error fetching Autobahn events:', error);
    return null;
  }
}

function determineVerdict(
  evidence: RouteEvidence[],
  degraded: boolean
): { verdict: 'READY' | 'HOLD' | 'VERIFY'; confidence: 'high' | 'medium' } {
  if (degraded) {
    return { verdict: 'VERIFY', confidence: 'medium' };
  }

  const dangerItems = evidence.filter(e => e.state === 'danger');
  const warningItems = evidence.filter(e => e.state === 'warning');

  if (dangerItems.length > 0) {
    return { verdict: 'HOLD', confidence: 'high' };
  }

  if (warningItems.length > 0) {
    return { verdict: 'VERIFY', confidence: 'medium' };
  }

  return { verdict: 'READY', confidence: 'high' };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gpxContent, vehicle, permitNumber } = req.body;

    if (!gpxContent) {
      return res.status(400).json({ 
        error: 'GPX content is required',
        hint: 'Please provide a valid GPX file with route data.',
      });
    }

    if (!vehicle || typeof vehicle.width !== 'number') {
      return res.status(400).json({ 
        error: 'Valid vehicle dimensions are required',
        hint: 'Provide width, height, length, and grossWeight as numbers.',
      });
    }

    let routePoints: GPXPoint[];
    try {
      routePoints = await parseGPX(gpxContent);
    } catch (parseError) {
      return res.status(400).json({ 
        error: parseError instanceof Error ? parseError.message : 'Invalid GPX file',
        hint: 'Please upload a valid GPX file with track points containing latitude and longitude coordinates.',
      });
    }
    
    const distance = calculateRouteDistance(routePoints);
    const origin = routePoints[0].name || 'Start';
    const destination = routePoints[routePoints.length - 1].name || 'End';
    
    const corridor = createRouteCorridor(routePoints, 5);
    
    const affectedRoads = determineAffectedRoads(routePoints);
    console.log('Checking roads:', affectedRoads.join(', '));
    
    const autobahnData = await fetchAutobahnEventsForRoute(affectedRoads);
    const degraded = !autobahnData;
    
    const evidence: RouteEvidence[] = [];
    
    if (autobahnData) {
      for (const event of autobahnData.roadworks || []) {
        if (checkIntersection(corridor, event.lat, event.lng)) {
          const vehicleCheck = checkVehicleAgainstEvent(event, vehicle);
          
          if (vehicleCheck.exceeds) {
            evidence.push({
              id: event.id,
              title: vehicleCheck.type === 'width' 
                ? `Width restriction ${vehicleCheck.restriction}m – vehicle exceeds`
                : 'Roadworks blocking route',
              detail: event.description,
              source: `Live: Autobahn GmbH ${autobahnData.roads}`,
              age: event.age,
              confidence: 'high',
              state: 'danger',
              category: 'roadworks',
              lat: event.lat,
              lng: event.lng,
            });
          } else if (event.severity === 'warning') {
            evidence.push({
              id: event.id,
              title: event.title,
              detail: event.description,
              source: `Live: Autobahn GmbH ${autobahnData.roads}`,
              age: event.age,
              confidence: 'high',
              state: 'warning',
              category: 'roadworks',
              lat: event.lat,
              lng: event.lng,
            });
          }
        }
      }

      for (const event of autobahnData.closures || []) {
        if (checkIntersection(corridor, event.lat, event.lng)) {
          evidence.push({
            id: event.id,
            title: 'Full closure on permitted route',
            detail: event.description,
            source: `Live: Autobahn GmbH ${autobahnData.roads}`,
            age: event.age,
            confidence: 'high',
            state: 'danger',
            category: 'closures',
            lat: event.lat,
            lng: event.lng,
          });
        }
      }

      for (const event of autobahnData.warnings || []) {
        if (checkIntersection(corridor, event.lat, event.lng)) {
          evidence.push({
            id: event.id,
            title: event.title,
            detail: event.description,
            source: `Live: Autobahn GmbH ${autobahnData.roads}`,
            age: event.age,
            confidence: 'medium',
            state: 'warning',
            category: 'roadworks',
            lat: event.lat,
            lng: event.lng,
          });
        }
      }
    }

    if (evidence.length === 0 && !degraded) {
      evidence.push({
        id: 'route-clear',
        title: 'No active roadworks or closures',
        detail: `All checked Autobahn routes (${autobahnData?.roads || 'none'}) show no disruptions on the permitted route corridor.`,
        source: `Live: Autobahn GmbH checked ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
        age: 'Just checked',
        confidence: 'high',
        state: 'clear',
        category: 'roadworks',
      });
    }

    const { verdict, confidence } = determineVerdict(evidence, degraded);
    const issueCount = evidence.filter(e => e.state === 'danger').length;

    const result: RouteCheckResult = {
      verdict,
      title: verdict === 'READY' 
        ? 'Route clear – ready to depart'
        : verdict === 'HOLD'
          ? 'Hold departure – blocking issue on route'
          : degraded
            ? "Can't confirm route – data source unavailable"
            : 'Verification required – potential issue detected',
      summary: verdict === 'READY'
        ? `No disruptions found on ${distance}km route.`
        : verdict === 'HOLD'
          ? `${issueCount} blocking ${issueCount === 1 ? 'issue' : 'issues'} detected on permitted route.`
          : degraded
            ? 'The Autobahn data source is temporarily unavailable. Retry or verify manually.'
            : `${evidence.length} item${evidence.length === 1 ? '' : 's'} require verification.`,
      impact: `Selected vehicle: ${vehicle.width.toFixed(2)}m W × ${vehicle.height.toFixed(2)}m H × ${vehicle.length.toFixed(1)}m L · ${vehicle.grossWeight}t${degraded ? '. Data source unavailable – cannot confirm route is clear.' : ''}`,
      confidence,
      issueCount,
      evidence,
      route: {
        coordinates: routePoints.map(p => [p.lat, p.lng]),
        origin,
        destination,
        distance,
        corridor: `±5km corridor (${distance}km route)`,
      },
      degraded,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Route check error:', error);
    
    // Return degraded VERIFY verdict instead of 500
    return res.status(200).json({
      verdict: 'VERIFY',
      title: "Can't confirm route – check failed",
      summary: 'An error occurred while checking the route. Please verify manually or retry.',
      impact: 'Unable to complete automated route check due to technical error.',
      confidence: 'medium',
      issueCount: 0,
      evidence: [{
        id: 'system-error',
        title: 'Route check system error',
        detail: error instanceof Error ? error.message : 'Unknown error occurred',
        source: 'Route check system',
        age: 'Just now',
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
      }],
      route: {
        coordinates: [],
        origin: 'Unknown',
        destination: 'Unknown',
        distance: 0,
        corridor: 'Unknown',
      },
      degraded: true,
    });
  }
}
