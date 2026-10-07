import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { captureInstallPrompt } from './components/InstallPrompt.jsx'

// Chrome may offer "install" before React mounts — keep the event for the install banner
captureInstallPrompt()

// Service worker makes the app installable and opens it offline (production builds only,
// so the dev server is never served stale files)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
