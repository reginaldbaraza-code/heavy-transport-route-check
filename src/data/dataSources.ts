export type DataSourceStatus = 'live' | 'optional' | 'unavailable' | 'manual'

export type DataSourceNote = {
  id: string
  name: string
  status: DataSourceStatus
  used: boolean
  summary: string
  limitation?: string
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
    id: 'mobilithek',
    name: 'Mobilithek roadworks (DATEX II)',
    status: 'unavailable',
    used: false,
    summary: 'National mobility data portal. Roadworks subscriptions use registration, a machine account, and often a client certificate.',
    limitation: 'Not integrated. No keyless public dataset was found that can be used without registration, subscription contract, or API keys. Free-tier constraint: do not add paid or contract-gated feeds.',
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
