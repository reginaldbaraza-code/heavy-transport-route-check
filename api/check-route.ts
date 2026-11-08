import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as turf from '@turf/turf';
import { parseStringPromise } from 'xml2js';

export const config = {
  maxDuration: 60,
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
    const parsed = await parseStringPromise(gpxContent, {
      explicitArray: false,
      mergeAttrs: true,
    });

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
    throw new Error(`Invalid GPX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

function extractWidthRestriction(description: string): number | null {
  // Look for patterns like "3.5 m", "3,5m", "width 3.5"
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
  
  // Check for width restrictions
  const widthRestriction = extractWidthRestriction(description);
  if (widthRestriction && vehicle.width > widthRestriction) {
    return { exceeds: true, restriction: widthRestriction, type: 'width' };
  }
  
  // Check for blocked lanes
  if (event.isBlocked && event.isBlocked.length > 0) {
    const blockedText = event.isBlocked.join(' ').toLowerCase();
    if (blockedText.includes('all') || blockedText.includes('alle')) {
      return { exceeds: true, type: 'full closure' };
    }
  }
  
  return { exceeds: false };
}

async function fetchAutobahnEvents(): Promise<any> {
  try {
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/autobahn-events`, {
      signal: AbortSignal.timeout(25000),
    });
    
    if (!response.ok) {
      throw new Error(`Events API returned ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Autobahn events:', error);
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
  // Set CORS headers
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
      return res.status(400).json({ error: 'GPX content is required' });
    }

    if (!vehicle || typeof vehicle.width !== 'number') {
      return res.status(400).json({ error: 'Valid vehicle dimensions are required' });
    }

    // Parse GPX
    const routePoints = await parseGPX(gpxContent);
    
    // Calculate route properties
    const distance = calculateRouteDistance(routePoints);
    const origin = routePoints[0].name || 'Start';
    const destination = routePoints[routePoints.length - 1].name || 'End';
    
    // Create corridor buffer (5km on each side)
    const corridor = createRouteCorridor(routePoints, 5);
    
    // Fetch live Autobahn events
    const autobahnData = await fetchAutobahnEvents();
    const degraded = !autobahnData || !autobahnData.source.includes('verkehr.autobahn.de');
    
    const evidence: RouteEvidence[] = [];
    
    if (autobahnData) {
      // Check roadworks
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
              source: 'Autobahn GmbH roadworks feed',
              age: event.age || 'Unknown',
              confidence: 'high',
              state: 'danger',
              category: 'roadworks',
              lat: event.lat,
              lng: event.lng,
            });
          } else {
            evidence.push({
              id: event.id,
              title: event.title,
              detail: event.description,
              source: 'Autobahn GmbH roadworks feed',
              age: event.age || 'Unknown',
              confidence: 'high',
              state: event.severity === 'warning' ? 'warning' : 'clear',
              category: 'roadworks',
              lat: event.lat,
              lng: event.lng,
            });
          }
        }
      }

      // Check closures
      for (const event of autobahnData.closures || []) {
        if (checkIntersection(corridor, event.lat, event.lng)) {
          evidence.push({
            id: event.id,
            title: 'Full closure on permitted route',
            detail: event.description,
            source: 'Autobahn GmbH traffic feed',
            age: event.age || 'Unknown',
            confidence: 'high',
            state: 'danger',
            category: 'closures',
            lat: event.lat,
            lng: event.lng,
          });
        }
      }

      // Check warnings
      for (const event of autobahnData.warnings || []) {
        if (checkIntersection(corridor, event.lat, event.lng)) {
          evidence.push({
            id: event.id,
            title: event.title,
            detail: event.description,
            source: 'Autobahn GmbH warning feed',
            age: event.age || 'Unknown',
            confidence: 'medium',
            state: 'warning',
            category: 'roadworks',
            lat: event.lat,
            lng: event.lng,
          });
        }
      }
    }

    // If no issues found and not degraded, add a "clear" evidence item
    if (evidence.length === 0 && !degraded) {
      evidence.push({
        id: 'route-clear',
        title: 'No active roadworks or closures',
        detail: 'All checked sources show no disruptions on the permitted route corridor.',
        source: 'Autobahn GmbH feeds',
        age: autobahnData?.cachedAt ? new Date(autobahnData.cachedAt).toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }) : 'Unknown',
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
            ? 'Can't confirm route – data source unavailable'
            : 'Verification required – potential issue detected',
      summary: verdict === 'READY'
        ? `No disruptions found on ${distance}km route.`
        : verdict === 'HOLD'
          ? `${issueCount} blocking ${issueCount === 1 ? 'issue' : 'issues'} detected on permitted route.`
          : degraded
            ? 'The Autobahn data source is temporarily unavailable.'
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
    
    if (error instanceof Error && error.message.includes('Invalid GPX')) {
      return res.status(400).json({ 
        error: error.message,
        hint: 'Please upload a valid GPX file with track points containing latitude and longitude coordinates.',
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to check route',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
