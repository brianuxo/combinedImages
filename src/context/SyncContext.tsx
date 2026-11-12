import { useMemo, type ReactNode } from 'react'
import { STUB_SYNC, SyncContext, type SyncApi } from './sync'

/**
 * Provider de sincronización simplificado.
 *
 * Ya no se requiere frase de sincronización: los datos se guardan
 * directamente en el servidor a través de FavoritesContext y SettingsContext.
 * Este provider se conserva para no romper los componentes que consultan
 * `useSync()`.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const value = useMemo<SyncApi>(() => STUB_SYNC, [])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
