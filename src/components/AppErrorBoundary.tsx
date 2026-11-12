import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  isChunkLoadError,
  readChunkReloadAt,
  tryReloadForChunkError,
} from '../lib/chunkLoadRecovery'

type State = {
  error: Error | null
  recovering: boolean
}

export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, recovering: false }

  private resetAfterHotUpdate = () => {
    if (this.state.error || this.state.recovering) this.setState({ error: null, recovering: false })
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidMount() {
    import.meta.hot?.on('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HTR application error', error, info)
    if (tryReloadForChunkError({ error })) {
      this.setState({ error: null, recovering: true })
    }
  }

  componentWillUnmount() {
    import.meta.hot?.off('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  render() {
    if (this.state.recovering) {
      return (
        <main className="app-error-screen">
          <div>
            <span><RefreshCw size={21} /></span>
            <h1>Updating workspace</h1>
            <p>Loading the latest version. Your jobs and history stay in this browser.</p>
          </div>
        </main>
      )
    }

    if (!this.state.error) return this.props.children

    const chunkFailure = isChunkLoadError(this.state.error)
    const reloadAlreadyTried = chunkFailure && readChunkReloadAt(
      typeof sessionStorage === 'undefined' ? null : sessionStorage,
    ) != null

    return (
      <main className="app-error-screen">
        <div>
          <span><AlertTriangle size={21} /></span>
          {reloadAlreadyTried ? (
            <>
              <h1>A new version is available — reload</h1>
              <p>This tab is still on an older build. Reload to continue. Your jobs and history stay in this browser.</p>
            </>
          ) : (
            <>
              <h1>HTR could not display this view</h1>
              <p>The prototype encountered a browser runtime error. Reload the workspace to restore the current session.</p>
            </>
          )}
          <button type="button" onClick={() => window.location.reload()}><RefreshCw size={15} /> Reload HTR</button>
          <details><summary>Technical details</summary><code>{this.state.error.message}</code></details>
        </div>
      </main>
    )
  }
}
