import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useSettings } from '../context/settings'
import { isBlacklisted } from '../lib/blacklist'
import { QUALITY_LIMITS } from '../lib/format'
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
  const limits = QUALITY_LIMITS[quality]
  const perPage = limits.perPage
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
  // Tope de tarjetas que se cargan solas. En Óptimo arranca en 12; el botón
  // «Ver más» lo sube de 12 en 12. En el resto de calidades es infinito.
  const [cap, setCap] = useState<number>(limits.autoCap)

  const abortRef = useRef<AbortController | null>(null)
  const loadingRef = useRef(false)
  const sequenceRef = useRef(0)

  // Espejo del estado para que `loadMore` y `retry` conserven la misma
  // identidad entre renders. Si cambian, quien los escucha (la galería)
  // vuelve a montar su comprobación de scroll y se encadena una carga
  // extra por cada página.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  // Al cambiar la búsqueda ajustamos el estado durante el render: así la
  // lista anterior se limpia sin un efecto que dispare un render en cascada.
  if (stateKey !== queryKey) {
    setStateKey(queryKey)
    setCap(limits.autoCap)
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
    const { page, hasMore } = stateRef.current
    if (loadingRef.current || !hasMore) return
    dispatch({ type: 'loading' })
    void fetchPage(page + 1, false)
  }, [fetchPage])

  /** El botón «Ver más»: sube el tope y pide la siguiente página. */
  const showMore = useCallback(() => {
    if (loadingRef.current) return
    setCap((current) => Math.max(current, stateRef.current.items.length + limits.step))
    loadMore()
  }, [limits.step, loadMore])

  const retry = useCallback(() => {
    const { error, items, page } = stateRef.current
    if (loadingRef.current) return
    if (!error) return
    dispatch({ type: 'loading' })
    if (items.length === 0) {
      void fetchPage(1, true)
    } else {
      void fetchPage(page + 1, false)
    }
  }, [fetchPage])

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    /** Ya se cargaron las tarjetas automáticas: toca pedir las siguientes. */
    atCap: state.hasMore && state.items.length >= cap,
    loadMore,
    showMore,
    retry,
  }
}
