import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="market-page not-found-page">
      <section className="data-partners-placeholder">
        <span><Compass size={26} /></span>
        <div>
          <small>Page not found</small>
          <h1>That page is not in this app</h1>
          <p>The address does not match a Heavy transport route check screen. Use search or go back to overview.</p>
          <div className="not-found-actions">
            <Link to="/" className="market-button primary">Overview</Link>
            <Link to="/route-checks" className="market-button secondary">Route checks</Link>
            <Link to="/search" className="market-button secondary">Search</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
