import { Link } from 'react-router-dom'
import '../styles/pages.css'
import { Compass } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card'

export default function NotFound() {
  return (
    <div className="market-page not-found-page">
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader className="gap-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-[var(--navy)]">
            <Compass size={22} />
          </span>
          <CardDescription>Page not found</CardDescription>
          <h1 className="font-heading text-2xl leading-tight font-medium">That page is not in this app</h1>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The address does not match a Heavy transport route check screen. Use search or go back to overview.
          </p>
          <div className="not-found-actions flex flex-wrap gap-2">
            <Button asChild><Link to="/">Overview</Link></Button>
            <Button asChild variant="outline"><Link to="/route-checks">Route checks</Link></Button>
            <Button asChild variant="outline"><Link to="/search">Search</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
