import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  descriptionFromAutobahnItem,
  eventFreshness,
  evidenceAgeLabel,
  isoNow,
  splitConcatenatedPlaces,
} from './_lib/autobahnTimes.js';
import {
  fetchAutobahnRoadFeeds,
  formatAutobahnFailureDetail,
  summarizeAutobahnFetchHealth,
  type AutobahnFetchHealth,
} from './_lib/autobahnFetch.js';
import { determineAffectedRoads } from './_lib/affectedRoads.js';
import { prepareRouteGeometry } from './_lib/corridor.js';
import { GpxParseError, parseGpxDocument } from './_lib/gpxParse.js';
import { guardApi, rejectOversizedBody } from './_lib/httpGuard.js';
import {
  BW_SOURCE,
  MIA_SOURCE,
  fetchBwRoadworks,
  miaSnapshotAgeMs,
  resolveMiaSnapshot,
  type BwRoadwork,
} from './_lib/openRoadworks.js';
import { MIA_STALE_HOURS } from './_lib/mobidata.js';
import { isScenarioId, SCENARIOS } from './_lib/scenarios.js';
import {
  classifyCandidate,
  dedupeClassified,
  departureWindow,
  determineVerdict,
  inferPermittedRoads,
  routeBearingDegrees,
  routeLineFromPoints,
  verdictCopy,
  type CandidateInput,
  type ClassifiedEvidence,
  type SiteAcknowledgement,
} from './_lib/verdict.js';

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
  state: 'clear' | 'info' | 'warning' | 'danger';
  category: 'roadworks' | 'closures' | 'observations';
  lat?: number;
  lng?: number;
  startTimestamp?: string | null;
  endTimestamp?: string | null;
  retrievedAt?: string;
  longRunning?: boolean;
  distanceKm?: number | null;
  reason?: string;
  locationKind?: string;
  blocker?: boolean;
  travelDirection?: string;
  relatedRecords?: Array<{ id: string; title: string }>;
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
  /** True when some Autobahn feeds succeeded and others failed. */
  degradedPartial?: boolean;
  retrievedAt: string;
  source: string;
  mode?: 'live' | 'simulated';
  clearanceConfirmed?: boolean;
};

function waypointLabel(point?: GPXPoint): string {
  const name = String(point?.name || '').trim()
  if (!point || !name || /^(starts?|end|ende|ziel)$/i.test(name)) {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return 'Unknown'
    return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`
  }
  return name
}

/** Prefer GPX track endpoint / metadata names so custom uploads match sample-permit direction. */
function inferTravelFromTrack(
  points: GPXPoint[],
  gpxContent: string,
): { from?: string; to?: string } {
  const startName = String(points[0]?.name || '').trim()
  const endName = String(points[points.length - 1]?.name || '').trim()
  if (startName && endName && !/^(starts?|end|ende|ziel)$/i.test(startName) && !/^(starts?|end|ende|ziel)$/i.test(endName)) {
    return { from: startName, to: endName }
  }
  const arrow = gpxContent.match(
    /<name>\s*([A-Za-zÄÖÜäöüß][^<]*?)\s*(?:→|->|⇒)\s*([A-Za-zÄÖÜäöüß][^<]*?)\s*<\/name>/i,
  )
  if (arrow) {
    return {
      from: arrow[1].replace(/\s+A\d+\s*$/i, '').trim(),
      to: arrow[2].replace(/\s+A\d+\s*$/i, '').trim(),
    }
  }
  return {
    from: startName || undefined,
    to: endName || undefined,
  }
}

function uniqueRoads(roads: string[]): string[] {
  return [...new Set(roads.map(road => road.toUpperCase().replace(/\s+/g, '')).filter(Boolean))]
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
    title: splitConcatenatedPlaces(item.title || fallbackTitle),
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

async function fetchAutobahnEventsForRoute(
  roads: string[],
  retrievedAt: string,
): Promise<{
  roadworks: any[]
  closures: any[]
  warnings: any[]
  parking: any[]
  source: string
  roads: string
  retrievedAt: string
  health: AutobahnFetchHealth
} | null> {
  try {
    const unique = uniqueRoads(roads)
    const allEvents = await Promise.all(unique.map(road => fetchAutobahnRoadFeeds(road)))
    const health = summarizeAutobahnFetchHealth(allEvents)

    const processedRoadworks = allEvents.flatMap(({ road, roadworks }) =>
      roadworks.map((item: any) => {
        const processed = processAutobahnItem(item, 'Roadworks', 'Roadworks in progress', retrievedAt);
        const isBlocked = processed.isBlocked;
        return {
          ...processed,
          road,
          type: 'roadworks' as const,
          severity: isBlocked ? 'warning' as const : 'info' as const,
          isBlocked,
        };
      })
    ).filter(isUsableEvent);

    const processedClosures = allEvents.flatMap(({ road, closures }) =>
      closures.map((item: any) => ({
        ...processAutobahnItem(item, 'Closure', 'Road closure in effect', retrievedAt),
        road,
        type: 'closures' as const,
        severity: 'danger' as const,
      }))
    ).filter(isUsableEvent);

    const processedWarnings = allEvents.flatMap(({ road, warnings }) =>
      warnings.map((item: any) => ({
        ...processAutobahnItem(item, 'Warning', 'Traffic warning', retrievedAt),
        road,
        type: 'warnings' as const,
        severity: 'warning' as const,
        confidence: 'medium' as const,
      }))
    ).filter(isUsableEvent);

    const processedParking = allEvents.flatMap(({ road, parking }) =>
      parking.map((item: any) => ({
        ...processAutobahnItem(item, 'Lorry parking', 'HGV parking on this Autobahn', retrievedAt),
        road,
        type: 'parking' as const,
        severity: String(item.isBlocked) === 'true' ? 'warning' as const : 'info' as const,
        isBlocked: String(item.isBlocked) === 'true',
        subtitle: Array.isArray(item.subtitle) ? item.subtitle.map(String).join(' / ') : String(item.subtitle || ''),
      }))
    ).filter(isUsableEvent);

    return {
      roadworks: processedRoadworks,
      closures: processedClosures,
      warnings: processedWarnings,
      parking: processedParking,
      source: health.degraded
        ? 'Autobahn GmbH (verkehr.autobahn.de) – degraded'
        : 'Autobahn GmbH (verkehr.autobahn.de)',
      roads: roads.join(', '),
      retrievedAt,
      health,
    };
  } catch (error) {
    console.error('Error fetching Autobahn events:', error);
    return null;
  }
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

function toRouteEvidence(item: ClassifiedEvidence, age: string): RouteEvidence {
  return {
    id: item.id,
    title: splitConcatenatedPlaces(item.title),
    detail: splitConcatenatedPlaces(item.detail),
    source: item.source,
    age,
    confidence: item.confidence,
    state: item.state,
    category: item.category,
    lat: item.lat,
    lng: item.lng,
    startTimestamp: item.startTimestamp,
    endTimestamp: item.endTimestamp,
    retrievedAt: item.retrievedAt,
    longRunning: item.longRunning,
    distanceKm: item.distanceKm,
    reason: item.reason,
    locationKind: item.locationKind,
    blocker: item.blocker,
    travelDirection: item.travelDirection,
    relatedRecords: item.relatedRecords,
  };
}

function pushClassified(
  collected: ClassifiedEvidence[],
  input: CandidateInput,
  ctx: Parameters<typeof classifyCandidate>[1],
) {
  const item = classifyCandidate(input, ctx);
  if (item) collected.push(item);
}

function parseAcknowledgements(value: unknown): SiteAcknowledgement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { evidenceId?: unknown; acknowledgedBy?: unknown; acknowledgedAt?: unknown };
    if (typeof row.evidenceId !== 'string' || !row.evidenceId) return [];
    return [{
      evidenceId: row.evidenceId,
      acknowledgedBy: typeof row.acknowledgedBy === 'string' ? row.acknowledgedBy : 'Dispatcher',
      acknowledgedAt: typeof row.acknowledgedAt === 'string' ? row.acknowledgedAt : isoNow(),
    }];
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!guardApi(req, res, 'POST, OPTIONS')) return
  if (!rejectOversizedBody(req, res)) return

  try {
    const {
      gpxContent,
      vehicle,
      permitNumber,
      permittedRoads: requestedRoads,
      corridor: requestedCorridor,
      departureStart,
      departureEnd,
      validFrom,
      validUntil,
      bridgeClearanceConfirmed,
      clearanceConfirmedBy,
      confirmedAt,
      scenario,
      acknowledgements,
      travelFrom,
      travelTo,
    } = req.body;

    const gpxBytes = typeof gpxContent === 'string' ? Buffer.byteLength(gpxContent, 'utf8') : 0
    if (!rejectOversizedBody(req, res, gpxBytes)) return

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

    let parsedPoints: GPXPoint[];
    try {
      parsedPoints = parseGpxDocument(gpxContent, { downsample: false, maxBytes: 5 * 1024 * 1024 }).points;
    } catch (parseError) {
      const technical = parseError instanceof GpxParseError ? parseError.technical : ''
      return res.status(400).json({ 
        error: parseError instanceof Error ? parseError.message : 'Invalid GPX file',
        hint: 'Please upload a valid GPX file with track points containing latitude and longitude coordinates.',
        technical,
      });
    }

    const geometry = prepareRouteGeometry(parsedPoints)
    const routePoints = geometry.drawPoints
    const distance = geometry.distanceKm
    const origin = waypointLabel(parsedPoints[0] || routePoints[0]);
    const destination = waypointLabel(parsedPoints[parsedPoints.length - 1] || routePoints[routePoints.length - 1]);
    
    const routeLine = routeLineFromPoints(geometry.matchPoints);
    const permittedRoads = inferPermittedRoads(
      requestedCorridor,
      Array.isArray(requestedRoads) ? requestedRoads : [],
    );
    const detectedRoads = uniqueRoads(determineAffectedRoads(geometry.matchPoints));
    // Never invent a fallback motorway when geometry cannot identify one.
    const corridorUndetected = !permittedRoads.length && detectedRoads.length === 0;
    const affectedRoads = permittedRoads.length ? uniqueRoads(permittedRoads) : detectedRoads;
    // GPX uploads without a corridor must still classify against the inferred Autobahn set so the same geometry matches sample-permit verdicts.
    const classifyRoads = permittedRoads.length ? uniqueRoads(permittedRoads) : affectedRoads;
    const window = departureWindow({
      departureStart,
      departureEnd,
      validFrom,
      validUntil,
    });
    const trackTravel = inferTravelFromTrack(parsedPoints, gpxContent)
    const classifyCtx = {
      routeLine,
      corridor: geometry.corridor,
      permittedRoads: classifyRoads,
      vehicle,
      windowStartMs: window.startMs,
      windowEndMs: window.endMs,
      nowMs: Date.now(),
      // Track geometry/names first so sample permit and bare custom GPX agree.
      travelFrom: trackTravel.from || (typeof travelFrom === 'string' ? travelFrom : undefined),
      travelTo: trackTravel.to || (typeof travelTo === 'string' ? travelTo : undefined),
      routeBearing: routeBearingDegrees(routeLine),
    };
    const clearanceConfirmed = Boolean(bridgeClearanceConfirmed);
    const siteAcknowledgements = parseAcknowledgements(acknowledgements);

    if (isScenarioId(scenario)) {
      const fixture = SCENARIOS[scenario];
      const classified = fixture.evidence;
      const decided = determineVerdict(classified, {
        clearanceConfirmed: fixture.clearanceConfirmed,
        acknowledgements: siteAcknowledgements,
      });
      const copy = verdictCopy(decided.verdict, {
        issueCount: classified.filter(item => item.state === 'danger').length,
        distanceKm: distance,
        clearanceConfirmed: fixture.clearanceConfirmed,
        acknowledgedCount: decided.acknowledgedCount,
      });
      return res.status(200).json({
        verdict: decided.verdict,
        title: copy.title,
        summary: `${copy.summary} Simulated — not live data.`,
        impact: `Selected vehicle: ${fixture.vehicle.width.toFixed(2)}m W × ${fixture.vehicle.height.toFixed(2)}m H × ${fixture.vehicle.length.toFixed(1)}m L · ${fixture.vehicle.grossWeight}t. ${decided.reasons.join(' ')}`,
        confidence: decided.confidence,
        issueCount: classified.filter(item => item.state === 'danger').length,
        evidence: classified.map(item => toRouteEvidence(item, item.reason)),
        route: {
          coordinates: routePoints.map(p => [p.lat, p.lng]),
          origin: origin || fixture.origin,
          destination: destination || fixture.destination,
          distance: distance || fixture.distanceKm,
          corridor: `${fixture.corridor} · ±0.5 km HOLD / ±1.5 km VERIFY`,
        },
        degraded: false,
        retrievedAt: isoNow(),
        source: 'Simulated — not live data',
        mode: 'simulated',
        clearanceConfirmed: fixture.clearanceConfirmed,
      });
    }

    const retrievedAt = isoNow();
    const [autobahnData, bwResult, miaResult] = await Promise.all([
      corridorUndetected
        ? Promise.resolve(null)
        : fetchAutobahnEventsForRoute(affectedRoads, retrievedAt),
      fetchBwRoadworks(retrievedAt)
        .then(items => ({ items, error: null as string | null }))
        .catch((error: unknown) => ({
          items: [] as BwRoadwork[],
          error: error instanceof Error ? error.message : 'BEMaS unavailable',
        })),
      resolveMiaSnapshot(),
    ]);
    const autobahnHealth: AutobahnFetchHealth = corridorUndetected
      ? {
          degraded: true,
          partial: false,
          failures: [],
          criticalAttempted: 0,
          criticalSucceeded: 0,
        }
      : autobahnData?.health || {
          degraded: true,
          partial: false,
          failures: affectedRoads.flatMap(road =>
            (['roadworks', 'closure', 'warning'] as const).map(type => ({
              road,
              type,
              error: 'Autobahn fetch unavailable',
            })),
          ),
          criticalAttempted: affectedRoads.length * 3,
          criticalSucceeded: 0,
        };
    const degraded = corridorUndetected || !autobahnData || autobahnHealth.degraded;
    const degradedPartial = Boolean(autobahnData) && autobahnHealth.partial;
    const source = corridorUndetected
      ? 'Motorway undetected + MobiData BW'
      : degraded
        ? (degradedPartial
          ? 'Autobahn GmbH (partial) + MobiData BW'
          : 'Autobahn GmbH unavailable + MobiData BW')
        : 'Autobahn GmbH + MobiData BW';
    
    const classified: ClassifiedEvidence[] = [];
    const src = affectedRoads.length
      ? `Autobahn GmbH · ${affectedRoads.join(', ')}`
      : 'Autobahn GmbH';

    if (corridorUndetected) {
      classified.push({
        id: 'corridor-undetected',
        title: 'Motorway not detected from GPX',
        detail: 'Could not identify which Autobahn the track follows. Pass a corridor hint (e.g. A20) or verify the route manually — live Autobahn feeds were not queried.',
        source: 'Route check system',
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
        distanceKm: null,
        reason: 'Corridor undetected from geometry.',
        locationKind: 'unknown',
        blocker: false,
        retrievedAt,
      });
    }

    if (autobahnData) {
      for (const event of autobahnData.roadworks || []) {
        pushClassified(classified, {
          id: event.id,
          title: event.title,
          description: event.description,
          source: src,
          lat: event.lat,
          lng: event.lng,
          road: event.road,
          startTimestamp: event.startTimestamp,
          endTimestamp: event.endTimestamp,
          retrievedAt: event.retrievedAt,
          longRunning: event.longRunning,
          isBlocked: Boolean(event.isBlocked),
          category: 'roadworks',
        }, classifyCtx);
      }
      for (const event of autobahnData.closures || []) {
        pushClassified(classified, {
          id: event.id,
          title: event.title,
          description: event.description,
          source: src,
          lat: event.lat,
          lng: event.lng,
          road: event.road,
          startTimestamp: event.startTimestamp,
          endTimestamp: event.endTimestamp,
          retrievedAt: event.retrievedAt,
          longRunning: event.longRunning,
          isBlocked: true,
          category: 'closures',
        }, classifyCtx);
      }
      for (const event of autobahnData.warnings || []) {
        pushClassified(classified, {
          id: event.id,
          title: event.title,
          description: event.description,
          source: src,
          lat: event.lat,
          lng: event.lng,
          road: event.road,
          startTimestamp: event.startTimestamp,
          endTimestamp: event.endTimestamp,
          retrievedAt: event.retrievedAt,
          longRunning: event.longRunning,
          category: 'warnings',
        }, classifyCtx);
      }
      let parkingAdded = 0;
      for (const event of autobahnData.parking || []) {
        if (parkingAdded >= 5) break;
        const before = classified.length;
        pushClassified(classified, {
          id: event.id,
          title: event.subtitle ? `Lorry parking · ${event.subtitle}` : event.title,
          description: event.description || 'HGV parking site.',
          source: `Autobahn GmbH parking_lorry · ${affectedRoads.join(', ')}`,
          lat: event.lat,
          lng: event.lng,
          road: event.road,
          startTimestamp: event.startTimestamp,
          endTimestamp: event.endTimestamp,
          retrievedAt: event.retrievedAt,
          isBlocked: Boolean(event.isBlocked),
          category: 'parking',
        }, classifyCtx);
        if (classified.length > before) parkingAdded += 1;
      }
    }

    if (degraded && !corridorUndetected) {
      classified.push({
        id: 'autobahn-feed-unavailable',
        title: degradedPartial
          ? 'Some Autobahn GmbH feeds unavailable'
          : 'Autobahn GmbH live feeds unavailable',
        detail: formatAutobahnFailureDetail(autobahnHealth) || 'Live Autobahn source unavailable.',
        source: 'Autobahn GmbH (verkehr.autobahn.de)',
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
        distanceKm: null,
        reason: degradedPartial ? 'Partial Autobahn outage.' : 'Autobahn feed unavailable.',
        locationKind: 'unknown',
        blocker: false,
        retrievedAt,
      });
    }

    for (const item of bwResult.items) {
      pushClassified(classified, {
        id: `bw-${item.id}`,
        title: item.description || item.street || 'BW state roadworks',
        description: [item.street, item.description, item.subtype, item.type].filter(Boolean).join(' · '),
        source: BW_SOURCE,
        lat: item.lat,
        lng: item.lng,
        road: item.street,
        startTimestamp: item.start,
        endTimestamp: item.end,
        retrievedAt: item.retrievedAt,
        isBlocked: item.type === 'ROAD_CLOSED' || /ROAD_CLOSED/i.test(item.subtype || ''),
        category: 'bw',
        isBw: true,
      }, classifyCtx);
    }
    if (bwResult.error) {
      classified.push({
        id: 'bw-unavailable',
        title: 'MobiData BW BEMaS feed unavailable',
        detail: bwResult.error,
        source: BW_SOURCE,
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
        distanceKm: null,
        reason: 'BEMaS fetch failed.',
        locationKind: 'unknown',
        blocker: false,
        retrievedAt,
      });
    }

    const mia = miaResult.snapshot;
    if (!mia) {
      classified.push({
        id: 'mia-snapshot-missing',
        title: 'MIA roadworks snapshot not loaded',
        detail: miaResult.error
          ? `The compact Autobahn MIA snapshot is missing and live DATEX refresh failed (${miaResult.error}). Route checks still use the live Autobahn GmbH API.`
          : 'The compact Autobahn MIA snapshot is missing. Route checks still use the live Autobahn GmbH API.',
        source: MIA_SOURCE,
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
        distanceKm: null,
        reason: 'Snapshot file missing.',
        locationKind: 'unknown',
        blocker: false,
        retrievedAt,
      });
    } else {
      const ageHours = Math.max(0, Math.round(miaSnapshotAgeMs(mia) / 3600000));
      if (miaResult.stale) {
        classified.push({
          id: 'mia-snapshot-stale',
          title: `MIA roadworks snapshot is older than ${MIA_STALE_HOURS} hours`,
          detail: `Snapshot ${mia.snapshotAt} (${ageHours}h old).${miaResult.error ? ` Live DATEX refresh failed (${miaResult.error}).` : ''} Live Autobahn API events are still used.`,
          source: MIA_SOURCE,
          confidence: 'medium',
          state: 'warning',
          category: 'observations',
          distanceKm: null,
          reason: `Snapshot older than ${MIA_STALE_HOURS}h.`,
          locationKind: 'unknown',
          blocker: false,
          retrievedAt: mia.snapshotAt,
        });
      }
      const freshness = miaResult.live ? 'Live DATEX' : 'Snapshot';
      for (const item of mia.items) {
        pushClassified(classified, {
          id: `mia-${item.id}`,
          title: splitConcatenatedPlaces(item.description || `${item.road || 'Autobahn'} MIA roadworks`),
          description: splitConcatenatedPlaces(`${item.description} ${item.term === 'long' ? 'Long-term MIA record' : 'Short-term MIA record'} · ${freshness} ${mia.snapshotAt}`),
          source: MIA_SOURCE,
          lat: item.lat,
          lng: item.lng,
          road: item.road,
          startTimestamp: item.start,
          endTimestamp: item.end,
          retrievedAt: mia.snapshotAt,
          residualWidth: item.residualWidth,
          minLaneWidth: item.minLaneWidth,
          heightLimit: item.height,
          weightLimit: item.weight,
          management: item.management,
          category: item.management === 'roadClosed' ? 'closures' : 'roadworks',
        }, classifyCtx);
      }
    }

    let uniqueClassified = dedupeClassified(classified).sort((a, b) => {
      const rank = { danger: 0, warning: 1, info: 2, clear: 3 };
      return rank[a.state] - rank[b.state];
    });

    if (!degraded && !uniqueClassified.some(item => item.category === 'roadworks' || item.category === 'closures')) {
      uniqueClassified.push({
        id: 'route-clear',
        title: 'No active Autobahn roadworks or closures on corridor',
        detail: `Checked ${affectedRoads.join(', ')} within 1.5 km of the GPX line.`,
        source: `Autobahn GmbH · retrieved ${retrievedAt}`,
        confidence: 'high',
        state: 'clear',
        category: 'roadworks',
        distanceKm: 0,
        reason: 'No HOLD/VERIFY disruptions on the line of travel.',
        locationKind: 'mainline',
        blocker: false,
        retrievedAt,
      });
    }

    if (clearanceConfirmed) {
      uniqueClassified.push({
        id: 'bridge-clearance-confirmed',
        title: 'Bridge and clearance confirmed by dispatcher',
        detail: `${clearanceConfirmedBy || 'Dispatcher'} confirmed at ${confirmedAt || retrievedAt}.`,
        source: 'Dispatcher confirmation',
        confidence: 'high',
        state: 'clear',
        category: 'observations',
        distanceKm: null,
        reason: 'Clearance tick present.',
        locationKind: 'unknown',
        blocker: false,
        retrievedAt: confirmedAt || retrievedAt,
      });
    } else {
      uniqueClassified.push({
        id: 'bridge-clearance-unknown',
        title: 'Bridge and clearance data not available',
        detail: 'Unknown clearance cannot yield READY — confirm on site or tick dispatcher confirmation.',
        source: 'Route check system',
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
        distanceKm: null,
        reason: 'Clearance not confirmed.',
        locationKind: 'unknown',
        blocker: true,
        retrievedAt,
      });
    }

    const uniqueEvidence = uniqueClassified.map(item => {
      const stamps = timestampFields(item);
      return toRouteEvidence(item, stamps.age);
    });
    const decided = determineVerdict(uniqueClassified, {
      degraded,
      degradedReason: corridorUndetected
        ? 'Motorway not detected from GPX geometry.'
        : undefined,
      clearanceConfirmed,
      acknowledgements: siteAcknowledgements,
    });
    const issueCount = uniqueEvidence.filter(item => item.state === 'danger').length;
    const copy = verdictCopy(decided.verdict, {
      degraded,
      degradedPartial,
      corridorUndetected,
      issueCount,
      distanceKm: distance,
      clearanceConfirmed,
      acknowledgedCount: decided.acknowledgedCount,
    });

    const corridorRoads = permittedRoads.length ? permittedRoads : affectedRoads;
    const corridorLabel = corridorUndetected
      ? 'Unknown · motorway not detected from GPX · VERIFY'
      : `${corridorRoads.join(', ')} · ±0.5 km HOLD / ±1.5 km VERIFY`;

    const result: RouteCheckResult = {
      verdict: decided.verdict,
      title: copy.title,
      summary: copy.summary,
      impact: `Selected vehicle: ${vehicle.width.toFixed(2)}m W × ${vehicle.height.toFixed(2)}m H × ${vehicle.length.toFixed(1)}m L · ${vehicle.grossWeight}t. ${decided.reasons.join(' ')}`,
      confidence: decided.confidence,
      issueCount,
      evidence: uniqueEvidence,
      route: {
        coordinates: routePoints.map(p => [p.lat, p.lng]),
        origin,
        destination,
        distance,
        corridor: corridorLabel,
      },
      degraded,
      degradedPartial,
      retrievedAt,
      source,
      mode: 'live',
      clearanceConfirmed,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Route check error:', error);
    
    // Try to preserve route geometry even if check failed
    let fallbackRoute;
    try {
      const fallbackGpx = typeof req.body?.gpxContent === 'string' ? req.body.gpxContent : ''
      const points = parseGpxDocument(fallbackGpx, { downsample: false, maxBytes: 5 * 1024 * 1024 }).points;
      const fallbackGeometry = prepareRouteGeometry(points)
      const distance = fallbackGeometry.distanceKm;
      const origin = waypointLabel(points[0]);
      const destination = waypointLabel(points[points.length - 1]);
      
      fallbackRoute = {
        coordinates: fallbackGeometry.drawPoints.map(p => [p.lat, p.lng]),
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
