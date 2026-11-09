import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Connectors from './pages/Connectors'
import ConnectorDashboard from './pages/ConnectorDashboard'
import RouteIntelligence from './pages/RouteIntelligence'
import LiveMap from './pages/LiveMap'
import Settings from './pages/Settings'
import TransferProcesses from './pages/connector/TransferProcesses'
import EDRs from './pages/connector/EDRs'
import Assets from './pages/connector/Assets'
import Policies from './pages/connector/Policies'
import DataOffers from './pages/connector/DataOffers'
import Negotiations from './pages/connector/Negotiations'
import Approvals from './pages/connector/Approvals'
import MarketplaceOverview from './pages/MarketplaceOverview'
import DiscoverData from './pages/DiscoverData'
import OfferDetail from './pages/OfferDetail'
import ProviderProfile from './pages/ProviderProfile'
import Recommendations from './pages/Recommendations'
import DataNeeds from './pages/DataNeeds'
import DataNeedForm from './pages/DataNeedForm'
import DataNeedDetail from './pages/DataNeedDetail'
import MarketplaceRequests from './pages/MarketplaceRequests'
import RequestForm from './pages/RequestForm'
import MyOffers from './pages/MyOffers'
import PublishOffer from './pages/PublishOffer'
import Deals from './pages/Deals'
import MarketplaceActivity from './pages/MarketplaceActivity'
import { MarketplaceProvider } from './context/MarketplaceContext'
import CompareOffers from './pages/CompareOffers'
import AppErrorBoundary from './components/AppErrorBoundary'
import { RouteMonitoringProvider } from './context/RouteMonitoringContext'
import { OrgSettingsProvider } from './context/OrgSettingsContext'
import DataPartners from './pages/DataPartners'

export default function App() {
  return (
    <AppErrorBoundary>
      <MarketplaceProvider>
        <OrgSettingsProvider>
        <RouteMonitoringProvider>
          <BrowserRouter>
          <Routes>
          <Route path="/" element={<Layout />}>
          <Route index element={<MarketplaceOverview />} />
          <Route path="discover" element={<DiscoverData />} />
          <Route path="discover/:offerId" element={<OfferDetail />} />
          <Route path="providers/:providerId" element={<ProviderProfile />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="needs" element={<DataNeeds />} />
          <Route path="needs/new" element={<DataNeedForm />} />
          <Route path="needs/:needId" element={<DataNeedDetail />} />
          <Route path="needs/:needId/edit" element={<DataNeedForm />} />
          <Route path="offers" element={<MyOffers />} />
          <Route path="offers/new" element={<PublishOffer />} />
          <Route path="offers/:offerId/edit" element={<PublishOffer />} />
          <Route path="requests" element={<MarketplaceRequests />} />
          <Route path="requests/new" element={<RequestForm />} />
          <Route path="deals" element={<Deals />} />
          <Route path="activity" element={<MarketplaceActivity />} />
          <Route path="compare" element={<CompareOffers />} />
          <Route path="catalogue" element={<Navigate to="/discover" replace />} />
          <Route path="route-checks" element={<RouteIntelligence />} />
          <Route path="data-partners" element={<DataPartners />} />
          <Route path="map-explorer" element={<LiveMap />} />
          <Route path="live-map" element={<Navigate to="/map-explorer" replace />} />
          <Route path="catalogue/request" element={<Navigate to="/discover" replace />} />
          <Route path="connectors" element={<Connectors />} />
          <Route path="connector/dashboard" element={<ConnectorDashboard />} />
          <Route path="connector/create-offer" element={<Navigate to="/offers/new" replace />} />
          <Route path="connector/transfers" element={<TransferProcesses />} />
          <Route path="connector/edrs" element={<EDRs />} />
          <Route path="connector/assets" element={<Assets />} />
          <Route path="connector/policies" element={<Policies />} />
          <Route path="connector/data-offers" element={<DataOffers />} />
          <Route path="connector/negotiations" element={<Negotiations />} />
          <Route path="connector/approvals" element={<Approvals />} />
          <Route path="contracts" element={<Navigate to="/deals" replace />} />
          <Route path="my-data" element={<Navigate to="/offers" replace />} />
          <Route path="my-data/route-intelligence" element={<Navigate to="/route-checks" replace />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
          </BrowserRouter>
        </RouteMonitoringProvider>
        </OrgSettingsProvider>
      </MarketplaceProvider>
    </AppErrorBoundary>
  )
}
