import type { ImageItem, Rating, SearchArgs, SearchResponse } from '../../types'
import { fetchJson } from '../http'

interface WallhavenItem {
  id: string
  url: string
  path: string
  source?: string
  purity: string
  dimension_x: number
  dimension_y: number
  file_type?: string
  thumbs: {
    large: string
    original: string
    small: string
  }
  uploader?: { username?: string }
  tags?: { name: string }[]
}

interface WallhavenResponse {
  data: WallhavenItem[]
  meta: {
    current_page: number | string
    last_page: number | string
  }
}

const RATING: Record<string, Rating> = {
  sfw: 'safe',
  sketchy: 'questionable',
  nsfw: 'explicit',
}

function extensionOf(item: WallhavenItem): string | undefined {
  if (item.file_type?.startsWith('image/')) return item.file_type.slice(6)
  const match = item.path.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)
  return match?.[1]?.toLowerCase()
}

function normalize(item: WallhavenItem, args: SearchArgs): ImageItem {
  const preview =
    args.quality === 'max'
      ? item.path
      : args.quality === 'general'
        ? item.thumbs.original
        : item.thumbs.large

  return {
    key: `wallhaven:${item.id}`,
    id: item.id,
    provider: 'wallhaven',
    providerLabel: 'Wallhaven',
    thumb: item.thumbs.large || item.thumbs.small,
    preview,
    full: item.path,
    width: item.dimension_x,
    height: item.dimension_y,
    tags: item.tags?.map((tag) => tag.name) ?? [],
    author: item.uploader?.username || undefined,
    pageUrl: item.url,
    sourceUrl: item.source?.startsWith('http') ? item.source : undefined,
    rating: RATING[item.purity] ?? 'safe',
    ext: extensionOf(item),
    noReferrer: true,
  }
}

export async function searchWallhaven(args: SearchArgs): Promise<SearchResponse> {
  // Wallhaven limita la búsqueda a 24 resultados por página.
  const limit = Math.min(args.perPage, 24)
  const apiKey = args.apiKey?.trim()

  const params = new URLSearchParams({
    page: String(args.page),
    categories: '111',
    purity: args.nsfw && apiKey ? '111' : '100',
    sorting: args.query.trim() ? 'relevance' : 'date_added',
    order: 'desc',
  })

  if (args.query.trim()) params.set('q', args.query.trim())
  if (apiKey) params.set('apikey', apiKey)

  const data = await fetchJson<WallhavenResponse>(
    `https://wallhaven.cc/api/v1/search?${params.toString()}`,
    {
      provider: 'wallhaven',
      signal: args.signal,
      proxyUrl: args.proxyUrl,
      needsProxy: true,
    },
  )

  const items = (data.data ?? [])
    .filter((item) => item.path)
    .map((item) => normalize(item, args))

  const current = Number(data.meta?.current_page ?? args.page)
  const last = Number(data.meta?.last_page ?? args.page)

  return {
    items,
    hasMore: Number.isFinite(last) ? current < last : items.length >= limit,
  }
}
