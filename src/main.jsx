import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Register service worker + auto-reload on update.
// When a new sw.js deploys, the new SW installs (skipWaiting) and claims clients.
// We listen for `updatefound` and reload once the new worker activates so users
// always get fresh JS without having to manually clear their cache.
if ('serviceWorker' in navigator) {
  let reloading = false
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          // Only reload if there was already a controller (i.e. this is an UPDATE,
          // not the first install). Prevents a reload loop on a user's first visit.
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller && !reloading) {
            reloading = true
            window.location.reload()
          }
        })
      })
    }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
