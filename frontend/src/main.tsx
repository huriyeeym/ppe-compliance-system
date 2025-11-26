import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { DomainProvider } from './context/DomainContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DomainProvider>
        <App />
      </DomainProvider>
    </AuthProvider>
  </StrictMode>,
)

