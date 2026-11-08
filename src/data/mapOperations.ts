import { roadVectors } from './germanyMap'

export type OperationalEventType = 'roadworks' | 'warnings' | 'closures' | 'webcams' | 'parking'

export type OperationalEvent = {
  id: string
  type: OperationalEventType
  title: string
  road: string
  detail: string
  lat: number
  lng: number
  updated: string
  source: string
  confidence: number
  dataCategory: string
  marketQuery: string
}

const eventTypes: OperationalEventType[] = [
  'roadworks', 'warnings', 'roadworks', 'webcams', 'parking', 'warnings', 'closures',
]

const content: Record<OperationalEventType, Array<[string, string]>> = {
  roadworks: [
    ['Carriageway renewal', 'Two lanes open · moving work zone'],
    ['Bridge maintenance', 'Width restricted to 3.25 m'],
    ['Barrier replacement', 'Hard shoulder unavailable'],
    ['Surface inspection', 'Mobile maintenance operation'],
  ],
  warnings: [
    ['Stationary traffic', 'Queue length approximately 6 km'],
    ['Hazard on carriageway', 'Reduced speed advised'],
    ['Strong crosswinds', 'High-sided vehicles affected'],
    ['Low visibility', 'Visibility below 150 m'],
  ],
  closures: [
    ['Junction restriction', 'Entry ramp temporarily closed'],
    ['Lane closure', 'One lane blocked until 18:00'],
    ['Exit unavailable', 'Signed regional diversion in place'],
  ],
  webcams: [
    ['Traffic camera', 'Visual evidence refreshed every 60 seconds'],
    ['Corridor camera', 'Current carriageway conditions available'],
  ],
  parking: [
    ['Freight parking', 'Dynamic capacity signal available'],
    ['Service area occupancy', 'Limited HGV spaces expected'],
  ],
}

const metadata: Record<OperationalEventType, Pick<OperationalEvent, 'source' | 'dataCategory' | 'marketQuery'>> = {
  roadworks: {
    source: 'Road operator construction feed',
    dataCategory: 'Roadworks and infrastructure',
    marketQuery: 'roadworks construction restrictions',
  },
  warnings: {
    source: 'Aggregated safety observations',
    dataCategory: 'Safety and incidents',
    marketQuery: 'road hazards safety incidents',
  },
  closures: {
    source: 'Traffic management restrictions',
    dataCategory: 'Traffic and road conditions',
    marketQuery: 'road closures traffic restrictions',
  },
  webcams: {
    source: 'Roadside visual evidence',
    dataCategory: 'Road condition evidence',
    marketQuery: 'traffic cameras road condition',
  },
  parking: {
    source: 'Service-area occupancy feed',
    dataCategory: 'Parking and freight',
    marketQuery: 'freight parking occupancy',
  },
}

export function createOperationalEvents(): OperationalEvent[] {
  return roadVectors.flatMap((road, roadIndex) =>
    road.points.slice(0, -1).map((point, segmentIndex) => {
      const next = road.points[segmentIndex + 1]
      const type = eventTypes[(roadIndex * 3 + segmentIndex) % eventTypes.length]
      const variants = content[type]
      const [title, detail] = variants[(roadIndex + segmentIndex) % variants.length]
      const offset = ((roadIndex + segmentIndex) % 3 - 1) * .018
      const metadataForType = metadata[type]
      const minutes = 1 + ((roadIndex * 7 + segmentIndex * 3) % 28)

      return {
        id: `${type}-${road.name.toLowerCase()}-${segmentIndex + 1}`,
        type,
        title,
        road: road.name,
        detail,
        lat: (point[0] + next[0]) / 2 + offset,
        lng: (point[1] + next[1]) / 2 - offset,
        updated: type === 'webcams' ? 'Now' : `${minutes} min ago`,
        confidence: 82 + ((roadIndex * 5 + segmentIndex * 7) % 17),
        ...metadataForType,
      }
    }),
  )
}
