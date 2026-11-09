import { Link } from 'react-router-dom'
import {
  FileJson, Map, Route, ShieldCheck, Upload, ArrowRight,
} from 'lucide-react'
import { MarketplacePageHeader } from '../components/MarketplaceUI'

export default function MarketplaceOverview() {
  return (
    <div className="market-page transport-overview">
      <MarketplacePageHeader
        eyebrow="Heavy transport operations"
        title="Know whether the permitted route is usable"
        description="Check the exact approved route against current roadworks, closures, and trusted on-site reports before the transport departs."
        actions={
          <>
            <Link to="/map-explorer" className="market-button secondary"><Map size={16} /> Open route monitor</Link>
            <Link to="/route-checks" className="market-button primary"><Upload size={16} /> Import permitted route</Link>
          </>
        }
      />

      <section className="transport-empty-state">
        <div className="empty-state-card">
          <Upload size={48} />
          <h2>No saved routes yet</h2>
          <p>Import your first permitted route to check against current road conditions.</p>
          <Link to="/route-checks" className="market-button primary">
            <Upload size={16} /> Check your first route
          </Link>
        </div>
      </section>

      <section className="transport-workflow" aria-label="Heavy transport route monitoring workflow">
        <div><span>1</span><FileJson size={18} /><strong>Import the permit</strong><p>Upload the exact VEMAGS route and approved transport dimensions.</p></div>
        <ArrowRight size={18} />
        <div><span>2</span><Route size={18} /><strong>Check the route</strong><p>Compare only the approved route with current restrictions and roadworks.</p></div>
        <ArrowRight size={18} />
        <div><span>3</span><ShieldCheck size={18} /><strong>Monitor until departure</strong><p>Receive early warnings when conditions change or evidence is uncertain.</p></div>
      </section>

      <div className="market-two-column">
        <section className="market-section">
          <div className="market-section-header compact">
            <div><span className="market-eyebrow">How it works</span><h2>Route check process</h2></div>
          </div>
          <div className="feature-list">
            <div className="feature-item">
              <strong>Import GPX or VEMAGS format</strong>
              <p>Upload your permitted route file. Sample test permits available for demonstration.</p>
            </div>
            <div className="feature-item">
              <strong>Real-time validation</strong>
              <p>Route checked against current road conditions, restrictions, and operational evidence.</p>
            </div>
            <div className="feature-item">
              <strong>Clear verdict system</strong>
              <p><strong className="verdict-ready">READY</strong> to depart, <strong className="verdict-verify">VERIFY</strong> evidence, or <strong className="verdict-hold">HOLD</strong> departure.</p>
            </div>
            <div className="feature-item">
              <strong>Export and share</strong>
              <p>Generate timestamped snapshots of route checks for dispatch records.</p>
            </div>
          </div>
        </section>

        <section className="market-section">
          <div className="market-section-header compact">
            <div><span className="market-eyebrow">Important</span><h2>Usage disclaimers</h2></div>
          </div>
          <div className="disclaimer-list">
            <div className="disclaimer-item">
              <strong>⚠️ Informational only</strong>
              <p>Route checks are informational snapshots. They do not grant permission to depart or replace official permit validity.</p>
            </div>
            <div className="disclaimer-item">
              <strong>🔍 Manual verification required</strong>
              <p>Bridge clearances, local road conditions, and some restrictions require manual verification with authorities.</p>
            </div>
            <div className="disclaimer-item">
              <strong>📊 Coverage limitations</strong>
              <p>Current coverage: German Autobahns. Local roads and bridge clearance data require additional integration.</p>
            </div>
            <div className="disclaimer-item">
              <strong>🕐 Data freshness</strong>
              <p>Source publication times and retrieval timestamps are shown. Always confirm current conditions before departure.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
