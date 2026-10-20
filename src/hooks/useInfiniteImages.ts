import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
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

const INITIAL: State = {
  items: [],
  page: 0,
  hasMore: true,
  loading: true,
  error: null,
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

  const [state, setState] = useState<State>(INITIAL)
  const stateRef = useRef(state)
  stateRef.current = state

  const abortRef = useRef<AbortController | null>(null)
  const loadingRef = useRef(false)
  const sequenceRef = useRef(0)

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

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      if (loadingRef.current) return
      loadingRef.current = true

      const sequence = ++sequenceRef.current
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState((previous) => ({ ...previous, loading: true, error: null }))

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

        setState((previous) => ({
          items: replace ? items : dedupe([...previous.items, ...items]),
          page,
          hasMore: response.hasMore,
          loading: false,
          error: null,
        }))
      } catch (error) {
        if (sequence !== sequenceRef.current) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }))
      } finally {
        if (sequence === sequenceRef.current) loadingRef.current = false
      }
    },
    [provider, query, perPage, quality, nsfw.enabled, blacklist, apiKey, userId, proxyUrl],
  )

  useEffect(() => {
    sequenceRef.current += 1
    abortRef.current?.abort()
    loadingRef.current = false
    setState({ ...INITIAL, items: [] })
    void fetchPage(1, true)

    return () => {
      abortRef.current?.abort()
    }
  }, [queryKey, fetchPage])

  const loadMore = useCallback(() => {
    if (loadingRef.current || !stateRef.current.hasMore) return
    void fetchPage(stateRef.current.page + 1, false)
  }, [fetchPage])

  const retry = useCallback(() => {
    if (loadingRef.current) return
    const { items, page, error } = stateRef.current
    if (!error) return
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
    loadMore,
    retry,
  }
}
