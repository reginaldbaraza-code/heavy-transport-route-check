import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { useJobs } from '../context/JobsContext'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { SEARCH_EMPTY_HELP, searchAppData } from '../lib/appSearch'

const KIND_LABEL = {
  job: 'Saved job',
  check: 'Saved check',
  permit: 'Sample permit',
  scenario: 'Scenario',
  alert: 'Alert',
}

export default function SearchResults() {
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const { jobs } = useJobs()
  const { history, alerts } = useRouteMonitoring()
  const hits = useMemo(
    () => searchAppData({ query, jobs, history, alerts }),
    [alerts, history, jobs, query],
  )

  return (
    <div className="market-page search-results-page">
      <PageHeader
        eyebrow="Search"
        title={query ? `Results for “${query}”` : 'Search this browser'}
        description="Looks through saved jobs, route checks, sample permits, scenarios, and alerts in this browser."
      />
      {!query && (
        <p className="storage-note">{SEARCH_EMPTY_HELP}</p>
      )}
      {query && hits.length === 0 && (
        <div className="market-empty">
          <Search size={30} />
          <h2>Nothing matched “{query}”</h2>
          <p>{SEARCH_EMPTY_HELP}</p>
          <Button asChild><Link to="/route-checks">Open route checks</Link></Button>
        </div>
      )}
      {hits.length > 0 && (
        <section className="search-hit-list" aria-label="Search results">
          {hits.map(hit => (
            <Link to={hit.href} key={hit.id} className="search-hit">
              <small>{KIND_LABEL[hit.kind]}</small>
              <strong>{hit.title}</strong>
              <span>{hit.detail}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
