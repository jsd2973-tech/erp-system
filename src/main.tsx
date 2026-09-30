import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './cardInputCompat'
import App from './App.tsx'
import AuthEntry from './AuthEntry.tsx'
import DispatchAuthGate from './features/dispatch/DispatchAuthGate.tsx'
import './features/dispatch/dispatch-premium.css'
import './features/dispatch/dispatch-responsive.css'
import './features/dispatch/dispatch-mobile-fixes.css'
import './features/dispatch/dispatch-alignment.css'
import './features/card/cardReceiptOcr.css'
import AppErrorBoundary from './components/AppErrorBoundary'
import { initializeErrorMonitoring } from './lib/errorMonitoring'

initializeErrorMonitoring({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.DEV ? 'development' : import.meta.env.VITE_MONITORING_ENVIRONMENT,
  release: import.meta.env.VITE_MONITORING_RELEASE,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthEntry>
        <DispatchAuthGate><App /></DispatchAuthGate>
      </AuthEntry>
    </AppErrorBoundary>
  </StrictMode>,
)
