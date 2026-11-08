import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  initialNeeds, initialOffers, initialRequests, providers,
  type DataNeed, type DataOffer, type DataRequest, type RequestStatus,
} from '../data/marketplace'

type MarketplaceState = {
  offers: DataOffer[]
  needs: DataNeed[]
  requests: DataRequest[]
  savedOfferIds: string[]
  compareOfferIds: string[]
  dismissedRecommendationIds: string[]
  onboardingComplete: boolean
  preferences: {
    organizationType: string
    topics: string[]
    goal: string
    regions: string
    role: string
    detailLevel: string
  }
  addNeed: (need: Omit<DataNeed, 'id' | 'matches' | 'createdAt'>) => string
  updateNeed: (id: string, need: Partial<DataNeed>) => void
  addOffer: (offer: Omit<DataOffer, 'id' | 'publishedAt' | 'lastUpdated' | 'popularity'>) => string
  updateOffer: (id: string, offer: Partial<DataOffer>) => void
  submitRequest: (request: Omit<DataRequest, 'id' | 'updatedAt'>) => string
  updateRequestStatus: (id: string, status: RequestStatus) => void
  toggleSaved: (id: string) => void
  toggleCompare: (id: string) => void
  dismissRecommendation: (id: string) => void
  completeOnboarding: (preferences?: Partial<MarketplaceState['preferences']>) => void
}

const MarketplaceContext = createContext<MarketplaceState | null>(null)

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [offers, setOffers] = useState(initialOffers)
  const [needs, setNeeds] = useState(initialNeeds)
  const [requests, setRequests] = useState(initialRequests)
  const [savedOfferIds, setSavedOfferIds] = useState<string[]>(['ev-availability-europe'])
  const [compareOfferIds, setCompareOfferIds] = useState<string[]>([])
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<string[]>([])
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    try {
      return window.sessionStorage.getItem('mds-onboarding-complete') === 'true'
    } catch {
      return false
    }
  })
  const [preferences, setPreferences] = useState({
    organizationType: '',
    topics: [] as string[],
    goal: '',
    regions: '',
    role: 'Both finding and offering data',
    detailLevel: 'Business overview first',
  })

  const value = useMemo<MarketplaceState>(() => ({
    offers,
    needs,
    requests,
    savedOfferIds,
    compareOfferIds,
    dismissedRecommendationIds,
    onboardingComplete,
    preferences,
    addNeed: need => {
      const id = `need-${Date.now()}`
      setNeeds(current => [{ ...need, id, matches: 0, createdAt: new Date().toISOString().slice(0, 10) }, ...current])
      return id
    },
    updateNeed: (id, update) => setNeeds(current => current.map(need => need.id === id ? { ...need, ...update } : need)),
    addOffer: offer => {
      const id = `offer-${Date.now()}`
      setOffers(current => [{ ...offer, id, popularity: 0, publishedAt: new Date().toISOString().slice(0, 10), lastUpdated: 'Just now' }, ...current])
      return id
    },
    updateOffer: (id, update) => setOffers(current => current.map(offer => offer.id === id ? { ...offer, ...update } : offer)),
    submitRequest: request => {
      const id = `REQ-${1050 + requests.length}`
      setRequests(current => [{ ...request, id, updatedAt: 'Just now' }, ...current])
      return id
    },
    updateRequestStatus: (id, status) => setRequests(current => current.map(request => request.id === id ? { ...request, status, updatedAt: 'Just now' } : request)),
    toggleSaved: id => setSavedOfferIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]),
    toggleCompare: id => setCompareOfferIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 3 ? [...current, id] : current),
    dismissRecommendation: id => setDismissedRecommendationIds(current => [...current, id]),
    completeOnboarding: update => {
      if (update) setPreferences(current => ({ ...current, ...update }))
      setOnboardingComplete(true)
      try {
        window.sessionStorage.setItem('mds-onboarding-complete', 'true')
      } catch {
        // Restricted preview contexts may disable web storage; in-memory state still works.
      }
    },
  }), [offers, needs, requests, savedOfferIds, compareOfferIds, dismissedRecommendationIds, onboardingComplete, preferences])

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>
}

export function useMarketplace() {
  const context = useContext(MarketplaceContext)
  if (!context) throw new Error('useMarketplace must be used within MarketplaceProvider')
  return context
}

export function getProvider(id: string) {
  return providers.find(provider => provider.id === id)
}
