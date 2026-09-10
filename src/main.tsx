import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthEntry from './AuthEntry.tsx'
import DispatchAuthGate from './features/dispatch/DispatchAuthGate.tsx'
import './features/dispatch/dispatch-premium.css'
import './features/dispatch/dispatch-responsive.css'
import './features/dispatch/dispatch-mobile-fixes.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthEntry>
      <DispatchAuthGate><App /></DispatchAuthGate>
    </AuthEntry>
  </StrictMode>,
)
