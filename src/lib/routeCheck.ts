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

import type { TestPermit } from './testPermitCatalog'

export {
  testPermits,
  sampleTestPermits,
  scenarioTestPermits,
  type TestPermit,
  type TestPermitKind,
} from './testPermitCatalog';


export type VehicleDimsInput = {
  width?: number | string | null
  height?: number | string | null
  length?: number | string | null
  grossWeight?: number | string | null
}

export function parseVehicleDims(source?: VehicleDimsInput | null) {
  if (!source) return null
  const width = Number(source.width)
  const height = Number(source.height)
  const length = Number(source.length)
  const grossWeight = Number(source.grossWeight)
  if (![width, height, length, grossWeight].every(n => Number.isFinite(n) && n > 0)) return null
  return { width, height, length, grossWeight }
}

export function permitVehicleDims(
  permit?: Pick<TestPermit, 'kind' | 'vehicle'> | null,
  metadata?: { vehicle?: VehicleDimsInput } | null,
) {
  if (permit?.kind === 'scenario') {
    return parseVehicleDims(permit.vehicle) || parseVehicleDims(metadata?.vehicle)
  }
  return parseVehicleDims(metadata?.vehicle) || parseVehicleDims(permit?.vehicle)
}

const OVERSIZE_MESSAGE = 'This file is larger than 4 MB. Export a smaller GPX from VEMAGS and try again.'

async function errorFromCheckResponse(response: Response): Promise<string> {
  const raw = await response.text()
  if (
    response.status === 413
    || /FUNCTION_PAYLOAD_TOO_LARGE|Request Entity Too Large|413 Request Entity Too Large/i.test(raw)
  ) {
    return OVERSIZE_MESSAGE
  }
  if (/<!DOCTYPE html/i.test(raw) || /<html[\s>]/i.test(raw)) {
    return 'The route check could not run. Try a smaller GPX file or a labelled sample route.'
  }
  try {
    const error = JSON.parse(raw)
    return error.error || error.hint || 'Failed to check route'
  } catch {
    return 'Failed to check route'
  }
}

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
    throw new Error(await errorFromCheckResponse(response));
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
    throw new Error('Failed to load sample permit GPX file');
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
