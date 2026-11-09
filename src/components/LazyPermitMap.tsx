import { lazy, Suspense, useEffect, useState } from 'react'
import { Route } from 'lucide-react'
import { afterFirstPaintIdle } from '../lib/deferIdle'
import type { PermitLeafletMapProps } from './PermitLeafletMap'

const PermitLeafletMap = lazy(() => import('./PermitLeafletMap'))

function PermitMapSkeleton({
  badgeTitle,
  badgeSubtitle,
  showLegend,
}: Pick<PermitLeafletMapProps, 'badgeTitle' | 'badgeSubtitle' | 'showLegend'>) {
  return (
    <div className="heatmap-shell heatmap-compact permit-leaflet-shell">
      <div className="heatmap-canvas" style={{ width: '100%', height: '100%', minHeight: 240 }}>
        <div className="permit-leaflet-fallback">Map ready after first paint</div>
        <div className="permit-map-badge">
          <Route size={16} />
          <span>
            <strong>{badgeTitle}</strong>
            <small>{badgeSubtitle}</small>
          </span>
        </div>
        {showLegend ? (
          <div className="permit-map-legend overview-route-legend">
            <span><i className="alert-key ready" /> Ready</span>
            <span><i className="alert-key verify" /> Verify</span>
            <span><i className="alert-key hold" /> Hold</span>
          </div>
        ) : (
          <div className="permit-map-legend">
            <span><i className="route-line-key" /> Sample GPX</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LazyPermitMap(props: PermitLeafletMapProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => afterFirstPaintIdle(() => setReady(true)), [])

  return (
    <div className="permit-leaflet-host" style={{ width: '100%', height: '100%', minHeight: 240 }}>
      {!ready ? (
        <PermitMapSkeleton badgeTitle={props.badgeTitle} badgeSubtitle={props.badgeSubtitle} showLegend={props.showLegend} />
      ) : (
        <Suspense fallback={<PermitMapSkeleton badgeTitle={props.badgeTitle} badgeSubtitle={props.badgeSubtitle} showLegend={props.showLegend} />}>
          <PermitLeafletMap {...props} />
        </Suspense>
      )}
    </div>
  )
}
