import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  private resetAfterHotUpdate = () => {
    if (this.state.error) this.setState({ error: null })
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidMount() {
    import.meta.hot?.on('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HTR application error', error, info)
  }

  componentWillUnmount() {
    import.meta.hot?.off('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="app-error-screen">
        <Alert className="max-w-md">
          <AlertTriangle />
          <AlertTitle>HTR could not display this view</AlertTitle>
          <AlertDescription>
            The prototype encountered a browser runtime error. Reload the workspace to restore the current session.
          </AlertDescription>
          <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
            <RefreshCw size={15} /> Reload HTR
          </Button>
          <details>
            <summary>Technical details</summary>
            <code>{this.state.error.message}</code>
          </details>
        </Alert>
      </main>
    )
  }
}
