import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { migrateLegacyStorage } from './lib/browserStore'
import { installChunkLoadRecovery } from './lib/chunkLoadRecovery'
import './index.css'

migrateLegacyStorage()
installChunkLoadRecovery()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
