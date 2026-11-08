import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, ChevronDown, CheckSquare, Square,
  Grid3X3, List, X, CheckCircle, Car, Train, Plug, ParkingSquare,
  Database, Cloud, SlidersHorizontal, Map
} from 'lucide-react'
import DatasetDetailPanel, { type Dataset } from '../components/DatasetDetailPanel'
import MobilityHeatmap from '../components/MobilityHeatmap'

const categories = [
  { name: 'Air and Space Travel', count: 1 },
  { name: 'Cycle Network Data', count: 1 },
  { name: 'Filling and Charging Stations', count: 7 },
  { name: 'General Information For Trip-planning', count: 4 },
  { name: 'Other', count: 43 },
  { name: 'Parking Service and Rest Areas', count: 9 },
  { name: 'Road Events and Conditions', count: 29 },
  { name: 'Static Road Network Data', count: 11 },
  { name: 'Traffic Information', count: 18 },
  { name: 'Public Transport', count: 11 },
]

const filterSections = [
  { label: 'Transport Mode', options: ['Road', 'Rail', 'Air', 'Water', 'Cycling'] },
  { label: 'Data Model', options: ['DATEX II', 'GTFS-RT', 'JSON-LD', 'OpenAPI'] },
  { label: 'Geo Reference Method', options: ['Bounding Box', 'GeoJSON', 'WGS84'] },
  { label: 'Organisation', options: ['BMW AG', 'Robert Bosch GmbH', 'City of Munich', 'VRR GmbH'] },
  { label: 'Data Offer Type', options: ['Available', 'Contract required', 'Restricted'] },
]

const datasets: Dataset[] = [
  { id: 1, org: 'RheinLift Logistics', status: 'Available', title: 'Pool Dataset', category: 'Air and Space Travel', icon: Cloud, verified: false },
  { id: 2, org: 'RheinLift Logistics', status: 'Available', title: 'Test Dataset', category: 'General Information', icon: Database, verified: false },
  { id: 3, org: 'BMW AG', status: 'Available', title: 'BMW SRTI feed for DFRS', category: 'Road Events and Conditions', icon: Car, verified: true },
  { id: 4, org: 'BMW AG', status: 'Available', title: 'BMW Accident', category: 'Road Events and Conditions', icon: Car, verified: true },
  { id: 5, org: 'BMW AG', status: 'Available', title: 'BMW Slippery Road', category: 'Road Events and Conditions', icon: Car, verified: true },
  { id: 6, org: 'BMW AG', status: 'Available', title: 'BMW Dangerous Slowdown', category: 'Road Events and Conditions', icon: Car, verified: true },
  { id: 7, org: 'BMW AG', status: 'Available', title: 'BMW Fog', category: 'Road Events and Conditions', icon: Car, verified: true },
  { id: 8, org: 'BMW AG', status: 'Available', title: 'BMW Breakdown', category: 'Road Events and Conditions', icon: Car, verified: true },
  { id: 9, org: 'BMW AG', status: 'Available', title: 'BMW Heavy Rain', category: 'Road Events and Conditions', icon: Car, verified: true },
  { id: 10, org: 'Robert Bosch GmbH', status: 'Available', title: 'Bosch LowVisibility NL for DFRS', category: 'Road Events and Conditions', icon: Cloud, verified: true },
  { id: 11, org: 'VRR GmbH', status: 'Available', title: 'Public Transport Disruptions NRW', category: 'Public Transport', icon: Train, verified: true },
  { id: 12, org: 'Bundesnetzagentur', status: 'Available', title: 'EV Charging Points Germany', category: 'Filling and Charging Stations', icon: Plug, verified: true },
  { id: 13, org: 'Hamburg Parkhaus GmbH', status: 'Available', title: 'Parking Availability Hamburg', category: 'Parking Service and Rest Areas', icon: ParkingSquare, verified: false },
  { id: 14, org: 'City of Munich', status: 'Available', title: 'Real-Time Traffic Flow Munich', category: 'Traffic Information', icon: Car, verified: true },
]

export default function DataCatalogue() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [view, setView] = useState<'grid' | 'list' | 'map'>('grid')
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [openFilters, setOpenFilters] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('Most Recent')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [activeTab, setActiveTab] = useState<'catalogue' | 'my-offers'>('catalogue')
  const [selectedAdvanced, setSelectedAdvanced] = useState<string[]>([])
  const [filtersVisible, setFiltersVisible] = useState(true)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearchQuery(q)
  }, [searchParams])

  const toggleCategory = (name: string) =>
    setSelectedCategories(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])

  const toggleFilter = (label: string) =>
    setOpenFilters(prev => prev.includes(label) ? prev.filter(f => f !== label) : [...prev, label])

  const filtered = datasets.filter(d => {
    const matchSearch = !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.org.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchCat = selectedCategories.length === 0 || selectedCategories.includes(d.category)
    const matchAdvanced = selectedAdvanced.every(option => {
      if (['Available', 'Contract required', 'Restricted'].includes(option)) return option === d.status
      if (filterSections[3].options.includes(option)) return d.org === option
      if (option === 'Road') return !d.category.includes('Public Transport') && !d.category.includes('Air')
      if (option === 'Rail') return d.category.includes('Public Transport')
      if (option === 'Air') return d.category.includes('Air')
      if (option === 'DATEX II') return d.category.includes('Road') || d.category.includes('Traffic')
      if (option === 'GTFS-RT') return d.category.includes('Public Transport')
      return true
    })
    return matchSearch && matchCat && matchAdvanced
  })

  const selectedIdx = selectedDataset ? filtered.findIndex(d => d.id === selectedDataset.id) : -1

  return (
    <div className="catalogue-page" style={{ display: 'flex', height: '100%' }}>
      {/* ── Left sidebar ─────────────────────────────────────── */}
      {filtersVisible && <aside className="catalogue-filters" style={{
        width: 240, flexShrink: 0,
        borderRight: '1px solid var(--divider)',
        background: 'var(--bg-card)',
        overflowY: 'auto',
        padding: '20px 0',
      }}>
        <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--divider)', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Data Category
          </div>
          {categories.map(cat => {
            const active = selectedCategories.includes(cat.name)
            return (
              <button key={cat.name} onClick={() => toggleCategory(cat.name)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '6px 8px', borderRadius: 8,
                background: active ? 'var(--accent-soft)' : 'transparent',
                cursor: 'pointer', marginBottom: 1,
                transition: 'background 100ms',
              }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {active
                  ? <CheckSquare size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  : <Square size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                }
                <span style={{
                  flex: 1, textAlign: 'left', fontSize: 14, lineHeight: 1.4,
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}>
                  {cat.name}
                </span>
                <span style={{
                  fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                  color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                  background: active ? 'var(--accent-light)' : 'var(--bg-base)',
                  padding: '1px 5px', borderRadius: 99, flexShrink: 0,
                }}>
                  {cat.count}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Filters
          </div>
          {filterSections.map(section => (
            <div key={section.label} style={{ borderBottom: '1px solid var(--divider)', paddingBottom: 8, marginBottom: 8 }}>
              <button
                onClick={() => toggleFilter(section.label)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '6px 0',
                  background: 'none', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{section.label}</span>
                <ChevronDown size={12} style={{
                  color: 'var(--text-tertiary)',
                  transform: openFilters.includes(section.label) ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms',
                }} />
              </button>
              {openFilters.includes(section.label) && (
                <div style={{ paddingLeft: 4 }}>
                  {section.options.map(opt => (
                    <button key={opt} onClick={() => setSelectedAdvanced(current => current.includes(opt) ? current.filter(item => item !== opt) : [...current, opt])} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      width: '100%', padding: '5px 4px',
                      background: 'none', cursor: 'pointer',
                    }}>
                      {selectedAdvanced.includes(opt) ? <CheckSquare size={12} style={{ color: 'var(--accent)' }} /> : <Square size={12} style={{ color: 'var(--text-tertiary)' }} />}
                      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{opt}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>}

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="catalogue-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Tabs */}
        <div style={{
          borderBottom: '1px solid var(--divider)',
          background: 'var(--bg-card)',
          padding: '0 20px',
          display: 'flex', gap: 24, flexShrink: 0,
        }}>
          {(['catalogue', 'my-offers'] as const).map(tab => (
            <button key={tab} onClick={() => tab === 'my-offers' ? navigate('/connector/data-offers') : setActiveTab(tab)} style={{
              padding: '14px 0',
              fontSize: 14, fontWeight: 500,
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--text-primary)' : '2px solid transparent',
              background: 'none', cursor: 'pointer',
              transition: 'color 100ms',
            }}>
              {tab === 'catalogue' ? 'Data Catalogue' : 'My Data Offers'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Search + controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10, padding: '9px 12px',
              boxShadow: 'var(--shadow-xs)',
            }}>
              <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search datasets, providers, categories…"
                aria-label="Search datasets, providers, and categories"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 14, color: 'var(--text-primary)',
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 0 }}>
                  <X size={13} />
                </button>
              )}
            </div>
            <button onClick={() => setFiltersVisible(current => !current)} aria-pressed={filtersVisible} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-xs)',
              fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}>
              <SlidersHorizontal size={13} />
              {filtersVisible ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          {/* Results bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{filtered.length} results</span>
              {(selectedCategories.length > 0 || selectedAdvanced.length > 0) && (
                <>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {[...selectedCategories, ...selectedAdvanced].map(cat => (
                      <span key={cat} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 14, fontWeight: 500,
                        background: 'var(--accent-light)', color: 'var(--accent)',
                        padding: '2px 8px', borderRadius: 99,
                      }}>
                        {cat}
                        <button onClick={() => selectedCategories.includes(cat) ? toggleCategory(cat) : setSelectedAdvanced(current => current.filter(item => item !== cat))} aria-label={`Remove ${cat} filter`} style={{ background: 'none', cursor: 'pointer', lineHeight: 0 }}>
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button onClick={() => { setSelectedCategories([]); setSelectedAdvanced([]) }} style={{
                    fontSize: 14, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer',
                  }}>
                    Clear all
                  </button>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Sort by</span>
              <div style={{ position: 'relative' }}>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                  appearance: 'none',
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '5px 24px 5px 10px',
                  fontSize: 14, color: 'var(--text-primary)',
                  background: 'var(--bg-card)', cursor: 'pointer', outline: 'none',
                }}>
                  <option>Most Recent</option>
                  <option>Name A–Z</option>
                  <option>Provider</option>
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              </div>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)' }}>
                {(['grid', 'list', 'map'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{
                    padding: '5px 8px', lineHeight: 0, cursor: 'pointer',
                    background: view === v ? 'var(--bg-base)' : 'transparent',
                    transition: 'background 100ms',
                    borderRight: v !== 'map' ? '1px solid var(--border)' : 'none',
                    }}
                    title={`${v[0].toUpperCase()}${v.slice(1)} view`}
                    aria-label={`${v} view`}
                    aria-pressed={view === v}
                  >
                    {v === 'grid'
                      ? <Grid3X3 size={13} style={{ color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)' }} />
                      : v === 'list'
                        ? <List size={13} style={{ color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)' }} />
                        : <Map size={13} style={{ color: view === v ? 'var(--text-primary)' : 'var(--text-tertiary)' }} />
                    }
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', textAlign: 'center' }}>
              <Database size={36} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No datasets found</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Try a different search or clear the filters.</div>
              {(searchQuery || selectedCategories.length > 0 || selectedAdvanced.length > 0) && (
                <button onClick={() => { setSearchQuery(''); setSelectedCategories([]); setSelectedAdvanced([]) }}
                  style={{ marginTop: 12, fontSize: 14, fontWeight: 500, color: 'var(--accent)', background: 'none', cursor: 'pointer' }}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : view === 'map' ? (
            <div className="catalogue-map-view">
              <div className="catalogue-map-heading">
                <div><strong>Geographic dataset coverage</strong><span>Select a hotspot to inspect matching data.</span></div>
                <span>Germany · Live coverage</span>
              </div>
              <MobilityHeatmap
                mode="weather"
                interactivePoints
                onPointSelect={(id) => {
                  const match = filtered.find(dataset => dataset.id === id) ?? filtered[0]
                  setSelectedDataset(match)
                }}
              />
            </div>
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {filtered.map(ds => {
                const Icon = ds.icon
                const isSelected = selectedDataset?.id === ds.id
                return (
                  <button key={ds.id}
                    onClick={() => setSelectedDataset(isSelected ? null : ds)}
                    style={{
                      textAlign: 'left', background: 'var(--bg-card)',
                      borderRadius: 12,
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'border-color 120ms, box-shadow 120ms, transform 120ms',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
                        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-xs)'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg-base)', borderRadius: 7, padding: '3px 8px',
                      }}>
                        {Icon && <Icon size={12} style={{ color: 'var(--navy-mid)' }} />}
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{ds.category.split(' ').slice(0, 2).join(' ')}</span>
                        {ds.verified && <CheckCircle size={10} style={{ color: 'var(--green-text)' }} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--green-text)' }}>{ds.status}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', lineHeight: 1.3, marginBottom: 4 }}>
                      {ds.title}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{ds.org}</div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(ds => {
                const Icon = ds.icon
                const isSelected = selectedDataset?.id === ds.id
                return (
                  <button key={ds.id}
                    onClick={() => setSelectedDataset(isSelected ? null : ds)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      textAlign: 'left', background: 'var(--bg-card)',
                      borderRadius: 12,
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      boxShadow: 'var(--shadow-xs)',
                      padding: '12px 16px', cursor: 'pointer',
                      transition: 'border-color 120ms',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,113,227,0.4)' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: 'var(--bg-base)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {Icon && <Icon size={14} style={{ color: 'var(--navy-mid)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{ds.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{ds.org}</span>
                        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>·</span>
                        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{ds.category}</span>
                        {ds.verified && <CheckCircle size={10} style={{ color: 'var(--green-text)' }} />}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--green-text)' }}>{ds.status}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dataset detail panel */}
      {selectedDataset && (
        <DatasetDetailPanel
          dataset={selectedDataset}
          onClose={() => setSelectedDataset(null)}
          onPrev={() => selectedIdx > 0 && setSelectedDataset(filtered[selectedIdx - 1])}
          onNext={() => selectedIdx < filtered.length - 1 && setSelectedDataset(filtered[selectedIdx + 1])}
          hasPrev={selectedIdx > 0}
          hasNext={selectedIdx < filtered.length - 1}
        />
      )}
    </div>
  )
}
