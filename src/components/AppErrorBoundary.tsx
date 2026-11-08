import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

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
    console.error('MDS application error', error, info)
  }

  componentWillUnmount() {
    import.meta.hot?.off('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="app-error-screen">
        <div>
          <span><AlertTriangle size={21} /></span>
          <h1>MDS could not display this view</h1>
          <p>The prototype encountered a browser runtime error. Reload the workspace to restore the current session.</p>
          <button type="button" onClick={() => window.location.reload()}><RefreshCw size={15} /> Reload MDS</button>
          <details><summary>Technical details</summary><code>{this.state.error.message}</code></details>
        </div>
      </main>
    )
  }
}
