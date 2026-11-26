import './styles/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { trackFocusRing } from './state/ui/focusRing'

trackFocusRing()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary onReload={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
