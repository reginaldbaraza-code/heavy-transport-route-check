import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import AppErrorBoundary from './components/AppErrorBoundary'
import { RouteMonitoringProvider } from './context/RouteMonitoringContext'
import { JobsProvider } from './context/JobsContext'
import { OrgSettingsProvider } from './context/OrgSettingsContext'
import { importWithChunkRecovery } from './lib/chunkLoadRecovery'
import NotFound from './pages/NotFound'

const MarketplaceOverview = lazy(() => importWithChunkRecovery(() => import('./pages/MarketplaceOverview')))
const RouteIntelligence = lazy(() => importWithChunkRecovery(() => import('./pages/RouteIntelligence')))
const LiveMap = lazy(() => importWithChunkRecovery(() => import('./pages/LiveMap')))
const Settings = lazy(() => importWithChunkRecovery(() => import('./pages/Settings')))
const DataPartners = lazy(() => importWithChunkRecovery(() => import('./pages/DataPartners')))
const SavedJobs = lazy(() => importWithChunkRecovery(() => import('./pages/SavedJobs')))
const MarketplaceActivity = lazy(() => importWithChunkRecovery(() => import('./pages/MarketplaceActivity')))
const SearchResults = lazy(() => importWithChunkRecovery(() => import('./pages/SearchResults')))

function PageFallback() {
  return <div className="page-fallback" role="status">Loading…</div>
}

export default function App() {
  return (
    <AppErrorBoundary>
      <OrgSettingsProvider>
        <RouteMonitoringProvider>
        <JobsProvider>
          <BrowserRouter>
          <Routes>
          <Route path="/" element={<Layout />}>
          <Route index element={<Suspense fallback={<PageFallback />}><MarketplaceOverview /></Suspense>} />
          <Route path="jobs" element={<Suspense fallback={<PageFallback />}><SavedJobs /></Suspense>} />
          <Route path="search" element={<Suspense fallback={<PageFallback />}><SearchResults /></Suspense>} />
          <Route path="route-checks" element={<Suspense fallback={<PageFallback />}><RouteIntelligence /></Suspense>} />
          <Route path="data-partners" element={<Suspense fallback={<PageFallback />}><DataPartners /></Suspense>} />
          <Route path="map-explorer" element={<Suspense fallback={<PageFallback />}><LiveMap /></Suspense>} />
          <Route path="live-map" element={<Navigate to="/map-explorer" replace />} />
          <Route path="activity" element={<Suspense fallback={<PageFallback />}><MarketplaceActivity /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
          <Route path="*" element={<NotFound />} />
          </Route>
          </Routes>
          </BrowserRouter>
        </JobsProvider>
        </RouteMonitoringProvider>
      </OrgSettingsProvider>
    </AppErrorBoundary>
  )
}
