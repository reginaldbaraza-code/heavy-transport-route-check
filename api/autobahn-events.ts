import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 30,
};

type AutobahnRoadwork = {
  identifier: string;
  title: string;
  subtitle?: string[];
  description?: string[];
  coordinate: {
    lat: string;
    long: string;
  };
  displayType: string;
  extent?: string;
  isBlocked?: string[];
  startTimestamp?: string;
};

type AutobahnClosure = {
  identifier: string;
  title: string;
  subtitle?: string[];
  description?: string[];
  coordinate: {
    lat: string;
    long: string;
  };
  displayType: string;
  extent?: string;
  startTimestamp?: string;
};

type AutobahnWarning = {
  identifier: string;
  title: string;
  subtitle?: string[];
  description?: string[];
  coordinate: {
    lat: string;
    long: string;
  };
  displayType: string;
  extent?: string;
  startTimestamp?: string;
};

type AutobahnEventsResponse = {
  roadworks: Array<{
    id: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    type: 'roadworks';
    severity: 'warning' | 'info';
    extent?: string;
    isBlocked?: string[];
    timestamp?: string;
    age?: string;
    confidence: 'high' | 'medium';
  }>;
  closures: Array<{
    id: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    type: 'closures';
    severity: 'danger' | 'warning';
    extent?: string;
    timestamp?: string;
    age?: string;
    confidence: 'high' | 'medium';
  }>;
  warnings: Array<{
    id: string;
    title: string;
    description: string;
    lat: number;
    lng: number;
    type: 'warnings';
    severity: 'warning' | 'info';
    extent?: string;
    timestamp?: string;
    age?: string;
    confidence: 'high' | 'medium';
  }>;
  cachedAt: string;
  source: string;
};

const AUTOBAHN_API_BASE = 'https://verkehr.autobahn.de/o/autobahn';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

let cachedResponse: { data: AutobahnEventsResponse; timestamp: number } | null = null;

function calculateAge(timestamp?: string): string {
  if (!timestamp) return 'Unknown';
  
  const eventTime = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - eventTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

async function fetchAutobahnEvents(): Promise<AutobahnEventsResponse> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedResponse && (now - cachedResponse.timestamp < CACHE_DURATION_MS)) {
    return cachedResponse.data;
  }

  try {
    // Fetch all three types of events in parallel
    const [roadworksRes, closuresRes, warningsRes] = await Promise.all([
      fetch(`${AUTOBAHN_API_BASE}/`, { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      }).then(r => r.json()).then(data => 
        data.roads?.map((road: string) => 
          fetch(`${AUTOBAHN_API_BASE}/${road}/services/roadworks`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          }).then(r => r.ok ? r.json() : { roadworks: [] })
        ) || []
      ).then(promises => Promise.all(promises)).catch(() => []),
      
      fetch(`${AUTOBAHN_API_BASE}/`, { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      }).then(r => r.json()).then(data => 
        data.roads?.map((road: string) => 
          fetch(`${AUTOBAHN_API_BASE}/${road}/services/closure`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          }).then(r => r.ok ? r.json() : { closure: [] })
        ) || []
      ).then(promises => Promise.all(promises)).catch(() => []),
      
      fetch(`${AUTOBAHN_API_BASE}/`, { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      }).then(r => r.json()).then(data => 
        data.roads?.map((road: string) => 
          fetch(`${AUTOBAHN_API_BASE}/${road}/services/warning`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          }).then(r => r.ok ? r.json() : { warning: [] })
        ) || []
      ).then(promises => Promise.all(promises)).catch(() => []),
    ]);

    // Process roadworks
    const roadworks = roadworksRes.flatMap((data: any) => 
      (data.roadworks || []).map((item: AutobahnRoadwork) => ({
        id: item.identifier,
        title: item.title || 'Roadworks',
        description: [
          ...(item.subtitle || []),
          ...(item.description || [])
        ].filter(Boolean).join(' · ') || 'Roadworks in progress',
        lat: parseFloat(item.coordinate.lat),
        lng: parseFloat(item.coordinate.long),
        type: 'roadworks' as const,
        severity: item.isBlocked?.length ? 'warning' as const : 'info' as const,
        extent: item.extent,
        isBlocked: item.isBlocked,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp),
        confidence: 'high' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    // Process closures
    const closures = closuresRes.flatMap((data: any) => 
      (data.closure || []).map((item: AutobahnClosure) => ({
        id: item.identifier,
        title: item.title || 'Closure',
        description: [
          ...(item.subtitle || []),
          ...(item.description || [])
        ].filter(Boolean).join(' · ') || 'Road closure in effect',
        lat: parseFloat(item.coordinate.lat),
        lng: parseFloat(item.coordinate.long),
        type: 'closures' as const,
        severity: 'danger' as const,
        extent: item.extent,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp),
        confidence: 'high' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    // Process warnings
    const warnings = warningsRes.flatMap((data: any) => 
      (data.warning || []).map((item: AutobahnWarning) => ({
        id: item.identifier,
        title: item.title || 'Warning',
        description: [
          ...(item.subtitle || []),
          ...(item.description || [])
        ].filter(Boolean).join(' · ') || 'Traffic warning',
        lat: parseFloat(item.coordinate.lat),
        lng: parseFloat(item.coordinate.long),
        type: 'warnings' as const,
        severity: item.displayType?.toLowerCase().includes('danger') ? 'warning' as const : 'info' as const,
        extent: item.extent,
        timestamp: item.startTimestamp,
        age: calculateAge(item.startTimestamp),
        confidence: 'medium' as const,
      }))
    ).filter(item => !isNaN(item.lat) && !isNaN(item.lng));

    const response: AutobahnEventsResponse = {
      roadworks,
      closures,
      warnings,
      cachedAt: new Date().toISOString(),
      source: 'Autobahn GmbH (verkehr.autobahn.de)',
    };

    // Cache the response
    cachedResponse = {
      data: response,
      timestamp: now,
    };

    return response;
  } catch (error) {
    console.error('Error fetching Autobahn events:', error);
    
    // Return cached data if available, even if expired
    if (cachedResponse) {
      return cachedResponse.data;
    }
    
    // Return empty response with degraded state
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
  // Set CORS headers
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
    const events = await fetchAutobahnEvents();
    
    // Set cache headers
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
