import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  isChunkLoadError,
  readChunkReloadAt,
  tryReloadForChunkError,
  wasChunkReloadInitiated,
} from '../lib/chunkLoadRecovery'

type State = {
  error: Error | null
  recovering: boolean
}

function sessionStore(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage
}

export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, recovering: false }

  private resetAfterHotUpdate = () => {
    if (this.state.error || this.state.recovering) this.setState({ error: null, recovering: false })
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    if (isChunkLoadError(error)) {
      // Reload already kicked off (vite listener or import wrapper) — keep the
      // updating UI up while the document unloads; never flash the crash screen.
      if (wasChunkReloadInitiated()) {
        return { error: null, recovering: true }
      }
      const alreadyTried = readChunkReloadAt(sessionStore()) != null
      if (!alreadyTried) {
        // componentDidCatch will start the guarded reload.
        return { error: null, recovering: true }
      }
      // Persistent failure after a prior reload — show the new-version message.
      return { error, recovering: false }
    }
    return { error, recovering: false }
  }

  componentDidMount() {
    import.meta.hot?.on('vite:afterUpdate', this.resetAfterHotUpdate)
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      if (tryReloadForChunkError({ error })) {
        this.setState({ error: null, recovering: true })
        return
      }
      if (wasChunkReloadInitiated()) {
        this.setState({ error: null, recovering: true })
        return
      }
      // Guard already spent — surface the new-version UI without a spurious app-error log.
      return
    }
    console.error('HTR application error', error, info)
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
    const reloadAlreadyTried = chunkFailure && readChunkReloadAt(sessionStore()) != null

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
