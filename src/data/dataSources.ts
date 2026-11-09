export type DataSourceStatus = 'live' | 'optional' | 'unavailable' | 'manual'

export type DataSourceNote = {
  id: string
  name: string
  status: DataSourceStatus
  used: boolean
  summary: string
  limitation?: string
  license?: string
  attribution?: string
}

export const dataSources: DataSourceNote[] = [
  {
    id: 'autobahn-roadworks',
    name: 'Autobahn GmbH roadworks',
    status: 'live',
    used: true,
    summary: 'Keyless public API at verkehr.autobahn.de. Used in every route check and the corridor monitor.',
  },
  {
    id: 'autobahn-closures',
    name: 'Autobahn GmbH closures',
    status: 'live',
    used: true,
    summary: 'Keyless closures feed. Blocking closures on the permitted corridor produce HOLD.',
  },
  {
    id: 'autobahn-warnings',
    name: 'Autobahn GmbH warnings',
    status: 'live',
    used: true,
    summary: 'Keyless traffic warnings. Shown as VERIFY evidence; they do not by themselves yield READY.',
  },
  {
    id: 'autobahn-parking',
    name: 'Autobahn GmbH lorry parking',
    status: 'live',
    used: true,
    summary: 'Keyless parking_lorry service. Corridor sites are listed as informational observations and do not override HOLD/VERIFY.',
  },
  {
    id: 'autobahn-webcam',
    name: 'Autobahn GmbH webcams',
    status: 'optional',
    used: false,
    summary: 'Keyless webcam service exists, but many roads return an empty list.',
    limitation: 'Not fetched in this release so route-check functions stay within Hobby duration limits. Visual confirmation stays on-site.',
  },
  {
    id: 'autobahn-charging',
    name: 'Autobahn GmbH electric charging',
    status: 'optional',
    used: false,
    summary: 'Keyless electric_charging_station service is available.',
    limitation: 'Not used. Heavy-transport dispatch does not depend on EV charging.',
  },
  {
    id: 'bemas-bw',
    name: 'MobiData BW BEMaS (state roads)',
    status: 'live',
    used: true,
    summary: 'Keyless GeoJSON of Baden-Württemberg B/L/K roadworks from BEMaS, fetched live during each route check. CDN cache s-maxage=10 min on /api/bw-roadworks.',
    license: 'dl-de/by-2.0',
    attribution: 'Verkehrsministerium Baden-Württemberg / BEMaS via MobiData BW. License: Datenlizenz Deutschland – Namensnennung – Version 2.0.',
  },
  {
    id: 'mobilithek',
    name: 'Mobilithek roadworks (DATEX II)',
    status: 'live',
    used: true,
    summary: 'Integrated via MobiData BW open republication (no Mobilithek login or certificate). Autobahn GmbH MIA short- and long-term DATEX II feeds are streamed every 6 hours by GitHub Actions into public/data/mia-roadworks.json.',
    limitation: 'Each snapshot commit triggers a Vercel production deploy (~4/day, within Hobby). If the snapshot is older than 12 hours, route checks flag it. Width uses residualRoadWidth / minLaneWidth when present; height/weight tags are rare in this DATEX profile.',
    license: 'dl-de/by-2.0',
    attribution: 'Autobahn GmbH des Bundes / Mobilithek, republished by MobiData BW. License: Datenlizenz Deutschland – Namensnennung – Version 2.0.',
  },
  {
    id: 'bridge-clearance',
    name: 'Bridge and clearance',
    status: 'manual',
    used: false,
    summary: 'No free, keyless national bridge-height dataset is wired in.',
    limitation: 'Always a confirm-on-site item. Unknown clearance cannot yield READY.',
  },
  {
    id: 'background-monitor',
    name: 'Background monitoring / email / SMS',
    status: 'unavailable',
    used: false,
    summary: 'In-tab re-checks run only while this browser tab is open.',
    limitation: 'Vercel Hobby cron is once per day, which is too coarse for departure monitoring. Email and SMS stay disabled. No paid notification service is used.',
  },
]
