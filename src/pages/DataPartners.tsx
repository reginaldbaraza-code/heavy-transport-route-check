import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import MDSPlaceholder from '../components/MDSPlaceholder'

export default function DataPartners() {
  return (
    <div className="market-page data-partners-page">
      <Link to="/" className="route-back"><ArrowLeft size={16} /> Overview</Link>
      <MDSPlaceholder
        feature="Data Partners"
        description="Partner feeds over the Mobility Data Space (MDS) would appear here. Live checks today use the keyless Autobahn GmbH API, a MIA DATEX snapshot via Mobilithek / MobiData BW, and Baden-Württemberg BEMaS roadworks. Bridge and clearance stay a manual dispatcher tick."
      />
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
