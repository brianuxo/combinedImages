import { createContext, useContext } from 'react'
import type { ImageItem } from '../types'

/** Una imagen guardada, con la fecha para ordenar de más reciente a más vieja. */
export interface FavoriteItem extends ImageItem {
  savedAt: number
}

export const FAVORITES_STORAGE_KEY = 'combined.favorites.v1'

/** Tope de favoritos guardados: evita llenar el almacenamiento del navegador. */
export const FAVORITES_LIMIT = 1000

export function toFavorite(item: ImageItem, savedAt = Date.now()): FavoriteItem {
  return { ...item, savedAt }
}

/** Añade al principio (lo último guardado se ve primero) y sin duplicados. */
export function addFavorite(
  list: FavoriteItem[],
  item: ImageItem,
  savedAt = Date.now(),
): FavoriteItem[] {
  const rest = list.filter((entry) => entry.key !== item.key)
  return [toFavorite(item, savedAt), ...rest].slice(0, FAVORITES_LIMIT)
}

export function removeFavorite(list: FavoriteItem[], key: string): FavoriteItem[] {
  return list.filter((entry) => entry.key !== key)
}

export function toggleFavorite(
  list: FavoriteItem[],
  item: ImageItem,
  savedAt = Date.now(),
): { list: FavoriteItem[]; saved: boolean } {
  const exists = list.some((entry) => entry.key === item.key)
  return exists
    ? { list: removeFavorite(list, item.key), saved: false }
    : { list: addFavorite(list, item, savedAt), saved: true }
}

/** Valida un listado ya deserializado (por ejemplo, al descifrar la copia). */
export function parseFavoriteList(parsed: unknown): FavoriteItem[] {
  if (!Array.isArray(parsed)) return []

  const seen = new Set<string>()
  const list: FavoriteItem[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Partial<FavoriteItem>
    if (typeof item.key !== 'string' || typeof item.provider !== 'string') continue
    if (typeof item.full !== 'string' || !item.full) continue
    if (seen.has(item.key)) continue

    seen.add(item.key)
    list.push({
      ...(item as FavoriteItem),
      tags: Array.isArray(item.tags) ? item.tags : [],
      savedAt: typeof item.savedAt === 'number' ? item.savedAt : 0,
    })
    if (list.length >= FAVORITES_LIMIT) break
  }

  return list.sort((a, b) => b.savedAt - a.savedAt)
}

/** Lee el listado guardado y descarta lo que no tenga forma de imagen. */
export function parseFavorites(raw: string | null): FavoriteItem[] {
  if (!raw) return []
  try {
    return parseFavoriteList(JSON.parse(raw))
  } catch {
    return []
  }
}

export interface FavoritesApi {
  /** Más recientes primero. */
  items: FavoriteItem[]
  count: number
  has: (key: string) => boolean
  toggle: (item: ImageItem) => void
  remove: (key: string) => void
  clear: () => void
  /** Sustituye la lista completa (la usa la sincronización). */
  replace: (items: FavoriteItem[]) => void
}

export const FavoritesContext = createContext<FavoritesApi | null>(null)

export function useFavorites(): FavoritesApi {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites debe usarse dentro de FavoritesProvider')
  return context
}
