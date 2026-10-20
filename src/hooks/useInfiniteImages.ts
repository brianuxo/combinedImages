import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useSettings } from '../context/settings'
import { isBlacklisted } from '../lib/blacklist'
import { QUALITY_PAGE_SIZE } from '../lib/format'
import { searchProvider } from '../lib/providers'
import type { ImageItem, ProviderId } from '../types'

interface State {
  items: ImageItem[]
  page: number
  hasMore: boolean
  loading: boolean
  error: Error | null
}

type Action =
  | { type: 'reset' }
  | { type: 'loading' }
  | { type: 'success'; items: ImageItem[]; replace: boolean; page: number; hasMore: boolean }
  | { type: 'error'; error: Error }

const INITIAL: State = {
  items: [],
  page: 0,
  hasMore: true,
  loading: true,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL }
    case 'loading':
      return { ...state, loading: true, error: null }
    case 'success':
      return {
        items: action.replace
          ? action.items
          : dedupe([...state.items, ...action.items]),
        page: action.page,
        hasMore: action.hasMore,
        loading: false,
        error: null,
      }
    case 'error':
      return { ...state, loading: false, error: action.error }
  }
}

function dedupe(items: ImageItem[]): ImageItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.key)) return false
    seen.add(item.key)
    return true
  })
}

export function useInfiniteImages(provider: ProviderId, query: string) {
  const { settings } = useSettings()
  const { blacklist, proxyUrl, nsfw, quality } = settings
  const perPage = QUALITY_PAGE_SIZE[quality]
  const apiKey = settings.providers[provider]?.apiKey
  const userId = settings.providers[provider]?.userId

  // Cualquier cambio aquí reinicia la galería desde la primera página.
  const queryKey = JSON.stringify([
    provider,
    query,
    quality,
    nsfw.enabled,
    apiKey ?? '',
    userId ?? '',
    proxyUrl,
    blacklist.tags,
    blacklist.keywords,
    perPage,
  ])

  const [state, dispatch] = useReducer(reducer, INITIAL)
  const [stateKey, setStateKey] = useState(queryKey)

  const abortRef = useRef<AbortController | null>(null)
  const loadingRef = useRef(false)
  const sequenceRef = useRef(0)

  // Al cambiar la búsqueda ajustamos el estado durante el render: así la
  // lista anterior se limpia sin un efecto que dispare un render en cascada.
  if (stateKey !== queryKey) {
    setStateKey(queryKey)
    dispatch({ type: 'reset' })
  }

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      if (loadingRef.current) return
      loadingRef.current = true

      const sequence = ++sequenceRef.current
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await searchProvider(provider, {
          query,
          page,
          perPage,
          quality,
          nsfw: nsfw.enabled,
          blacklist,
          apiKey,
          userId,
          proxyUrl,
          signal: controller.signal,
        })

        if (sequence !== sequenceRef.current) return

        const items = response.items.filter((item) => !isBlacklisted(item, blacklist))

        dispatch({
          type: 'success',
          items,
          replace,
          page,
          hasMore: response.hasMore,
        })
      } catch (error) {
        if (sequence !== sequenceRef.current) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        dispatch({
          type: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        })
      } finally {
        if (sequence === sequenceRef.current) loadingRef.current = false
      }
    },
    [
      provider,
      query,
      perPage,
      quality,
      nsfw.enabled,
      blacklist,
      apiKey,
      userId,
      proxyUrl,
    ],
  )

  useEffect(() => {
    sequenceRef.current += 1
    abortRef.current?.abort()
    loadingRef.current = false
    void fetchPage(1, true)

    return () => {
      abortRef.current?.abort()
    }
  }, [queryKey, fetchPage])

  const loadMore = useCallback(() => {
    if (loadingRef.current || !state.hasMore) return
    dispatch({ type: 'loading' })
    void fetchPage(state.page + 1, false)
  }, [fetchPage, state])

  const retry = useCallback(() => {
    if (loadingRef.current) return
    if (!state.error) return
    dispatch({ type: 'loading' })
    if (state.items.length === 0) {
      void fetchPage(1, true)
    } else {
      void fetchPage(state.page + 1, false)
    }
  }, [fetchPage, state])

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    loadMore,
    retry,
  }
}
