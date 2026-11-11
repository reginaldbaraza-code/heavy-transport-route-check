import { lazy, Suspense } from 'react'
import { Route } from 'lucide-react'
import type { PermitLeafletMapProps } from './PermitLeafletMap'

const PermitLeafletMap = lazy(() => import('./PermitLeafletMap'))

function PermitMapSkeleton({
  badgeTitle,
  badgeSubtitle,
  showLegend,
}: Pick<PermitLeafletMapProps, 'badgeTitle' | 'badgeSubtitle' | 'showLegend'>) {
  return (
    <div className="heatmap-shell heatmap-compact permit-leaflet-shell">
      <div className="heatmap-canvas">
        <div className="permit-leaflet-fallback">Loading map…</div>
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
  return (
    <div className="permit-leaflet-host" data-permit-map-host={props.dataTestId}>
      <Suspense fallback={<PermitMapSkeleton badgeTitle={props.badgeTitle} badgeSubtitle={props.badgeSubtitle} showLegend={props.showLegend} />}>
        <PermitLeafletMap {...props} />
      </Suspense>
    </div>
  )
}
