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
};

export type TestPermit = {
  id: string;
  name: string;
  gpxFile: string;
  metadataFile: string;
};

export const testPermits: TestPermit[] = [
  {
    id: 'hamburg-hannover',
    name: 'Hamburg → Hannover (A7) · DE-HH-2026-01845',
    gpxFile: '/test-permits/hamburg-hannover-a7.gpx',
    metadataFile: '/test-permits/hamburg-hannover-a7.json',
  },
  {
    id: 'bremen-dortmund',
    name: 'Bremen → Dortmund (A1) · DE-HB-2026-00734',
    gpxFile: '/test-permits/bremen-dortmund-a1.gpx',
    metadataFile: '/test-permits/bremen-dortmund-a1.json',
  },
  {
    id: 'leipzig-nurnberg',
    name: 'Leipzig → Nürnberg (A9) · DE-SN-2026-03512',
    gpxFile: '/test-permits/leipzig-nurnberg-a9.gpx',
    metadataFile: '/test-permits/leipzig-nurnberg-a9.json',
  },
  {
    id: 'duisburg-koln',
    name: 'Duisburg → Köln (A3) · DE-NW-2026-02198',
    gpxFile: '/test-permits/duisburg-koln-a3.gpx',
    metadataFile: '/test-permits/duisburg-koln-a3.json',
  },
  {
    id: 'munchen-stuttgart',
    name: 'München → Stuttgart (A8) · DE-BY-2026-04621',
    gpxFile: '/test-permits/munchen-stuttgart-a8.gpx',
    metadataFile: '/test-permits/munchen-stuttgart-a8.json',
  },
  {
    id: 'invalid',
    name: 'Invalid test file (should error)',
    gpxFile: '/test-permits/invalid-test.gpx',
    metadataFile: '',
  },
];

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
