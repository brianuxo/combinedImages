import { createContext, useContext } from 'react'

/**
 * Stub de sincronización: ahora los datos se guardan directamente en el
 * servidor sin necesidad de frase de sincronización. Este contexto se
 * conserva para no romper los componentes que aún lo consultan.
 */
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncApi {
  /** Siempre activo: los datos van directo al servidor. */
  enabled: boolean
  status: SyncStatus
  error: string | null
  lastSyncAt: number | null
  revision: number
  pending: boolean
  enable: (passphrase: string) => Promise<boolean>
  disable: () => void
  syncNow: () => Promise<void>
}

export const STUB_SYNC: SyncApi = {
  enabled: true,
  status: 'idle',
  error: null,
  lastSyncAt: null,
  revision: 0,
  pending: false,
  enable: async () => true,
  disable: () => {},
  syncNow: async () => {},
}

export const SyncContext = createContext<SyncApi | null>(null)

export function useSync(): SyncApi {
  const context = useContext(SyncContext)
  if (!context) throw new Error('useSync debe usarse dentro de SyncProvider')
  return context
}
