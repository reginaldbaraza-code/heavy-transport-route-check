import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { migrateLegacyStorage } from './lib/browserStore'
import { applyBootLcp } from './lib/lcpHeading'
import './index.css'

migrateLegacyStorage()
applyBootLcp()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
