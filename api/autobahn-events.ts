import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  timestamp?: string;
  age: string;
  confidence: 'high' | 'medium';
};

type AutobahnEventsResponse = {
  roadworks: AutobahnEvent[];
  closures: AutobahnEvent[];
  warnings: AutobahnEvent[];
  cachedAt: string;
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

function calculateAge(timestamp?: string, fetchTime?: Date): string {
  const now = fetchTime || new Date();
  
  if (!timestamp) {
    return `Updated ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  try {
    const eventTime = new Date(timestamp);
    if (isNaN(eventTime.getTime())) {
      return `Updated ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const diffMs = now.getTime() - eventTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  } catch {
    return `Updated ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  }
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

async function fetchAutobahnEvents(roads?: string[]): Promise<AutobahnEventsResponse> {
  const now = Date.now();
  const fetchTime = new Date();
  
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
      roadworks.map((item: any) => ({
        id: item.identifier || `rw-${Date.now()}-${Math.random()}`,
        title: item.title || 'Roadworks',
        description: normalizeDescription([
          ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
          ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : [])
        ]),
        lat: parseFloat(item.coordinate?.lat),
        lng: parseFloat(item.coordinate?.long),
        type: 'roadworks' as const,
        severity: item.isBlocked?.length ? 'warning' as const : 'info' as const,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp, fetchTime),
        confidence: 'high' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    const processedClosures: AutobahnEvent[] = allEvents.flatMap(({ closures }) =>
      closures.map((item: any) => ({
        id: item.identifier || `cl-${Date.now()}-${Math.random()}`,
        title: item.title || 'Closure',
        description: normalizeDescription([
          ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
          ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : [])
        ]),
        lat: parseFloat(item.coordinate?.lat),
        lng: parseFloat(item.coordinate?.long),
        type: 'closures' as const,
        severity: 'danger' as const,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp, fetchTime),
        confidence: 'high' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    const processedWarnings: AutobahnEvent[] = allEvents.flatMap(({ warnings }) =>
      warnings.map((item: any) => ({
        id: item.identifier || `wn-${Date.now()}-${Math.random()}`,
        title: item.title || 'Warning',
        description: normalizeDescription([
          ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
          ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : [])
        ]),
        lat: parseFloat(item.coordinate?.lat),
        lng: parseFloat(item.coordinate?.long),
        type: 'warnings' as const,
        severity: 'warning' as const,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp, fetchTime),
        confidence: 'medium' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    const response: AutobahnEventsResponse = {
      roadworks: processedRoadworks,
      closures: processedClosures,
      warnings: processedWarnings,
      cachedAt: new Date().toISOString(),
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
      cachedAt: new Date().toISOString(),
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
      cachedAt: new Date().toISOString(),
      source: 'Error',
    });
  }
}
