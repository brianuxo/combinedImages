/*
 * Datos que viajan entre dispositivos.
 *
 * La instancia guarda un único paquete cifrado; el navegador lo baja, lo
 * descifra, lo combina con lo que tiene y lo vuelve a subir. Por eso toda la
 * lógica de mezcla vive aquí y es pura: se puede probar sin red ni React.
 *
 * Dos reglas que conviene tener presentes:
 *
 * - La calidad NO se sincroniza: depende del hardware de cada dispositivo.
 *   Los ajustes compartidos son `Settings` sin `quality`.
 * - Los favoritos se unen por `key` y las bajas viajan como lápidas
 *   (`deletedAt`). Sin ellas, borrar en el móvil no borraría en el PC: el
 *   otro dispositivo volvería a subir la imagen en la siguiente mezcla.
 */
import { FAVORITES_LIMIT, type FavoriteItem } from '../context/favorites'
import type { Settings } from '../types'

export const SYNC_VERSION = 1

/** Días que se conservan las lápidas antes de olvidarlas. */
export const TOMBSTONE_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Ajustes que se comparten; la calidad queda fuera a propósito. */
export type SharedSettings = Omit<Settings, 'quality'>

export interface SyncTombstone {
  key: string
  deletedAt: number
}

export interface SyncState {
  version: number
  settings: SharedSettings
  favorites: FavoriteItem[]
  tombstones: SyncTombstone[]
  updatedAt: number
}

/** Quita la calidad para que no viaje entre dispositivos. */
export function toSharedSettings(settings: Settings): SharedSettings {
  const { quality: _quality, ...shared } = settings
  return shared
}

/** Aplica lo que llega del servidor conservando la calidad de este equipo. */
export function withLocalQuality(local: Settings, shared: SharedSettings): Settings {
  return { ...local, ...shared, quality: local.quality }
}

function mergeTombstones(
  local: SyncTombstone[],
  remote: SyncTombstone[],
  now: number,
): SyncTombstone[] {
  const byKey = new Map<string, number>()

  for (const entry of [...local, ...remote]) {
    if (!entry || typeof entry.key !== 'string') continue
    if (typeof entry.deletedAt !== 'number') continue
    const previous = byKey.get(entry.key) ?? 0
    if (entry.deletedAt > previous) byKey.set(entry.key, entry.deletedAt)
  }

  const cutoff = now - TOMBSTONE_DAYS * DAY_MS

  return [...byKey.entries()]
    .filter(([, deletedAt]) => deletedAt >= cutoff)
    .map(([key, deletedAt]) => ({ key, deletedAt }))
    .sort((a, b) => b.deletedAt - a.deletedAt)
}

/**
 * Une dos listas de favoritos y sus lápidas.
 *
 * Gana la entrada con `savedAt` más reciente, así que volver a guardar una
 * imagen después de borrarla en otro dispositivo la resucita.
 */
export function mergeFavorites(
  local: FavoriteItem[],
  remote: FavoriteItem[],
  localTombstones: SyncTombstone[] = [],
  remoteTombstones: SyncTombstone[] = [],
  now = Date.now(),
): { favorites: FavoriteItem[]; tombstones: SyncTombstone[] } {
  const byKey = new Map<string, FavoriteItem>()

  for (const item of [...local, ...remote]) {
    if (!item || typeof item.key !== 'string') continue
    const previous = byKey.get(item.key)
    if (!previous || item.savedAt > previous.savedAt) byKey.set(item.key, item)
  }

  const tombstones = mergeTombstones(localTombstones, remoteTombstones, now)
  const deletedAt = new Map(tombstones.map((entry) => [entry.key, entry.deletedAt]))

  const favorites = [...byKey.values()]
    .filter((item) => {
      const removed = deletedAt.get(item.key)
      return removed === undefined || item.savedAt > removed
    })
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, FAVORITES_LIMIT)

  return { favorites, tombstones }
}

/**
 * Convierte las bajas de favoritos en lápidas.
 *
 * Se comparan la lista anterior y la nueva: lo que desaparece se marca con
 * la fecha actual. Las que ya tenían lápida se quedan como estaban.
 */
export function tombstonesForRemovals(
  previous: FavoriteItem[],
  next: FavoriteItem[],
  existing: SyncTombstone[] = [],
  now = Date.now(),
): SyncTombstone[] {
  const alive = new Set(next.map((item) => item.key))
  const removed = previous
    .filter((item) => !alive.has(item.key))
    .map((item) => ({ key: item.key, deletedAt: now }))

  return removed.length === 0 ? mergeTombstones(existing, [], now) : mergeTombstones(existing, removed, now)
}

export function createSyncState(
  settings: Settings,
  favorites: FavoriteItem[],
  tombstones: SyncTombstone[] = [],
  updatedAt = Date.now(),
): SyncState {
  return {
    version: SYNC_VERSION,
    settings: toSharedSettings(settings),
    favorites,
    tombstones,
    updatedAt,
  }
}

/**
 * Mezcla el estado local con el del servidor.
 *
 * `prefer` decide qué ajustes ganan cuando los dos lados cambiaron: al bajar
 * manda el servidor, pero al reenviar tras un 409 manda lo que acaba de
 * tocar el usuario. Los favoritos siempre se unen.
 */
export function mergeSyncState(
  local: SyncState,
  remote: SyncState | null,
  prefer: 'local' | 'remote' = 'remote',
  now = Date.now(),
): SyncState {
  if (!remote) return local

  const { favorites, tombstones } = mergeFavorites(
    local.favorites,
    remote.favorites,
    local.tombstones,
    remote.tombstones,
    now,
  )

  return {
    version: SYNC_VERSION,
    settings: prefer === 'remote' ? remote.settings : local.settings,
    favorites,
    tombstones,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

/** Comprueba que lo descifrado tiene la forma esperada antes de aplicarlo. */
export function isSyncState(value: unknown): value is SyncState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<SyncState>
  return (
    state.version === SYNC_VERSION &&
    typeof state.settings === 'object' &&
    state.settings !== null &&
    Array.isArray(state.favorites) &&
    Array.isArray(state.tombstones)
  )
}

/**
 * JSON con las claves ordenadas: dos estados con el mismo contenido dan la
 * misma cadena aunque React haya reconstruido los objetos en otro orden.
 * Se usa para no subir nada cuando lo único que cambió fue ese orden.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>
      return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]))
    }
    return entry
  })
}
