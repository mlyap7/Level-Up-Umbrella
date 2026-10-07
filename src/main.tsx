import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { captureInstallEvents } from './lib/install'
import './styles.css'

captureInstallEvents()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
