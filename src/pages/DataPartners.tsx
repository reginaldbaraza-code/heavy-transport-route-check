import { ArrowLeft, DatabaseZap, Hourglass } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DataPartners() {
  return (
    <div className="market-page data-partners-page">
      <Link to="/" className="route-back"><ArrowLeft size={16} /> Operations overview</Link>
      <section className="data-partners-placeholder">
        <span><DatabaseZap size={26} /></span>
        <div>
          <small><Hourglass size={16} /> Coming later</small>
          <h1>Data partners</h1>
          <p>Live partner data (Mobility Data Space) is planned for a later release. This MVP uses public roadworks data and test scenarios.</p>
        </div>
      </section>
    </div>
  )
}
