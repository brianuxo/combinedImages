import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  FAVORITES_STORAGE_KEY,
  FavoritesContext,
  parseFavoriteList,
  removeFavorite,
  toggleFavorite,
  type FavoriteItem,
  type FavoritesApi,
} from './favorites'
import type { ImageItem } from '../types'
import { pullFavorites, pushFavorites, checkServer } from '../lib/dataApi'

const PUSH_DELAY = 800

function loadFavoritesLocal(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    return parseFavoriteList(raw ? JSON.parse(raw) : [])
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FavoriteItem[]>(loadFavoritesLocal)
  const [serverAvailable, setServerAvailable] = useState(false)
  const checkedRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const pushingRef = useRef(false)

  // Verificar si el servidor está disponible al montar
  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    checkServer().then((available) => {
      setServerAvailable(available)
      if (available) {
        // Cargar favoritos desde el servidor
        pullFavorites()
          .then((data) => {
            const parsed = parseFavoriteList(data)
            if (parsed.length > 0) {
              setItems(parsed)
              // Guardar en localStorage como respaldo
              try {
                localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(parsed))
              } catch { /* ignorar */ }
            }
          })
          .catch(() => {
            // El servidor respondió pero los datos son inválidos; usar localStorage
            setServerAvailable(false)
          })
      }
    }).catch(() => {
      setServerAvailable(false)
    })
  }, [])

  // Guardar en localStorage como respaldo siempre
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Si no cabe, la app sigue funcionando.
    }
  }, [items])

  // Subir al servidor con debounce cuando hay cambios y el servidor está disponible
  useEffect(() => {
    if (!serverAvailable || pushingRef.current) return

    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      pushingRef.current = true
      pushFavorites(items)
        .then(() => {
          pushingRef.current = false
        })
        .catch(() => {
          pushingRef.current = false
          // Si el servidor deja de responder, seguir con localStorage
        })
    }, PUSH_DELAY)
  }, [items, serverAvailable])

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
