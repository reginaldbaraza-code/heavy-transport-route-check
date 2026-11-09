export type RouteVerdict = 'READY' | 'HOLD' | 'VERIFY'

export type VehicleProfile = {
  id: string
  label: string
  width: number
  height: number
  length: number
  grossWeight: number
}

export type RouteEvidence = {
  id: string
  title: string
  detail: string
  source: string
  age: string
  confidence: 'high' | 'medium' | 'High' | 'Medium'
  state: 'clear' | 'info' | 'warning' | 'danger' | 'conflict'
  category: 'roadworks' | 'closures' | 'observations'
  lat?: number
  lng?: number
  startTimestamp?: string | null
  endTimestamp?: string | null
  retrievedAt?: string
  longRunning?: boolean
  distanceKm?: number | null
  reason?: string
  locationKind?: string
  blocker?: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
}

export type MapAlert = {
  lat: number
  lng: number
  title: string
  detail: string
  severity: RouteVerdict
  category: 'roadworks' | 'closures' | 'observations'
}

export type PermittedRoute = {
  id: string
  permitId: string
  fileName: string
  origin: string
  originShort: string
  destination: string
  destinationShort: string
  departure: string
  queueDeparture: string
  corridor: string
  distance: string
  lastUpdated: string
  coordinates: [number, number][]
  alert: MapAlert | null
  evidence: RouteEvidence[]
}

export type RouteCheckResult = {
  verdict: RouteVerdict
  title: string
  summary: string
  impact: string
  confidence: 'High' | 'Medium'
  issueCount: number
}

export const vehicleProfiles: VehicleProfile[] = [
  {
    id: 'standard-300',
    label: 'Standard heavy haulage',
    width: 3,
    height: 4,
    length: 25,
    grossWeight: 52,
  },
  {
    id: 'wide-380',
    label: 'Wide heavy haulage',
    width: 3.8,
    height: 4.2,
    length: 32,
    grossWeight: 68,
  },
]

export const defaultVehicleProfile = vehicleProfiles[1]

export const permittedRoutes: PermittedRoute[] = [
  {
    id: 'hamburg-kassel',
    permitId: 'DE-HH-2026-01208',
    fileName: 'VEMAGS_DE-HH-2026-01208.json',
    origin: 'Hamburg Port Terminal',
    originShort: 'Hamburg',
    destination: 'Kassel Logistics Hub',
    destinationShort: 'Kassel',
    departure: '23.10.2026, 01:30',
    queueDeparture: '23.10.2026, 01:30',
    corridor: 'A7',
    distance: '309 km',
    lastUpdated: '3 min ago',
    coordinates: [[53.55, 10], [53.05, 9.82], [52.78, 9.8], [52.36, 9.73], [51.52, 9.93], [51.31, 9.49]],
    alert: null,
    evidence: [
      { id: 'roadworks', title: 'No active roadworks restrictions', detail: 'All planned work zones remain outside the permitted corridor.', source: 'Autobahn GmbH roadworks feed', age: 'Updated 3 min ago', confidence: 'High', state: 'clear', category: 'roadworks' },
      { id: 'closures', title: 'No closures in departure window', detail: 'No full or partial closures overlap the planned journey.', source: 'National traffic management feed', age: 'Updated 5 min ago', confidence: 'High', state: 'clear', category: 'roadworks' },
      { id: 'observations', title: 'Route conditions confirmed', detail: 'Recent reports show normal passage on the monitored A7 sections.', source: 'MDS on-site observations', age: 'Updated 12 min ago', confidence: 'High', state: 'clear', category: 'observations' },
    ],
  },
  {
    id: 'duisburg-munich',
    permitId: 'DE-NW-2026-04821',
    fileName: 'VEMAGS_DE-NW-2026-04821.json',
    origin: 'Duisburg Logistics Yard',
    originShort: 'Duisburg',
    destination: 'Munich Wind Farm',
    destinationShort: 'Munich',
    departure: '22.10.2026, 22:00',
    queueDeparture: '22.10.2026, 22:00',
    corridor: 'A3 / A9',
    distance: '638 km',
    lastUpdated: '2 min ago',
    coordinates: [[51.43, 6.76], [50.94, 6.96], [50.11, 8.68], [49.79, 9.93], [49.45, 11.08], [48.78, 11.5], [48.14, 11.58]],
    alert: { lat: 49.79, lng: 9.93, title: 'Lane-width restriction', detail: 'A3 near Würzburg · 3.50 m', severity: 'HOLD', category: 'roadworks' },
    evidence: [
      { id: 'restriction', title: 'Lane-width restriction 3.50 m', detail: 'A work zone restricts usable lane width on the permitted A3 segment near Würzburg.', source: 'Autobahn GmbH roadworks feed', age: 'Updated 2 min ago', confidence: 'High', state: 'warning', category: 'roadworks' },
      { id: 'works-confirmation', title: 'Work zone confirmed active', detail: 'The current restriction is confirmed for the planned departure window.', source: 'Road operator status feed', age: 'Updated 8 min ago', confidence: 'High', state: 'warning', category: 'roadworks' },
      { id: 'vehicle-fit', title: 'Vehicle clearance check', detail: 'Calculated from the selected approved vehicle measurements.', source: 'VEMAGS profile + route check', age: 'Calculated now', confidence: 'High', state: 'warning', category: 'observations' },
    ],
  },
  {
    id: 'bremen-hannover',
    permitId: 'DE-HB-2026-00914',
    fileName: 'VEMAGS_DE-HB-2026-00914.json',
    origin: 'Bremen Heavy Cargo Terminal',
    originShort: 'Bremen',
    destination: 'Hannover Industrial Park',
    destinationShort: 'Hannover',
    departure: '24.10.2026, 23:00',
    queueDeparture: '24.10.2026, 23:00',
    corridor: 'A27 / A7',
    distance: '132 km',
    lastUpdated: '1 min ago',
    coordinates: [[53.08, 8.8], [52.73, 9.18], [52.5, 9.63], [52.36, 9.73]],
    alert: { lat: 52.55, lng: 9.68, title: 'Confirmed full closure', detail: 'A7 · 22:00–05:00', severity: 'HOLD', category: 'closures' },
    evidence: [
      { id: 'closure', title: 'Full closure on A7', detail: 'The permitted carriageway is closed between Wedemark and Hannover-Nord.', source: 'Lower Saxony traffic management centre', age: 'Updated 1 min ago', confidence: 'High', state: 'danger', category: 'closures' },
      { id: 'window', title: 'Closure overlaps departure', detail: 'Closure 22:00–05:00 · planned departure 23:00.', source: 'Official closure schedule', age: 'Confirmed 6 min ago', confidence: 'High', state: 'danger', category: 'closures' },
      { id: 'observation', title: 'Physical barriers confirmed', detail: 'On-site report confirms that closure barriers are in place.', source: 'MDS verified road operator', age: 'Updated 9 min ago', confidence: 'High', state: 'danger', category: 'observations' },
    ],
  },
  {
    id: 'leipzig-nuremberg',
    permitId: 'DE-SN-2026-03147',
    fileName: 'VEMAGS_DE-SN-2026-03147.json',
    origin: 'Leipzig Freight Centre',
    originShort: 'Leipzig',
    destination: 'Nuremberg Heavy Cargo Hub',
    destinationShort: 'Nuremberg',
    departure: '25.10.2026, 00:30',
    queueDeparture: '25.10.2026, 00:30',
    corridor: 'A9',
    distance: '286 km',
    lastUpdated: '7 min ago',
    coordinates: [[51.34, 12.37], [51.5, 12.6], [50.92, 11.58], [50.31, 11.92], [49.45, 11.08]],
    alert: { lat: 50.42, lng: 11.86, title: 'Conflicting lane status', detail: 'A9 · verification required', severity: 'VERIFY', category: 'closures' },
    evidence: [
      { id: 'official', title: 'Official feed: lane closed', detail: 'The right lane is reported closed on the permitted A9 segment.', source: 'Autobahn GmbH traffic feed', age: 'Updated 7 min ago', confidence: 'High', state: 'warning', category: 'closures' },
      { id: 'onsite', title: 'On-site report: lane open', detail: 'A verified carrier reported normal passage through the same segment.', source: 'MDS verified carrier report', age: 'Reported 40 min ago', confidence: 'Medium', state: 'conflict', category: 'observations' },
      { id: 'camera', title: 'Camera evidence unavailable', detail: 'The nearest corridor camera is temporarily offline.', source: 'Roadside visual evidence feed', age: 'Unavailable for 2 h', confidence: 'Medium', state: 'conflict', category: 'observations' },
    ],
  },
]

export function getPermittedRoute(routeId: string | null | undefined) {
  return permittedRoutes.find(route => route.id === routeId) ?? permittedRoutes[1]
}

export function formatVehicleDimensions(profile: VehicleProfile) {
  return `${profile.width.toFixed(2)} m W × ${profile.height.toFixed(2)} m H × ${profile.length.toFixed(1)} m L · ${profile.grossWeight} t`
}

export function getRouteCheckResult(route: PermittedRoute, profile: VehicleProfile): RouteCheckResult {
  const profileSummary = formatVehicleDimensions(profile)

  if (route.id === 'hamburg-kassel') {
    return {
      verdict: 'READY',
      title: 'Route clear – ready to depart',
      summary: 'No disruptions were found on the approved A7 route.',
      impact: `Selected vehicle checked: ${profileSummary}. No current report conflicts with the approved measurements.`,
      confidence: 'High',
      issueCount: 0,
    }
  }

  if (route.id === 'duisburg-munich') {
    const fits = profile.width <= 3.5
    return fits
      ? {
          verdict: 'READY',
          title: 'Route clear – ready to depart',
          summary: `Width restriction 3.50 m – your vehicle ${profile.width.toFixed(2)} m fits.`,
          impact: `Selected vehicle: ${profileSummary}. Height, length, and gross weight have no current conflicts on this route.`,
          confidence: 'High',
          issueCount: 0,
        }
      : {
          verdict: 'HOLD',
          title: 'Hold departure – vehicle exceeds lane width',
          summary: `Vehicle width ${profile.width.toFixed(2)} m exceeds restriction 3.50 m.`,
          impact: `Selected vehicle: ${profileSummary}. The width conflict blocks the exact permitted route.`,
          confidence: 'High',
          issueCount: 1,
        }
  }

  if (route.id === 'bremen-hannover') {
    return {
      verdict: 'HOLD',
      title: 'Hold departure – closure on permitted route',
      summary: 'A confirmed full closure on the A7 overlaps the planned departure window from 22:00 to 05:00.',
      impact: `Selected vehicle checked: ${profileSummary}. The full closure blocks every approved profile.`,
      confidence: 'High',
      issueCount: 1,
    }
  }

  return {
    verdict: 'VERIFY',
    title: 'Verification required – conflicting evidence',
    summary: 'The official feed reports a closed lane, while an on-site report from 40 min ago says it is open.',
    impact: `Selected vehicle checked: ${profileSummary}. Confirm current lane status before making the dispatch decision.`,
    confidence: 'Medium',
    issueCount: 1,
  }
}

export function getRouteEvidence(route: PermittedRoute, profile: VehicleProfile): RouteEvidence[] {
  if (route.id !== 'duisburg-munich') return route.evidence

  const fits = profile.width <= 3.5
  return route.evidence.map(evidence =>
    evidence.id === 'vehicle-fit'
      ? {
          ...evidence,
          title: fits ? 'Selected vehicle fits restriction' : 'Selected vehicle exceeds restriction',
          detail: fits
            ? `Restriction 3.50 m · vehicle width ${profile.width.toFixed(2)} m · clearance ${(3.5 - profile.width).toFixed(2)} m.`
            : `Restriction 3.50 m · vehicle width ${profile.width.toFixed(2)} m · exceeds by ${(profile.width - 3.5).toFixed(2)} m.`,
          state: fits ? 'clear' : 'danger',
        }
      : evidence,
  )
}
