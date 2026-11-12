import { createContext, useContext } from 'react'
import type { SyncTombstone } from '../lib/sync'

/** Configuración guardada en este dispositivo para hablar con la instancia. */
export interface SyncConfig {
  enabled: boolean
  /** Credencial Bearer derivada de la frase (no es la frase). */
  token: string
  passphrase: string
  revision: number
  lastSyncAt: number | null
  tombstones: SyncTombstone[]
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncApi {
  enabled: boolean
  status: SyncStatus
  error: string | null
  lastSyncAt: number | null
  revision: number
  /** Hay cambios locales esperando a subir. */
  pending: boolean
  /** Vincula este dispositivo con la frase. Devuelve false si no se pudo. */
  enable: (passphrase: string) => Promise<boolean>
  /** Olvida la frase en este dispositivo (los datos se quedan). */
  disable: () => void
  /** Fuerza una bajada y, si hay cambios pendientes, una subida. */
  syncNow: () => Promise<void>
}

export const EMPTY_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  token: '',
  passphrase: '',
  revision: 0,
  lastSyncAt: null,
  tombstones: [],
}

export const SyncContext = createContext<SyncApi | null>(null)

export function useSync(): SyncApi {
  const context = useContext(SyncContext)
  if (!context) throw new Error('useSync debe usarse dentro de SyncProvider')
  return context
}
