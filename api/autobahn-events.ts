import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  eventFreshness,
  evidenceAgeLabel,
  isoNow,
} from './_lib/autobahnTimes';

export const config = {
  maxDuration: 30,
};

type AutobahnEvent = {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  type: 'roadworks' | 'closures' | 'warnings';
  severity: 'danger' | 'warning' | 'info';
  timestamp?: string | null;
  startTimestamp?: string | null;
  endTimestamp?: string | null;
  retrievedAt: string;
  age: string;
  confidence: 'high' | 'medium';
  longRunning?: boolean;
};

type AutobahnEventsResponse = {
  roadworks: AutobahnEvent[];
  closures: AutobahnEvent[];
  warnings: AutobahnEvent[];
  cachedAt: string;
  retrievedAt: string;
  source: string;
  roads?: string[];
};

const AUTOBAHN_API_BASE = 'https://verkehr.autobahn.de/o/autobahn';
const CACHE_DURATION_MS = 5 * 60 * 1000;

let cachedResponse: { data: AutobahnEventsResponse; timestamp: number } | null = null;

function normalizeDescription(parts: any[]): string {
  if (!parts || parts.length === 0) return '';
  
  // Join array parts
  let text = parts.filter(Boolean).join(' · ');
  
  // Fix single-character artifact pattern (e.g. "S · a · a · r · b · r · ü · c · k")
  // Pattern: single char + space + · + space, repeated
  const singleCharPattern = /([a-zA-ZäöüßÄÖÜ])\s*·\s*(?=[a-zA-ZäöüßÄÖÜ]\s*·|[a-zA-ZäöüßÄÖÜ]$)/g;
  
  // First check if this looks like the artifact pattern
  const matches = text.match(singleCharPattern);
  if (matches && matches.length > 3) {
    // Likely an artifact, remove all the separators between single characters
    text = text.replace(/([a-zA-ZäöüßÄÖÜ])\s*·\s*/g, '$1');
  }
  
  // Clean up multiple consecutive separators
  text = text.replace(/\s*·\s*·\s*/g, ' · ');
  
  // Trim
  text = text.trim();
  
  return text || 'Event in progress';
}

function mapAutobahnEvent(
  item: any,
  fallbackTitle: string,
  fallbackDescription: string,
  retrievedAt: string,
  confidence: 'high' | 'medium',
): AutobahnEvent & { expired: boolean } {
  const freshness = eventFreshness({
    startTimestamp: item.startTimestamp,
    endTimestamp: item.endTimestamp,
    description: item.description,
    retrievedAt,
  });
  return {
    id: item.identifier || `evt-${Date.now()}-${Math.random()}`,
    title: freshness.longRunning ? `${item.title || fallbackTitle} (long-running / verify on site)` : (item.title || fallbackTitle),
    description: normalizeDescription([
      ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
      ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : []),
    ]) || fallbackDescription,
    lat: parseFloat(item.coordinate?.lat),
    lng: parseFloat(item.coordinate?.long),
    type: 'roadworks',
    severity: 'info',
    timestamp: freshness.startTimestamp,
    startTimestamp: freshness.startTimestamp,
    endTimestamp: freshness.endTimestamp,
    retrievedAt: freshness.retrievedAt,
    age: evidenceAgeLabel(freshness),
    confidence: freshness.longRunning ? 'medium' : confidence,
    longRunning: freshness.longRunning,
    expired: freshness.expired,
  };
}

async function fetchRoadEvents(road: string, type: 'roadworks' | 'closure' | 'warning'): Promise<any[]> {
  try {
    const response = await fetch(
      `${AUTOBAHN_API_BASE}/${road}/services/${type}`,
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

function isUsableEvent(item: AutobahnEvent & { expired?: boolean }) {
  return !Number.isNaN(item.lat) && !Number.isNaN(item.lng) && !item.expired;
}

async function fetchAutobahnEvents(roads?: string[]): Promise<AutobahnEventsResponse> {
  const now = Date.now();
  const retrievedAt = isoNow();
  
  // Return cached data if still valid and no specific roads requested
  if (!roads && cachedResponse && (now - cachedResponse.timestamp < CACHE_DURATION_MS)) {
    return cachedResponse.data;
  }

  try {
    // If specific roads requested, use those; otherwise get main routes
    const roadsToFetch = roads || ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
    
    const allEvents = await Promise.all(
      roadsToFetch.slice(0, 15).map(async (road) => {
        const [roadworks, closures, warnings] = await Promise.all([
          fetchRoadEvents(road, 'roadworks'),
          fetchRoadEvents(road, 'closure'),
          fetchRoadEvents(road, 'warning'),
        ]);
        
        return { road, roadworks, closures, warnings };
      })
    );

    const processedRoadworks: AutobahnEvent[] = allEvents.flatMap(({ roadworks }) =>
      roadworks.map((item: any) => {
        const mapped = mapAutobahnEvent(item, 'Roadworks', 'Roadworks in progress', retrievedAt, 'high');
        mapped.type = 'roadworks';
        mapped.severity = item.isBlocked?.length ? 'warning' : 'info';
        return mapped;
      })
    ).filter(isUsableEvent);

    const processedClosures: AutobahnEvent[] = allEvents.flatMap(({ closures }) =>
      closures.map((item: any) => {
        const mapped = mapAutobahnEvent(item, 'Closure', 'Road closure in effect', retrievedAt, 'high');
        mapped.type = 'closures';
        mapped.severity = 'danger';
        return mapped;
      })
    ).filter(isUsableEvent);

    const processedWarnings: AutobahnEvent[] = allEvents.flatMap(({ warnings }) =>
      warnings.map((item: any) => {
        const mapped = mapAutobahnEvent(item, 'Warning', 'Traffic warning', retrievedAt, 'medium');
        mapped.type = 'warnings';
        mapped.severity = 'warning';
        return mapped;
      })
    ).filter(isUsableEvent);

    const response: AutobahnEventsResponse = {
      roadworks: processedRoadworks,
      closures: processedClosures,
      warnings: processedWarnings,
      cachedAt: retrievedAt,
      retrievedAt,
      source: 'Autobahn GmbH (verkehr.autobahn.de)',
      roads: roadsToFetch,
    };

    // Cache the response only for full queries
    if (!roads) {
      cachedResponse = {
        data: response,
        timestamp: now,
      };
    }

    return response;
  } catch (error) {
    console.error('Error fetching Autobahn events:', error);
    
    if (cachedResponse) {
      return cachedResponse.data;
    }
    
    return {
      roadworks: [],
      closures: [],
      warnings: [],
      cachedAt: isoNow(),
      retrievedAt: isoNow(),
      source: 'Autobahn GmbH (verkehr.autobahn.de) - Service unavailable',
    };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Support roads query param
    const roadsParam = req.query.roads as string | undefined;
    const roads = roadsParam ? roadsParam.split(',').map(r => r.trim()) : undefined;
    
    const events = await fetchAutobahnEvents(roads);
    
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    
    return res.status(200).json(events);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Autobahn events',
      roadworks: [],
      closures: [],
      warnings: [],
      cachedAt: isoNow(),
      retrievedAt: isoNow(),
      source: 'Error',
    });
  }
}
