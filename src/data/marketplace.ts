export type CommercialModel = 'Free access' | 'Subscription' | 'Usage-based' | 'Request a quote'
export type OfferStatus = 'Published' | 'Draft' | 'Paused'
export type RequestStatus = 'Submitted' | 'Under review' | 'More information required' | 'Quote received' | 'Negotiation' | 'Approved' | 'Rejected' | 'Agreement pending' | 'Active' | 'Paused' | 'Expired' | 'Cancelled'

export type Provider = {
  id: string
  name: string
  type: string
  verified: boolean
  regions: string[]
  domains: string[]
  description: string
  responseTime: string
  activeSince: string
}

export type DataOffer = {
  id: string
  title: string
  providerId: string
  summary: string
  description: string
  category: string
  useCases: string[]
  geography: string[]
  updateFrequency: string
  freshness: string
  quality: number
  completeness: number
  reliability: number
  historicalDepth: string
  formats: string[]
  delivery: string[]
  license: string
  commercialModel: CommercialModel
  price: string
  sampleAvailable: boolean
  privacy: string
  restrictions: string
  collectionMethod?: string
  limitations?: string
  accessRequirements?: string
  fields: string[]
  popularity: number
  publishedAt: string
  lastUpdated: string
  status: OfferStatus
  featured?: boolean
}

export type DataNeed = {
  id: string
  title: string
  objective: string
  domain: string
  geography: string
  frequency: string
  quality: string
  format: string
  budget: string
  timeframe: string
  intendedUse: string
  alternatives: boolean
  status: 'Draft' | 'Matching' | 'Closed'
  matches: number
  createdAt: string
}

export type DataRequest = {
  id: string
  offerId: string
  direction: 'buying' | 'selling'
  counterpart: string
  purpose: string
  coverage: string
  duration: string
  message: string
  status: RequestStatus
  updatedAt: string
}

export const providers: Provider[] = [
  {
    id: 'city-munich',
    name: 'City of Munich Mobility',
    type: 'Municipality and transport authority',
    verified: true,
    regions: ['Munich', 'Bavaria'],
    domains: ['Traffic', 'Parking', 'Road infrastructure'],
    description: 'The municipal mobility data unit provides trusted operational data for transport planning, traffic management, and public mobility services.',
    responseTime: 'Usually responds within 2 business days',
    activeSince: '2022',
  },
  {
    id: 'bmw',
    name: 'BMW Group Mobility Data',
    type: 'Automotive manufacturer',
    verified: true,
    regions: ['Germany', 'European Union'],
    domains: ['Vehicle movement', 'Safety and incidents', 'Road conditions'],
    description: 'Aggregated and anonymized vehicle-sensor insights designed to improve road safety, navigation, and mobility operations.',
    responseTime: 'Usually responds within 3 business days',
    activeSince: '2021',
  },
  {
    id: 'chargegrid',
    name: 'ChargeGrid Europe',
    type: 'Charging network operator',
    verified: true,
    regions: ['Germany', 'Austria', 'Netherlands'],
    domains: ['EV charging', 'Fleet operations'],
    description: 'A cross-network view of charging infrastructure, utilization, availability, and operational performance.',
    responseTime: 'Usually responds within 1 business day',
    activeSince: '2023',
  },
  {
    id: 'transitflow',
    name: 'TransitFlow Analytics',
    type: 'Mobility analytics company',
    verified: true,
    regions: ['Germany', 'Benelux'],
    domains: ['Public transport', 'Mobility demand', 'Travel behavior'],
    description: 'Privacy-preserving demand and service analytics for public transport operators, authorities, and mobility platforms.',
    responseTime: 'Usually responds within 2 business days',
    activeSince: '2022',
  },
  {
    id: 'freightpulse',
    name: 'FreightPulse Logistics',
    type: 'Logistics data provider',
    verified: true,
    regions: ['DACH', 'Poland', 'Czechia'],
    domains: ['Logistics and freight', 'Fleet operations'],
    description: 'Aggregated freight corridor performance and delay signals from a large commercial vehicle network.',
    responseTime: 'Usually responds within 4 business days',
    activeSince: '2024',
  },
]

export const initialOffers: DataOffer[] = [
  {
    id: 'munich-traffic-flow',
    title: 'Real-time traffic flow and congestion — Munich',
    providerId: 'city-munich',
    summary: 'Segment-level speeds, travel times, congestion states, and disruption indicators across the Munich metropolitan road network.',
    description: 'A harmonized operational traffic feed built from roadside infrastructure and municipal traffic systems. It supports routing, network monitoring, planning, and traveler-information services without exposing individual vehicle movements.',
    category: 'Traffic and road conditions',
    useCases: ['Improve route planning', 'Reduce congestion', 'Predict arrival times', 'Manage road operations'],
    geography: ['Munich', 'Bavaria'],
    updateFrequency: 'Every 30 seconds',
    freshness: '< 60 seconds',
    quality: 96,
    completeness: 98,
    reliability: 99,
    historicalDepth: '24 months',
    formats: ['JSON', 'DATEX II'],
    delivery: ['REST API', 'Streaming'],
    license: 'Commercial mobility data license',
    commercialModel: 'Subscription',
    price: 'From €1,200 / month',
    sampleAvailable: true,
    privacy: 'Aggregated infrastructure data; no personal data',
    restrictions: 'No redistribution of the raw feed',
    collectionMethod: 'Municipal roadside sensors and traffic-management systems, harmonized by the City of Munich mobility data unit.',
    limitations: 'Coverage may be reduced during sensor maintenance. Private roads and some construction diversions are not included.',
    accessRequirements: 'Verified MDS organization, approved intended use, and signed commercial data agreement.',
    fields: ['Road segment', 'Average speed', 'Travel time', 'Congestion level', 'Event type', 'Timestamp'],
    popularity: 94,
    publishedAt: '2025-11-08',
    lastUpdated: '8 minutes ago',
    status: 'Published',
    featured: true,
  },
  {
    id: 'ev-availability-europe',
    title: 'EV charging availability and utilization',
    providerId: 'chargegrid',
    summary: 'Live connector availability, station status, utilization, and reliability across more than 48,000 European charge points.',
    description: 'A normalized multi-operator charging feed for routing, fleet planning, energy services, and driver-facing applications.',
    category: 'EV charging',
    useCases: ['Optimize charging operations', 'Plan fleet charging', 'Improve driver experience'],
    geography: ['Germany', 'Austria', 'Netherlands'],
    updateFrequency: 'Every 2 minutes',
    freshness: '< 3 minutes',
    quality: 94,
    completeness: 95,
    reliability: 97,
    historicalDepth: '18 months',
    formats: ['JSON', 'OCPI'],
    delivery: ['REST API', 'Streaming'],
    license: 'Commercial API license',
    commercialModel: 'Usage-based',
    price: 'From €0.08 / 1,000 calls',
    sampleAvailable: true,
    privacy: 'No driver or payment data included',
    restrictions: 'Derived products permitted; raw resale prohibited',
    collectionMethod: 'Normalized status events contributed by participating charging network operators.',
    limitations: 'Roaming-partner updates may arrive later than directly operated station updates. Pricing and payment availability are not included.',
    accessRequirements: 'Verified organization and accepted API usage terms.',
    fields: ['Station ID', 'Connector type', 'Availability', 'Power', 'Utilization', 'Reliability'],
    popularity: 91,
    publishedAt: '2026-01-12',
    lastUpdated: '3 minutes ago',
    status: 'Published',
    featured: true,
  },
  {
    id: 'road-hazard-signals',
    title: 'Aggregated road hazard and surface-condition signals',
    providerId: 'bmw',
    summary: 'Anonymized vehicle-sensor events for slippery roads, heavy rain, fog, breakdowns, and sudden slowdowns.',
    description: 'High-volume vehicle-derived observations designed for safety, navigation, and road maintenance use cases.',
    category: 'Safety and incidents',
    useCases: ['Improve safety', 'Detect road hazards', 'Prioritize winter maintenance'],
    geography: ['Germany', 'European Union'],
    updateFrequency: 'Every 5 minutes',
    freshness: '< 10 minutes',
    quality: 92,
    completeness: 90,
    reliability: 98,
    historicalDepth: '30 days rolling',
    formats: ['JSON', 'GeoJSON'],
    delivery: ['REST API'],
    license: 'Restricted commercial use',
    commercialModel: 'Request a quote',
    price: 'Pricing based on geography and volume',
    sampleAvailable: true,
    privacy: 'Fully anonymized and spatially generalized',
    restrictions: 'Approved safety and operational purposes only',
    collectionMethod: 'Aggregated, anonymized vehicle-sensor observations with spatial and temporal generalization.',
    limitations: 'Signals indicate observations rather than confirmed road authority events. Event density varies with participating vehicle coverage.',
    accessRequirements: 'Provider review of intended use and geographic scope.',
    fields: ['Hazard type', 'Generalized location', 'Confidence', 'Observed at', 'Direction'],
    popularity: 88,
    publishedAt: '2025-09-22',
    lastUpdated: '6 minutes ago',
    status: 'Published',
  },
  {
    id: 'transit-demand',
    title: 'Public transport demand and transfer patterns',
    providerId: 'transitflow',
    summary: 'Hourly demand, transfer pressure, and service-load indicators for urban and regional public transport networks.',
    description: 'Privacy-preserving demand analytics that help operators plan capacity and improve service design.',
    category: 'Public transport',
    useCases: ['Understand travel demand', 'Plan service capacity', 'Optimize timetables'],
    geography: ['Germany', 'Benelux'],
    updateFrequency: 'Hourly',
    freshness: '< 2 hours',
    quality: 90,
    completeness: 92,
    reliability: 96,
    historicalDepth: '36 months',
    formats: ['CSV', 'Parquet'],
    delivery: ['SFTP', 'Cloud bucket'],
    license: 'Analytics and planning license',
    commercialModel: 'Subscription',
    price: 'From €900 / month',
    sampleAvailable: true,
    privacy: 'K-anonymized aggregates; GDPR reviewed',
    restrictions: 'No re-identification or individual profiling',
    collectionMethod: 'Aggregated ticketing, passenger count, and service data processed into privacy-preserving hourly indicators.',
    limitations: 'Demand values are modeled aggregates and should not be interpreted as exact passenger counts.',
    accessRequirements: 'Approved planning or analytics use and data-processing terms.',
    fields: ['Zone', 'Time period', 'Boardings', 'Alightings', 'Transfer count', 'Load index'],
    popularity: 79,
    publishedAt: '2026-02-03',
    lastUpdated: '1 hour ago',
    status: 'Published',
  },
  {
    id: 'freight-corridor',
    title: 'Freight corridor delays and transit-time benchmarks',
    providerId: 'freightpulse',
    summary: 'Anonymized commercial-vehicle travel times, border delays, and corridor reliability across Central Europe.',
    description: 'Aggregated freight performance data for logistics planning, ETA models, and supply-chain risk monitoring.',
    category: 'Logistics and freight',
    useCases: ['Reduce delivery delays', 'Improve ETA accuracy', 'Benchmark freight corridors'],
    geography: ['DACH', 'Poland', 'Czechia'],
    updateFrequency: 'Every 15 minutes',
    freshness: '< 20 minutes',
    quality: 89,
    completeness: 87,
    reliability: 95,
    historicalDepth: '24 months',
    formats: ['JSON', 'CSV'],
    delivery: ['REST API', 'Daily file'],
    license: 'Commercial analytics license',
    commercialModel: 'Request a quote',
    price: 'Request a tailored proposal',
    sampleAvailable: false,
    privacy: 'Aggregated fleet observations',
    restrictions: 'No carrier-level inference',
    collectionMethod: 'Aggregated commercial vehicle travel-time observations across participating fleets.',
    limitations: 'Coverage is strongest on major freight corridors and lower on local roads.',
    accessRequirements: 'Commercial proposal and approved operational or analytics use.',
    fields: ['Corridor', 'Travel time', 'Delay', 'Reliability', 'Border wait', 'Timestamp'],
    popularity: 74,
    publishedAt: '2026-02-18',
    lastUpdated: '12 minutes ago',
    status: 'Published',
  },
  {
    id: 'parking-munich',
    title: 'Parking occupancy and turnover — Munich',
    providerId: 'city-munich',
    summary: 'Space availability, occupancy, turnover, and facility attributes for municipal and participating private parking.',
    description: 'A unified parking feed for journey planning, curb management, and parking operations.',
    category: 'Parking',
    useCases: ['Improve parking availability', 'Reduce search traffic', 'Plan curb use'],
    geography: ['Munich'],
    updateFrequency: 'Every 5 minutes',
    freshness: '< 7 minutes',
    quality: 93,
    completeness: 94,
    reliability: 97,
    historicalDepth: '12 months',
    formats: ['JSON', 'GeoJSON'],
    delivery: ['REST API'],
    license: 'Public-sector commercial reuse license',
    commercialModel: 'Free access',
    price: 'No charge with approved use',
    sampleAvailable: true,
    privacy: 'No vehicle or payment identifiers',
    restrictions: 'Attribution required',
    collectionMethod: 'Municipal parking systems and participating facility operators.',
    limitations: 'On-street coverage is limited to instrumented zones. Temporary closures can be delayed.',
    accessRequirements: 'Verified organization and attribution commitment.',
    fields: ['Facility', 'Location', 'Capacity', 'Available spaces', 'Turnover', 'Timestamp'],
    popularity: 82,
    publishedAt: '2025-12-11',
    lastUpdated: '5 minutes ago',
    status: 'Published',
  },
]

export const initialNeeds: DataNeed[] = [
  {
    id: 'need-route-planning',
    title: 'Improve delivery route planning in southern Germany',
    objective: 'Reduce avoidable delays and improve arrival-time accuracy for our regional delivery fleet.',
    domain: 'Logistics and freight',
    geography: 'Bavaria and Baden-Württemberg',
    frequency: 'Real-time or every 5 minutes',
    quality: 'At least 90% completeness',
    format: 'REST API or streaming',
    budget: '€1,000–€3,000 per month',
    timeframe: 'Within 6 weeks',
    intendedUse: 'Internal route optimization and ETA prediction',
    alternatives: true,
    status: 'Matching',
    matches: 4,
    createdAt: '2026-02-20',
  },
  {
    id: 'need-charging',
    title: 'Charging availability for mixed commercial fleet',
    objective: 'Plan reliable charging stops and reduce failed charging visits.',
    domain: 'EV charging',
    geography: 'Germany and Austria',
    frequency: 'Under 5 minutes',
    quality: 'At least 95% reliability',
    format: 'REST API',
    budget: 'Open to usage-based pricing',
    timeframe: 'This quarter',
    intendedUse: 'Fleet charging orchestration',
    alternatives: true,
    status: 'Draft',
    matches: 1,
    createdAt: '2026-02-24',
  },
]

export const initialRequests: DataRequest[] = [
  {
    id: 'REQ-1031',
    offerId: 'munich-traffic-flow',
    direction: 'buying',
    counterpart: 'City of Munich Mobility',
    purpose: 'Operational route planning and estimated-arrival-time improvement for university mobility services.',
    coverage: 'Munich metropolitan area',
    duration: '12 months',
    message: 'Approved subscription with REST API delivery and internal analytics rights.',
    status: 'Active',
    updatedAt: '5 days ago',
  },
  {
    id: 'REQ-1048',
    offerId: 'road-hazard-signals',
    direction: 'buying',
    counterpart: 'BMW Group Mobility Data',
    purpose: 'Improve winter route risk assessment for a commercial fleet.',
    coverage: 'Germany',
    duration: '12 months',
    message: 'We need road-surface hazard signals for operational routing and driver alerts.',
    status: 'Under review',
    updatedAt: '2 hours ago',
  },
  {
    id: 'REQ-1042',
    offerId: 'parking-munich',
    direction: 'selling',
    counterpart: 'ParkPilot GmbH',
    purpose: 'Integrate municipal availability into a driver-facing parking application.',
    coverage: 'Munich',
    duration: 'Ongoing',
    message: 'Requesting production access for a consumer parking application.',
    status: 'More information required',
    updatedAt: '1 day ago',
  },
  {
    id: 'REQ-1039',
    offerId: 'munich-traffic-flow',
    direction: 'selling',
    counterpart: 'RouteWorks Logistics',
    purpose: 'Commercial route optimization and ETA prediction.',
    coverage: 'Munich metropolitan area',
    duration: '24 months',
    message: 'Interested in a commercial subscription with streaming delivery.',
    status: 'Quote received',
    updatedAt: '2 days ago',
  },
]
