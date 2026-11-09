import { ArrowLeft, DatabaseZap, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DataPartners() {
  return (
    <div className="market-page data-partners-page">
      <Link to="/" className="route-back"><ArrowLeft size={16} /> Overview</Link>
      <section className="data-partners-placeholder">
        <span><DatabaseZap size={26} /></span>
        <div>
          <small>Coming later</small>
          <h1>Data partners</h1>
          <p>
            Partner feeds over the Mobility Data Space (MDS) are out of scope for this free MVP.
            Live checks today use the keyless Autobahn GmbH API, a MIA DATEX snapshot via Mobilithek / MobiData BW,
            and Baden-Württemberg BEMaS roadworks. Bridge and clearance stay a manual dispatcher tick.
          </p>
        </div>
      </section>
      <section className="data-partners-plan">
        <h2>What is planned</h2>
        <ul>
          <li>Signed MDS connectors for extra road-operator and city feeds, once a contract exists.</li>
          <li>Shared organisation profiles instead of browser-only settings.</li>
          <li>Background monitoring that does not need this tab to stay open.</li>
        </ul>
        <p className="storage-note">
          <ShieldAlert size={14} /> MDS, paid Autobahn products, and registered Mobilithek APIs are not integrated here.
        </p>
      </section>
    </div>
  )
}
