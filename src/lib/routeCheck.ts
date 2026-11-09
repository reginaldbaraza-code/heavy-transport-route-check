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
  mode?: 'live' | 'simulated';
  clearanceConfirmed?: boolean;
  clearanceConfirmedBy?: string;
  confirmedAt?: string;
};

export type RouteCheckOptions = {
  permitNumber?: string;
  corridor?: string;
  permittedRoads?: string[];
  departureStart?: string;
  departureEnd?: string;
  validFrom?: string;
  validUntil?: string;
  bridgeClearanceConfirmed?: boolean;
  clearanceConfirmedBy?: string;
  confirmedAt?: string;
  scenario?: string;
  acknowledgements?: Array<{
    evidenceId: string;
    acknowledgedBy: string;
    acknowledgedAt: string;
  }>;
};

export type TestPermitKind = 'live' | 'scenario';

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
  kind: TestPermitKind;
  expectedVerdict?: 'READY' | 'VERIFY' | 'HOLD';
  liveMayDiffer?: boolean;
  scenario?: string;
  bridgeClearanceConfirmed?: boolean;
  clearanceConfirmedBy?: string;
  confirmedAt?: string;
  liveLabel: string;
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
    kind: 'live',
    expectedVerdict: 'VERIFY',
    liveMayDiffer: true,
    liveLabel: 'Sample — expected outcome, live data may differ',
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
    kind: 'live',
    liveMayDiffer: true,
    liveLabel: 'Sample — expected outcome, live data may differ',
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
    kind: 'live',
    expectedVerdict: 'VERIFY',
    liveMayDiffer: true,
    liveLabel: 'Sample — expected outcome, live data may differ',
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
    kind: 'live',
    liveMayDiffer: true,
    liveLabel: 'Sample — expected outcome, live data may differ',
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
    kind: 'live',
    liveMayDiffer: true,
    liveLabel: 'Sample — expected outcome, live data may differ',
  },
  {
    id: 'lubeck-rostock',
    name: 'Lübeck → Rostock (A20) · DE-SH-2026-01020',
    gpxFile: '/test-permits/lubeck-rostock-a20.gpx',
    metadataFile: '/test-permits/lubeck-rostock-a20.json',
    origin: 'Lübeck A20',
    destination: 'Rostock A20',
    originShort: 'Lübeck',
    destinationShort: 'Rostock',
    permitNumber: 'DE-SH-2026-01020',
    corridor: 'A20',
    distance: '40 km',
    validFrom: '2026-11-09T00:00:00+01:00',
    validUntil: '2026-11-16T23:59:59+01:00',
    vehicle: { width: 2.55, height: 4.0, length: 18.0, grossWeight: 40 },
    routeDescription: 'Short A20 segment Lübeck to Rostock, about 40 km.',
    kind: 'live',
    expectedVerdict: 'READY',
    liveMayDiffer: true,
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Sample dispatcher',
    confirmedAt: '2026-11-09T08:00:00.000Z',
    liveLabel: 'Sample — expected outcome, live data may differ',
  },
  {
    id: 'hof-bayreuth',
    name: 'Hof → Bayreuth (A9) · DE-BY-2026-01009',
    gpxFile: '/test-permits/hof-bayreuth-a9.gpx',
    metadataFile: '/test-permits/hof-bayreuth-a9.json',
    origin: 'Hof A9',
    destination: 'Bayreuth A9',
    originShort: 'Hof',
    destinationShort: 'Bayreuth',
    permitNumber: 'DE-BY-2026-01009',
    corridor: 'A9',
    distance: '45 km',
    validFrom: '2026-11-09T00:00:00+01:00',
    validUntil: '2026-11-16T23:59:59+01:00',
    vehicle: { width: 2.55, height: 4.0, length: 18.0, grossWeight: 40 },
    routeDescription: 'Short A9 segment Hof to Bayreuth.',
    kind: 'live',
    expectedVerdict: 'READY',
    liveMayDiffer: true,
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Sample dispatcher',
    confirmedAt: '2026-11-09T08:00:00.000Z',
    liveLabel: 'Sample — expected outcome, live data may differ',
  },
  {
    id: 'scenario-ready',
    name: 'Simulated READY — empty A20 corridor',
    gpxFile: '/test-permits/lubeck-rostock-a20.gpx',
    metadataFile: '/test-permits/lubeck-rostock-a20.json',
    origin: 'Lübeck A20',
    destination: 'Rostock A20',
    originShort: 'Lübeck',
    destinationShort: 'Rostock',
    permitNumber: 'SCENARIO-READY',
    corridor: 'A20',
    distance: '40 km',
    vehicle: { width: 2.55, height: 4.0, length: 18.0, grossWeight: 40 },
    routeDescription: 'Fixture with no disruptions and dispatcher clearance.',
    kind: 'scenario',
    expectedVerdict: 'READY',
    scenario: 'ready-clear',
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    confirmedAt: '2026-11-09T12:00:00.000Z',
    liveLabel: 'Simulated — not live data',
  },
  {
    id: 'scenario-verify',
    name: 'Simulated VERIFY — nearby AS ramp',
    gpxFile: '/test-permits/hamburg-hannover-a7.gpx',
    metadataFile: '/test-permits/hamburg-hannover-a7.json',
    origin: 'Hamburg Port Terminal',
    destination: 'Hannover Logistics Hub',
    originShort: 'Hamburg',
    destinationShort: 'Hannover',
    permitNumber: 'SCENARIO-VERIFY',
    corridor: 'A7',
    distance: '150 km',
    vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
    routeDescription: 'Fixture: ramp closure 0.9 km off the GPX line.',
    kind: 'scenario',
    expectedVerdict: 'VERIFY',
    scenario: 'verify-nearby',
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    confirmedAt: '2026-11-09T12:00:00.000Z',
    liveLabel: 'Simulated — not live data',
  },
  {
    id: 'scenario-hold-closure',
    name: 'Simulated HOLD — A7 Vollsperrung',
    gpxFile: '/test-permits/hamburg-hannover-a7.gpx',
    metadataFile: '/test-permits/hamburg-hannover-a7.json',
    origin: 'Hamburg Port Terminal',
    destination: 'Hannover Logistics Hub',
    originShort: 'Hamburg',
    destinationShort: 'Hannover',
    permitNumber: 'SCENARIO-HOLD-CLOSURE',
    corridor: 'A7',
    distance: '150 km',
    vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
    routeDescription: 'Fixture: confirmed A7 mainline Vollsperrung on the GPX line.',
    kind: 'scenario',
    expectedVerdict: 'HOLD',
    scenario: 'hold-closure',
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    confirmedAt: '2026-11-09T12:00:00.000Z',
    liveLabel: 'Simulated — not live data',
  },
  {
    id: 'scenario-hold-width',
    name: 'Simulated HOLD — A3 residual width 3.0 m',
    gpxFile: '/test-permits/duisburg-koln-a3.gpx',
    metadataFile: '/test-permits/duisburg-koln-a3.json',
    origin: 'Duisburg Logistics Yard',
    destination: 'Köln Wind Terminal',
    originShort: 'Duisburg',
    destinationShort: 'Köln',
    permitNumber: 'SCENARIO-HOLD-WIDTH',
    corridor: 'A3',
    distance: '70 km',
    vehicle: { width: 3.8, height: 4.5, length: 35.0, grossWeight: 80 },
    routeDescription: 'Fixture: residualRoadWidth 3.0 m vs 3.8 m vehicle on A3.',
    kind: 'scenario',
    expectedVerdict: 'HOLD',
    scenario: 'hold-width',
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    confirmedAt: '2026-11-09T12:00:00.000Z',
    liveLabel: 'Simulated — not live data',
  },
  {
    id: 'scenario-hold-height',
    name: 'Simulated HOLD — A8 height 4.00 m vs 4.30 m',
    gpxFile: '/test-permits/munchen-stuttgart-a8.gpx',
    metadataFile: '/test-permits/munchen-stuttgart-a8.json',
    origin: 'München Wind Farm',
    destination: 'Stuttgart Industrial Complex',
    originShort: 'München',
    destinationShort: 'Stuttgart',
    permitNumber: 'SCENARIO-HOLD-HEIGHT',
    corridor: 'A8',
    distance: '230 km',
    vehicle: { width: 3.3, height: 4.3, length: 30.0, grossWeight: 65 },
    routeDescription: 'Fixture: residual clearance 4.00 m vs 4.30 m vehicle on A8.',
    kind: 'scenario',
    expectedVerdict: 'HOLD',
    scenario: 'hold-height',
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    confirmedAt: '2026-11-09T12:00:00.000Z',
    liveLabel: 'Simulated — not live data',
  },
  {
    id: 'scenario-hold-weight',
    name: 'Simulated HOLD — A1 weight 40 t vs 72 t',
    gpxFile: '/test-permits/bremen-dortmund-a1.gpx',
    metadataFile: '/test-permits/bremen-dortmund-a1.json',
    origin: 'Bremen Heavy Cargo Terminal',
    destination: 'Dortmund Industrial Park',
    originShort: 'Bremen',
    destinationShort: 'Dortmund',
    permitNumber: 'SCENARIO-HOLD-WEIGHT',
    corridor: 'A1',
    distance: '220 km',
    vehicle: { width: 3.5, height: 4.2, length: 32.0, grossWeight: 72 },
    routeDescription: 'Fixture: weight limit 40 t vs 72 t vehicle on A1.',
    kind: 'scenario',
    expectedVerdict: 'HOLD',
    scenario: 'hold-weight',
    bridgeClearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    confirmedAt: '2026-11-09T12:00:00.000Z',
    liveLabel: 'Simulated — not live data',
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
    kind: 'live',
    liveLabel: '',
  },
];

export const sampleTestPermits = testPermits.filter(permit => permit.id !== 'invalid' && permit.kind === 'live');
export const scenarioTestPermits = testPermits.filter(permit => permit.kind === 'scenario');

export async function checkRoute(
  gpxContent: string,
  vehicle: {
    width: number;
    height: number;
    length: number;
    grossWeight: number;
  },
  options: string | RouteCheckOptions = {},
): Promise<RouteCheckResult> {
  const opts: RouteCheckOptions = typeof options === 'string' ? { permitNumber: options } : options;
  const response = await fetch('/api/check-route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gpxContent,
      vehicle,
      ...opts,
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
