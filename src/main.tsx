import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DispatchAuthGate from './features/dispatch/DispatchAuthGate.tsx'
import './features/dispatch/dispatch-reference-final.css'
import './features/dispatch/dispatch-reference-refine.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DispatchAuthGate><App /></DispatchAuthGate>
  </StrictMode>,
)
