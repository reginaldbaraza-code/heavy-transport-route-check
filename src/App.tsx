import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import AppErrorBoundary from './components/AppErrorBoundary'
import { RouteMonitoringProvider } from './context/RouteMonitoringContext'
import { JobsProvider } from './context/JobsContext'
import { OrgSettingsProvider } from './context/OrgSettingsContext'

const MarketplaceOverview = lazy(() => import('./pages/MarketplaceOverview'))
const RouteIntelligence = lazy(() => import('./pages/RouteIntelligence'))
const LiveMap = lazy(() => import('./pages/LiveMap'))
const Settings = lazy(() => import('./pages/Settings'))
const DataPartners = lazy(() => import('./pages/DataPartners'))
const SavedJobs = lazy(() => import('./pages/SavedJobs'))
const MarketplaceActivity = lazy(() => import('./pages/MarketplaceActivity'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Toaster = lazy(() => import('./components/ui/sonner').then(module => ({ default: module.Toaster })))

function PageFallback() {
  return (
    <div className="page-fallback flex flex-col gap-3 p-8" role="status">
      <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
      <div className="mt-4 h-40 w-full animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">Loading…</span>
    </div>
  )
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
          <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
          </Route>
          </Routes>
          </BrowserRouter>
          <Suspense fallback={null}>
            <Toaster position="bottom-right" />
          </Suspense>
        </JobsProvider>
        </RouteMonitoringProvider>
      </OrgSettingsProvider>
    </AppErrorBoundary>
  )
}
