import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './features/dispatch/dispatch-polish.css'
import App from './App.tsx'
import DispatchAuthGate from './features/dispatch/DispatchAuthGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DispatchAuthGate><App /></DispatchAuthGate>
  </StrictMode>,
)
