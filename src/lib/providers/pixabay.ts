import type { ImageItem, SearchArgs, SearchResponse } from '../../types'
import { AuthRequiredError, fetchJson } from '../http'

interface PixabayHit {
  id: number
  pageURL: string
  tags: string
  previewURL: string
  webformatURL: string
  largeImageURL: string
  fullHDURL?: string
  imageURL?: string
  imageWidth: number
  imageHeight: number
  user: string
}

interface PixabayResponse {
  total: number
  totalHits: number
  hits: PixabayHit[]
}

function extensionOf(url: string): string | undefined {
  const match = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)
  return match?.[1]?.toLowerCase()
}

function normalize(hit: PixabayHit, args: SearchArgs): ImageItem {
  const full = hit.fullHDURL || hit.imageURL || hit.largeImageURL || hit.webformatURL
  const preview =
    args.quality === 'max'
      ? full
      : args.quality === 'general'
        ? hit.largeImageURL || hit.webformatURL
        : hit.webformatURL

  return {
    key: `pixabay:${hit.id}`,
    id: String(hit.id),
    provider: 'pixabay',
    providerLabel: 'Pixabay',
    thumb: hit.previewURL || hit.webformatURL,
    preview,
    full,
    width: hit.imageWidth,
    height: hit.imageHeight,
    tags: hit.tags ? hit.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
    author: hit.user || undefined,
    license: 'Pixabay Content License',
    pageUrl: hit.pageURL,
    rating: 'safe',
    ext: extensionOf(full),
  }
}

export async function searchPixabay(args: SearchArgs): Promise<SearchResponse> {
  const apiKey = args.apiKey?.trim()
  if (!apiKey) {
    throw new AuthRequiredError('pixabay', 'Pixabay necesita una API key gratuita')
  }

  const params = new URLSearchParams({
    key: apiKey,
    image_type: 'all',
    orientation: 'all',
    safesearch: 'true',
    order: 'popular',
    page: String(args.page),
    per_page: String(args.perPage),
  })

  if (args.query.trim()) params.set('q', args.query.trim())

  const data = await fetchJson<PixabayResponse>(`https://pixabay.com/api/?${params.toString()}`, {
    provider: 'pixabay',
    signal: args.signal,
    proxyUrl: args.proxyUrl,
  })

  const hits = data.hits ?? []
  const items = hits.filter((hit) => hit.webformatURL).map((hit) => normalize(hit, args))

  return {
    items,
    hasMore:
      typeof data.totalHits === 'number'
        ? args.page * args.perPage < Math.min(data.totalHits, 500)
        : hits.length >= args.perPage,
  }
}
