import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFavorites } from './favorites'
import { useSettings } from './settings'
import { EMPTY_SYNC_CONFIG, SyncContext, type SyncApi, type SyncConfig, type SyncStatus } from './sync'
import { useToast } from './toast'
import type { FavoriteItem } from './favorites'
import {
  createSyncState,
  isSyncState,
  mergeSyncState,
  stableStringify,
  tombstonesForRemovals,
  withLocalQuality,
  type SyncState,
  type SyncTombstone,
} from '../lib/sync'
import { checkSync, pullSync, pushSync, SyncApiError } from '../lib/syncApi'
import { deriveAuthToken, openPayload, sealPayload, SyncCryptoError } from '../lib/syncCrypto'

const STORAGE_KEY = 'combined.sync.v1'
const PUSH_DELAY = 1200
const PULL_THROTTLE = 15_000

function loadConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_SYNC_CONFIG }

    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    if (typeof parsed.token !== 'string' || typeof parsed.passphrase !== 'string') {
      return { ...EMPTY_SYNC_CONFIG }
    }

    const tombstones: SyncTombstone[] = Array.isArray(parsed.tombstones)
      ? parsed.tombstones.filter(
          (entry): entry is SyncTombstone =>
            Boolean(entry) &&
            typeof entry === 'object' &&
            typeof (entry as SyncTombstone).key === 'string' &&
            typeof (entry as SyncTombstone).deletedAt === 'number',
        )
      : []

    return {
      enabled:
        parsed.enabled === true && parsed.token.length > 0 && parsed.passphrase.length > 0,
      token: parsed.token,
      passphrase: parsed.passphrase,
      revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
      lastSyncAt: typeof parsed.lastSyncAt === 'number' ? parsed.lastSyncAt : null,
      tombstones,
    }
  } catch {
    return { ...EMPTY_SYNC_CONFIG }
  }
}

/** Huella del contenido: sirve para no subir lo que no ha cambiado. */
function hashState(state: SyncState): string {
  return stableStringify({
    settings: state.settings,
    favorites: state.favorites,
    tombstones: state.tombstones,
  })
}

async function decryptState(blob: string, passphrase: string): Promise<SyncState> {
  const value = await openPayload(passphrase, blob)
  if (!isSyncState(value)) {
    throw new SyncCryptoError('El paquete guardado no tiene el formato esperado.')
  }
  return value
}

function describeError(error: unknown): string {
  if (error instanceof SyncCryptoError) return error.message
  if (error instanceof SyncApiError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return 'Sincronización cancelada.'
  return 'No se pudo sincronizar. Se reintentará al recuperar la conexión.'
}

function isOffline(error: unknown): boolean {
  return error instanceof SyncApiError && error.status === 0
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings()
  const { items: favoriteItems, replace: replaceFavorites } = useFavorites()
  const { push: toast } = useToast()

  const [config, setConfig] = useState<SyncConfig>(loadConfig)
  const [status, setStatus] = useState<SyncStatus>(config.enabled ? 'idle' : 'off')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const configRef = useRef(config)
  const settingsRef = useRef(settings)
  const favoritesRef = useRef(favoriteItems)
  const previousFavoritesRef = useRef<FavoriteItem[]>(favoriteItems)

  // Espejos para los callbacks asíncronos: un efecto (y no el render) evita
  // leer refs durante el render y llega antes que cualquier evento o efecto
  // que dispare una sincronización.
  useEffect(() => {
    configRef.current = config
    settingsRef.current = settings
    favoritesRef.current = favoriteItems
  })

  const lastHashRef = useRef<string | null>(null)
  const skipDiffRef = useRef(false)
  const pushingRef = useRef(false)
  const pullingRef = useRef(false)
  const pendingRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const lastPullRef = useRef(0)

  const commit = useCallback((next: SyncConfig) => {
    configRef.current = next
    setConfig(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // El almacenamiento puede estar lleno o bloqueado; la app sigue.
    }
  }, [])

  /** Aplica un estado ya mezclado sin que el efecto lo confunda con una edición. */
  const applyRemote = useCallback(
    (merged: SyncState) => {
      skipDiffRef.current = true
      previousFavoritesRef.current = merged.favorites
      lastHashRef.current = hashState(merged)
      update(withLocalQuality(settingsRef.current, merged.settings))
      replaceFavorites(merged.favorites)
    },
    [replaceFavorites, update],
  )

  const pushState = useCallback(
    async (state: SyncState, base: SyncConfig): Promise<boolean> => {
      if (pushingRef.current) return false
      pushingRef.current = true
      setStatus('syncing')

      try {
        const blob = await sealPayload(base.passphrase, state)
        const result = await pushSync(base.token, { baseRevision: base.revision, blob })

        if (result.ok) {
          commit({ ...base, revision: result.revision, lastSyncAt: Date.now() })
          lastHashRef.current = hashState(state)
          pendingRef.current = false
          setPending(false)
          setError(null)
          setStatus('idle')
          return true
        }

        // Otro dispositivo escribió antes: se mezcla y se reenvía una vez.
        const remote = result.remote.blob
          ? await decryptState(result.remote.blob, base.passphrase)
          : null
        const merged = mergeSyncState(state, remote, 'local')
        applyRemote(merged)

        const retry = await pushSync(base.token, {
          baseRevision: result.remote.revision,
          blob: await sealPayload(base.passphrase, merged),
        })

        if (!retry.ok) {
          pendingRef.current = true
          setPending(true)
          setError('Otro dispositivo está escribiendo a la vez. Se reintentará.')
          setStatus('error')
          return false
        }

        skipDiffRef.current = true
        previousFavoritesRef.current = merged.favorites
        commit({ ...base, revision: retry.revision, lastSyncAt: Date.now() })
        lastHashRef.current = hashState(merged)
        pendingRef.current = false
        setPending(false)
        setError(null)
        setStatus('idle')
        toast('Se combinaron los cambios de otro dispositivo', 'default')
        return true
      } catch (caught) {
        pendingRef.current = true
        setPending(true)
        setError(describeError(caught))
        setStatus(isOffline(caught) ? 'offline' : 'error')
        return false
      } finally {
        pushingRef.current = false
      }
    },
    [applyRemote, commit, toast],
  )

  const flushPending = useCallback(async (): Promise<void> => {
    const current = configRef.current
    if (!current.enabled || pushingRef.current) return

    const state = createSyncState(
      settingsRef.current,
      favoritesRef.current,
      current.tombstones,
    )

    if (hashState(state) === lastHashRef.current) {
      pendingRef.current = false
      setPending(false)
      return
    }

    await pushState(state, current)
  }, [pushState])

  const schedulePush = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      if (configRef.current.enabled) void flushPending()
    }, PUSH_DELAY)
  }, [flushPending])

  const pullNow = useCallback(
    async (force = false): Promise<void> => {
      const current = configRef.current
      if (!current.enabled || pullingRef.current || pushingRef.current) return
      if (!force && (pendingRef.current || debounceRef.current !== null)) return
      if (!force && Date.now() - lastPullRef.current < PULL_THROTTLE) return

      pullingRef.current = true
      lastPullRef.current = Date.now()
      setStatus('syncing')

      try {
        const remote = await pullSync(current.token)

        if (!remote.blob || remote.revision === 0) {
          commit({ ...current, revision: remote.revision, lastSyncAt: Date.now() })
          setError(null)
          setStatus('idle')
          return
        }

        if (remote.revision === current.revision) {
          commit({ ...current, revision: remote.revision, lastSyncAt: Date.now() })
          setError(null)
          setStatus('idle')
          return
        }

        const parsed = await decryptState(remote.blob, current.passphrase)
        const local = createSyncState(
          settingsRef.current,
          favoritesRef.current,
          current.tombstones,
        )
        const before = hashState(local)
        const merged = mergeSyncState(local, parsed, 'remote')

        commit({ ...current, revision: remote.revision, lastSyncAt: Date.now() })

        if (hashState(merged) !== before) applyRemote(merged)

        // El servidor puede no tener algo que sí tenemos en este dispositivo.
        if (hashState(merged) !== hashState(parsed)) {
          const pushed = await pushState(merged, { ...current, revision: remote.revision })
          if (!pushed) return
        }

        setError(null)
        setStatus('idle')
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(describeError(caught))
        setStatus(isOffline(caught) ? 'offline' : 'error')
      } finally {
        pullingRef.current = false
      }
    },
    [applyRemote, commit, pushState],
  )

  const enable = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (!passphrase) {
        setError('Escribe la frase de sincronización.')
        return false
      }

      setStatus('syncing')
      setError(null)

      try {
        // De la frase se deriva la credencial que autoriza la conexión: el
        // servidor guarda solo su hash y la frase nunca viaja.
        const authToken = await deriveAuthToken(passphrase)

        await checkSync(authToken)
        const remote = await pullSync(authToken)

        const local = createSyncState(
          settingsRef.current,
          favoritesRef.current,
          configRef.current.tombstones,
        )
        const remoteState =
          remote.blob && remote.revision > 0
            ? await decryptState(remote.blob, passphrase)
            : null

        const merged = mergeSyncState(local, remoteState, 'remote')
        const needsPush = !remoteState || hashState(merged) !== hashState(remoteState)
        let revision = remoteState ? remote.revision : 0

        if (needsPush) {
          const result = await pushSync(authToken, {
            baseRevision: revision,
            blob: await sealPayload(passphrase, merged),
          })
          if (!result.ok) {
            throw new SyncApiError('Otro dispositivo escribió a la vez. Prueba de nuevo.', 409)
          }
          revision = result.revision
        }

        const next: SyncConfig = {
          enabled: true,
          token: authToken,
          passphrase,
          revision,
          lastSyncAt: Date.now(),
          tombstones: merged.tombstones,
        }
        commit(next)
        lastPullRef.current = Date.now()

        if (remoteState) {
          applyRemote(merged)
        } else {
          skipDiffRef.current = true
          previousFavoritesRef.current = favoritesRef.current
          lastHashRef.current = hashState(merged)
        }

        pendingRef.current = false
        setPending(false)
        setError(null)
        setStatus('idle')
        toast(
          remoteState
            ? 'Sincronización activada: se combinaron los datos de la instancia.'
            : 'Sincronización activada: copia subida a la instancia.',
          'success',
        )
        return true
      } catch (caught) {
        setError(describeError(caught))
        setStatus(isOffline(caught) ? 'offline' : 'error')
        return false
      }
    },
    [applyRemote, commit, toast],
  )

  const disable = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    commit({ ...configRef.current, enabled: false, token: '', passphrase: '', revision: 0, lastSyncAt: null })
    lastHashRef.current = null
    pendingRef.current = false
    setPending(false)
    setError(null)
    setStatus('off')
  }, [commit])

  const syncNow = useCallback(async () => {
    await flushPending()
    lastPullRef.current = 0
    await pullNow(true)
  }, [flushPending, pullNow])

  // Al abrir, al volver a la pestaña y al recuperar la red: ponerse al día.
  useEffect(() => {
    const refresh = () => {
      if (!configRef.current.enabled) return
      if (pendingRef.current) void flushPending()
      else void pullNow()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flushPending, pullNow])

  useEffect(() => {
    if (config.enabled) void pullNow()
  }, [config.enabled, pullNow])

  // Cada cambio local: lápidas para lo que se borró y subida con retardo.
  useEffect(() => {
    if (!config.enabled) return

    if (skipDiffRef.current) {
      skipDiffRef.current = false
      previousFavoritesRef.current = favoriteItems
      return
    }

    const tombstones = tombstonesForRemovals(
      previousFavoritesRef.current,
      favoriteItems,
      configRef.current.tombstones,
    )
    previousFavoritesRef.current = favoriteItems

    if (tombstones.length !== configRef.current.tombstones.length) {
      commit({ ...configRef.current, tombstones })
    }

    const state = createSyncState(settings, favoriteItems, configRef.current.tombstones)
    if (hashState(state) === lastHashRef.current) return

    pendingRef.current = true
    setPending(true)
    schedulePush()
  }, [commit, config.enabled, favoriteItems, schedulePush, settings])

  const value = useMemo<SyncApi>(
    () => ({
      enabled: config.enabled,
      status,
      error,
      lastSyncAt: config.lastSyncAt,
      revision: config.revision,
      pending,
      enable,
      disable,
      syncNow,
    }),
    [config.enabled, config.lastSyncAt, config.revision, disable, enable, error, pending, status, syncNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
