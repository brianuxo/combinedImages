import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { FavoritesProvider } from './context/FavoritesContext'
import { SettingsProvider } from './context/SettingsContext'
import { SyncProvider } from './context/SyncContext'
import { ToastProvider } from './context/ToastContext'
import { registerServiceWorker } from './lib/pwa'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <FavoritesProvider>
        <ToastProvider>
          <SyncProvider>
            <App />
          </SyncProvider>
        </ToastProvider>
      </FavoritesProvider>
    </SettingsProvider>
  </StrictMode>,
)
