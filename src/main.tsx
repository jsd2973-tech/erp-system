import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DispatchAuthGate from './features/dispatch/DispatchAuthGate.tsx'
import './features/dispatch/dispatch-polish.css'
import './features/dispatch/dispatch-modern.css'
import './features/dispatch/dispatch-final-tune.css'
import './features/dispatch/dispatch-suite.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DispatchAuthGate><App /></DispatchAuthGate>
  </StrictMode>,
)
