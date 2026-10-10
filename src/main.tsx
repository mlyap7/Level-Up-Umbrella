import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { captureInstallEvents } from './lib/install'
import { registerServiceWorker } from './lib/push'
import './styles.css'

captureInstallEvents()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
