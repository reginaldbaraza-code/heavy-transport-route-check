import { ArrowLeft, DatabaseZap, ShieldAlert } from 'lucide-react'
import '../styles/pages.css'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function DataPartners() {
  return (
    <div className="market-page data-partners-page space-y-5">
      <Button asChild variant="ghost" className="route-back -ml-2 w-fit">
        <Link to="/"><ArrowLeft size={16} /> Overview</Link>
      </Button>
      <Card className="data-partners-placeholder w-full">
        <CardHeader className="gap-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-[var(--accent)]">
            <DatabaseZap size={22} />
          </span>
          <CardDescription>Coming later</CardDescription>
          <h1 className="font-heading text-2xl leading-tight font-medium">Data partners</h1>
        </CardHeader>
        <CardContent>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Partner feeds over the Mobility Data Space (MDS) are out of scope for this free MVP.
            Live checks today use the keyless Autobahn GmbH API, a MIA DATEX snapshot via Mobilithek / MobiData BW,
            and Baden-Württemberg BEMaS roadworks. Bridge and clearance stay a manual dispatcher tick.
          </p>
        </CardContent>
      </Card>
      <Card className="data-partners-plan">
        <CardHeader>
          <CardTitle>What is planned</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Signed MDS connectors for extra road-operator and city feeds, once a contract exists.</li>
            <li>Shared organisation profiles instead of browser-only settings.</li>
            <li>Background monitoring that does not need this tab to stay open.</li>
          </ul>
          <Alert>
            <ShieldAlert />
            <AlertTitle>Not in this MVP</AlertTitle>
            <AlertDescription className="storage-note">
              MDS, paid Autobahn products, and registered Mobilithek APIs are not integrated here.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
