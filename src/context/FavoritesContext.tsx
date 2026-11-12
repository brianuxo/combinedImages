import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  FAVORITES_STORAGE_KEY,
  FavoritesContext,
  parseFavorites,
  removeFavorite,
  toggleFavorite,
  type FavoriteItem,
  type FavoritesApi,
} from './favorites'
import type { ImageItem } from '../types'

function loadFavorites(): FavoriteItem[] {
  try {
    return parseFavorites(localStorage.getItem(FAVORITES_STORAGE_KEY))
  } catch {
    // El almacenamiento puede estar bloqueado (modo privado estricto).
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FavoriteItem[]>(loadFavorites)

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Si no cabe, la app sigue funcionando: los favoritos viven en memoria.
    }
  }, [items])

  const toggle = useCallback((item: ImageItem) => {
    setItems((previous) => toggleFavorite(previous, item).list)
  }, [])

  const remove = useCallback((key: string) => {
    setItems((previous) => removeFavorite(previous, key))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const replace = useCallback((next: FavoriteItem[]) => setItems(next), [])

  const value = useMemo<FavoritesApi>(() => {
    const keys = new Set(items.map((item) => item.key))
    return {
      items,
      count: items.length,
      has: (key: string) => keys.has(key),
      toggle,
      remove,
      clear,
      replace,
    }
  }, [items, toggle, remove, clear, replace])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}
