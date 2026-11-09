import type { RouteEvidence } from '../data/routeChecks';

export type RouteCheckResult = {
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
  retrievedAt?: string;
  source?: string;
};

export type TestPermit = {
  id: string;
  name: string;
  gpxFile: string;
  metadataFile: string;
  origin: string;
  destination: string;
  originShort: string;
  destinationShort: string;
  permitNumber: string;
  corridor: string;
  distance: string;
  validFrom?: string;
  validUntil?: string;
  vehicle: {
    width: number;
    height: number;
    length: number;
    grossWeight: number;
  };
  routeDescription: string;
};

export const testPermits: TestPermit[] = [
  {
    id: 'hamburg-hannover',
    name: 'Hamburg → Hannover (A7) · DE-HH-2026-01845',
    gpxFile: '/test-permits/hamburg-hannover-a7.gpx',
    metadataFile: '/test-permits/hamburg-hannover-a7.json',
    origin: 'Hamburg Port Terminal',
    destination: 'Hannover Logistics Hub',
    originShort: 'Hamburg',
    destinationShort: 'Hannover',
    permitNumber: 'DE-HH-2026-01845',
    corridor: 'A7',
    distance: '150 km',
    validFrom: '2026-11-10T00:00:00+01:00',
    validUntil: '2026-11-15T23:59:59+01:00',
    vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
    routeDescription: 'A7 motorway from Hamburg via Soltau to Hannover. Night transport preferred 22:00–06:00.',
  },
  {
    id: 'bremen-dortmund',
    name: 'Bremen → Dortmund (A1) · DE-HB-2026-00734',
    gpxFile: '/test-permits/bremen-dortmund-a1.gpx',
    metadataFile: '/test-permits/bremen-dortmund-a1.json',
    origin: 'Bremen Heavy Cargo Terminal',
    destination: 'Dortmund Industrial Park',
    originShort: 'Bremen',
    destinationShort: 'Dortmund',
    permitNumber: 'DE-HB-2026-00734',
    corridor: 'A1',
    distance: '220 km',
    validFrom: '2026-11-12T00:00:00+01:00',
    validUntil: '2026-11-18T23:59:59+01:00',
    vehicle: { width: 3.5, height: 4.2, length: 32.0, grossWeight: 72 },
    routeDescription: 'A1 motorway from Bremen via Münster to Dortmund. Weekend transport allowed.',
  },
  {
    id: 'leipzig-nurnberg',
    name: 'Leipzig → Nürnberg (A9) · DE-SN-2026-03512',
    gpxFile: '/test-permits/leipzig-nurnberg-a9.gpx',
    metadataFile: '/test-permits/leipzig-nurnberg-a9.json',
    origin: 'Leipzig Freight Centre',
    destination: 'Nürnberg Heavy Cargo Hub',
    originShort: 'Leipzig',
    destinationShort: 'Nürnberg',
    permitNumber: 'DE-SN-2026-03512',
    corridor: 'A9',
    distance: '290 km',
    validFrom: '2026-11-09T00:00:00+01:00',
    validUntil: '2026-11-14T23:59:59+01:00',
    vehicle: { width: 3.0, height: 4.0, length: 25.0, grossWeight: 52 },
    routeDescription: 'A9 motorway from Leipzig via Hof to Nürnberg. Night transport mandatory.',
  },
  {
    id: 'duisburg-koln',
    name: 'Duisburg → Köln (A3) · DE-NW-2026-02198',
    gpxFile: '/test-permits/duisburg-koln-a3.gpx',
    metadataFile: '/test-permits/duisburg-koln-a3.json',
    origin: 'Duisburg Logistics Yard',
    destination: 'Köln Wind Terminal',
    originShort: 'Duisburg',
    destinationShort: 'Köln',
    permitNumber: 'DE-NW-2026-02198',
    corridor: 'A3',
    distance: '70 km',
    validFrom: '2026-11-11T00:00:00+01:00',
    validUntil: '2026-11-16T23:59:59+01:00',
    vehicle: { width: 3.8, height: 4.5, length: 35.0, grossWeight: 80 },
    routeDescription: 'A3 motorway from Duisburg to Köln. High-capacity transport, daytime allowed with escort.',
  },
  {
    id: 'munchen-stuttgart',
    name: 'München → Stuttgart (A8) · DE-BY-2026-04621',
    gpxFile: '/test-permits/munchen-stuttgart-a8.gpx',
    metadataFile: '/test-permits/munchen-stuttgart-a8.json',
    origin: 'München Wind Farm',
    destination: 'Stuttgart Industrial Complex',
    originShort: 'München',
    destinationShort: 'Stuttgart',
    permitNumber: 'DE-BY-2026-04621',
    corridor: 'A8',
    distance: '230 km',
    validFrom: '2026-11-13T00:00:00+01:00',
    validUntil: '2026-11-20T23:59:59+01:00',
    vehicle: { width: 3.3, height: 4.3, length: 30.0, grossWeight: 65 },
    routeDescription: 'A8 motorway from München via Augsburg and Ulm to Stuttgart. Night transport 22:00–06:00 only.',
  },
  {
    id: 'invalid',
    name: 'Invalid test file (should error)',
    gpxFile: '/test-permits/invalid-test.gpx',
    metadataFile: '',
    origin: 'Invalid',
    destination: 'Invalid',
    originShort: 'Invalid',
    destinationShort: 'Invalid',
    permitNumber: '',
    corridor: '',
    distance: '',
    vehicle: { width: 0, height: 0, length: 0, grossWeight: 0 },
    routeDescription: '',
  },
];

export const sampleTestPermits = testPermits.filter(permit => permit.id !== 'invalid');

export async function checkRoute(
  gpxContent: string,
  vehicle: {
    width: number;
    height: number;
    length: number;
    grossWeight: number;
  },
  permitNumber?: string
): Promise<RouteCheckResult> {
  const response = await fetch('/api/check-route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gpxContent,
      vehicle,
      permitNumber,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to check route' }));
    throw new Error(error.error || error.hint || 'Failed to check route');
  }

  return await response.json();
}

export async function loadTestPermit(permit: TestPermit): Promise<{
  gpxContent: string;
  metadata: any;
}> {
  const [gpxRes, metadataRes] = await Promise.all([
    fetch(permit.gpxFile),
    permit.metadataFile ? fetch(permit.metadataFile) : Promise.resolve(null),
  ]);

  if (!gpxRes.ok) {
    throw new Error('Failed to load test permit GPX file');
  }

  const gpxContent = await gpxRes.text();
  const metadata = metadataRes ? await metadataRes.json() : null;

  return { gpxContent, metadata };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
