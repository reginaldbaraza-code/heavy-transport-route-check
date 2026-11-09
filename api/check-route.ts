import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as turf from '@turf/turf';
import xml2js from 'xml2js';
import {
  descriptionFromAutobahnItem,
  eventFreshness,
  evidenceAgeLabel,
  isoNow,
} from './_lib/autobahnTimes.js';

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
  startTimestamp?: string | null;
  endTimestamp?: string | null;
  retrievedAt?: string;
  longRunning?: boolean;
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
  retrievedAt: string;
  source: string;
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

function processAutobahnItem(
  item: any,
  fallbackTitle: string,
  fallbackDescription: string,
  retrievedAt: string,
) {
  const lat = parseFloat(String(item.coordinate?.lat || ''));
  const lng = parseFloat(String(item.coordinate?.long || ''));
  const freshness = eventFreshness({
    startTimestamp: item.startTimestamp,
    endTimestamp: item.endTimestamp,
    description: item.description,
    retrievedAt,
  });

  return {
    id: item.identifier || `evt-${Date.now()}-${Math.random()}`,
    title: item.title || fallbackTitle,
    description: descriptionFromAutobahnItem(item) || fallbackDescription,
    lat,
    lng,
    extent: String(item.extent || ''),
    isBlocked: String(item.isBlocked) === 'true',
    timestamp: freshness.startTimestamp,
    startTimestamp: freshness.startTimestamp,
    endTimestamp: freshness.endTimestamp,
    retrievedAt: freshness.retrievedAt,
    age: evidenceAgeLabel(freshness),
    longRunning: freshness.longRunning,
    expired: freshness.expired,
    confidence: (freshness.longRunning ? 'medium' : 'high') as 'high' | 'medium',
    freshness,
  };
}

function isUsableEvent(item: { lat: number; lng: number; expired: boolean }) {
  return !Number.isNaN(item.lat) && !Number.isNaN(item.lng) && !item.expired;
}

async function fetchAutobahnEventsForRoute(roads: string[], retrievedAt: string): Promise<any> {
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
      roadworks.map((item: any) => {
        const processed = processAutobahnItem(item, 'Roadworks', 'Roadworks in progress', retrievedAt);
        const isBlocked = processed.isBlocked;
        return {
          ...processed,
          type: 'roadworks' as const,
          severity: isBlocked ? 'warning' as const : 'info' as const,
          isBlocked,
        };
      })
    ).filter(isUsableEvent);

    const processedClosures = allEvents.flatMap(({ closures }) =>
      closures.map((item: any) => ({
        ...processAutobahnItem(item, 'Closure', 'Road closure in effect', retrievedAt),
        type: 'closures' as const,
        severity: 'danger' as const,
      }))
    ).filter(isUsableEvent);

    const processedWarnings = allEvents.flatMap(({ warnings }) =>
      warnings.map((item: any) => ({
        ...processAutobahnItem(item, 'Warning', 'Traffic warning', retrievedAt),
        type: 'warnings' as const,
        severity: 'warning' as const,
        confidence: 'medium' as const,
      }))
    ).filter(isUsableEvent);

    return {
      roadworks: processedRoadworks,
      closures: processedClosures,
      warnings: processedWarnings,
      source: 'Autobahn GmbH (verkehr.autobahn.de)',
      roads: roads.join(', '),
      retrievedAt,
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
  // Unknown bridge/clearance data must never yield READY.
  if (degraded) {
    return { verdict: 'VERIFY', confidence: 'medium' };
  }

  const dangerItems = evidence.filter(e => e.state === 'danger');
  if (dangerItems.length > 0) {
    return { verdict: 'HOLD', confidence: 'high' };
  }

  return { verdict: 'VERIFY', confidence: 'medium' };
}

function timestampFields(event: {
  startTimestamp?: string | null;
  endTimestamp?: string | null;
  retrievedAt?: string;
  longRunning?: boolean;
  age?: string;
  confidence?: 'high' | 'medium';
}) {
  return {
    startTimestamp: event.startTimestamp ?? null,
    endTimestamp: event.endTimestamp ?? null,
    retrievedAt: event.retrievedAt,
    longRunning: Boolean(event.longRunning),
    age: event.age || evidenceAgeLabel({
      startTimestamp: event.startTimestamp ?? null,
      endTimestamp: event.endTimestamp ?? null,
      retrievedAt: event.retrievedAt || isoNow(),
      expired: false,
      longRunning: Boolean(event.longRunning),
    }),
    confidence: (event.longRunning ? 'medium' : event.confidence || 'high') as 'high' | 'medium',
  };
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

    const retrievedAt = isoNow();
    const autobahnData = await fetchAutobahnEventsForRoute(affectedRoads, retrievedAt);
    const degraded = !autobahnData;
    const source = 'Autobahn GmbH';
    
    const evidence: RouteEvidence[] = [];
    
    if (autobahnData) {
      for (const event of autobahnData.roadworks || []) {
        if (checkIntersection(corridor, event.lat, event.lng)) {
          const vehicleCheck = checkVehicleAgainstEvent(event, vehicle);
          const stamps = timestampFields(event);
          
          if (vehicleCheck.exceeds) {
            evidence.push({
              id: event.id,
              title: vehicleCheck.type === 'width' 
                ? `Width restriction ${vehicleCheck.restriction}m – vehicle exceeds`
                : 'Roadworks blocking route',
              detail: event.longRunning
                ? `${event.description} Long-running / verify on site.`
                : event.description,
              source: `Autobahn GmbH · ${autobahnData.roads}`,
              ...stamps,
              state: 'danger',
              category: 'roadworks',
              lat: event.lat,
              lng: event.lng,
            });
          } else if (event.severity === 'warning' || event.longRunning) {
            evidence.push({
              id: event.id,
              title: event.longRunning ? `${event.title} (long-running / verify on site)` : event.title,
              detail: event.longRunning
                ? `${event.description} This item started more than 90 days ago and has no published end date.`
                : event.description,
              source: `Autobahn GmbH · ${autobahnData.roads}`,
              ...stamps,
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
            title: event.longRunning ? 'Long-running closure – verify on site' : 'Full closure on permitted route',
            detail: event.description,
            source: `Autobahn GmbH · ${autobahnData.roads}`,
            ...timestampFields(event),
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
            title: event.longRunning ? `${event.title} (long-running / verify on site)` : event.title,
            detail: event.description,
            source: `Autobahn GmbH · ${autobahnData.roads}`,
            ...timestampFields({ ...event, confidence: 'medium' }),
            state: 'warning',
            category: 'roadworks',
            lat: event.lat,
            lng: event.lng,
          });
        }
      }
    }

    if (!degraded && !evidence.some(item => item.category === 'roadworks' || item.category === 'closures')) {
      evidence.push({
        id: 'route-clear',
        title: 'No active Autobahn roadworks or closures on corridor',
        detail: `Checked Autobahn routes (${autobahnData?.roads || 'none'}) show no current disruptions on the permitted corridor. Bridge and clearance data are still unavailable.`,
        source: `Autobahn GmbH · retrieved ${retrievedAt}`,
        ...timestampFields({ retrievedAt, confidence: 'high' }),
        state: 'clear',
        category: 'roadworks',
      });
    }

    evidence.push({
      id: 'bridge-clearance-unknown',
      title: 'Bridge and clearance data not available',
      detail: 'This check does not include verified bridge heights or local clearance limits. Unknown clearance data cannot yield READY — confirm on site before departure.',
      source: 'Route check system',
      ...timestampFields({ retrievedAt, confidence: 'medium' }),
      state: 'warning',
      category: 'observations',
    });

    // Deduplicate evidence by ID (same event shouldn't appear twice)
    const uniqueEvidence = Array.from(
      new Map(evidence.map(item => [item.id, item])).values()
    );
    
    const { verdict, confidence } = determineVerdict(uniqueEvidence, degraded);
    const issueCount = uniqueEvidence.filter(e => e.state === 'danger').length;
    const hasCorridorIssues = uniqueEvidence.some(item => item.state === 'danger' || (item.state === 'warning' && item.id !== 'bridge-clearance-unknown'));

    const result: RouteCheckResult = {
      verdict,
      title: verdict === 'HOLD'
        ? 'Hold departure – blocking issue on route'
        : degraded
          ? "Can't confirm route – data source unavailable"
          : hasCorridorIssues
            ? 'Verification required – potential issue detected'
            : 'Verification required – bridge and clearance data unavailable',
      summary: verdict === 'HOLD'
        ? `${issueCount} blocking ${issueCount === 1 ? 'issue' : 'issues'} detected on permitted route.`
        : degraded
          ? 'The Autobahn data source is temporarily unavailable. Retry or verify manually.'
          : hasCorridorIssues
            ? `${uniqueEvidence.length} item${uniqueEvidence.length === 1 ? '' : 's'} require verification.`
            : `No Autobahn disruptions found on ${distance}km route, but bridge and clearance data are unknown.`,
      impact: `Selected vehicle: ${vehicle.width.toFixed(2)}m W × ${vehicle.height.toFixed(2)}m H × ${vehicle.length.toFixed(1)}m L · ${vehicle.grossWeight}t${degraded ? '. Data source unavailable – cannot confirm route is clear.' : '. Unknown bridge/clearance data cannot yield READY.'}`,
      confidence,
      issueCount,
      evidence: uniqueEvidence,
      route: {
        coordinates: routePoints.map(p => [p.lat, p.lng]),
        origin,
        destination,
        distance,
        corridor: `±5km corridor (${distance}km route)`,
      },
      degraded,
      retrievedAt,
      source,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Route check error:', error);
    
    // Try to preserve route geometry even if check failed
    let fallbackRoute;
    try {
      const fallbackGpx = typeof req.body?.gpxContent === 'string' ? req.body.gpxContent : ''
      const points = await parseGPX(fallbackGpx);
      const distance = calculateRouteDistance(points);
      const origin = points[0]?.name || `${points[0]?.lat.toFixed(4)}, ${points[0]?.lng.toFixed(4)}`;
      const destination = points[points.length - 1]?.name || `${points[points.length - 1]?.lat.toFixed(4)}, ${points[points.length - 1]?.lng.toFixed(4)}`;
      
      fallbackRoute = {
        coordinates: points.map(p => [p.lat, p.lng]),
        origin,
        destination,
        distance,
        corridor: `±5km corridor (${distance}km route)`,
      };
    } catch {
      fallbackRoute = {
        coordinates: [],
        origin: 'Unknown',
        destination: 'Unknown',
        distance: 0,
        corridor: 'Unable to parse route',
      };
    }
    
    const retrievedAt = isoNow();
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
        age: evidenceAgeLabel({ startTimestamp: null, endTimestamp: null, retrievedAt, expired: false, longRunning: false }),
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
        retrievedAt,
      }],
      route: fallbackRoute,
      degraded: true,
      retrievedAt,
      source: 'Route check system',
    });
  }
}
