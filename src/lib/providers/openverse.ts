import type { ImageItem, SearchArgs, SearchResponse } from '../../types'
import { fetchJson } from '../http'

interface OpenverseResult {
  id: string
  title?: string
  url: string
  thumbnail?: string
  width?: number
  height?: number
  creator?: string
  license?: string
  license_version?: string
  foreign_landing_url?: string
  detail_url?: string
  source?: string
  mature?: boolean
  tags?: { name: string }[]
}

interface OpenverseResponse {
  result_count: number
  page_count: number
  page: number
  results: OpenverseResult[]
}

export async function searchOpenverse(args: SearchArgs): Promise<SearchResponse> {
  const hasKey = Boolean(args.apiKey?.trim())
  // Openverse limita a 20 resultados por página en peticiones anónimas.
  const pageSize = hasKey ? args.perPage : Math.min(args.perPage, 20)

  const params = new URLSearchParams({
    q: args.query.trim() || 'wallpaper',
    page: String(args.page),
    page_size: String(pageSize),
  })

  const headers: Record<string, string> = {}
  if (hasKey) headers.Authorization = `Bearer ${args.apiKey!.trim()}`

  const data = await fetchJson<OpenverseResponse>(
    `https://api.openverse.org/v1/images/?${params.toString()}`,
    {
      provider: 'openverse',
      signal: args.signal,
      proxyUrl: args.proxyUrl,
      headers,
    },
  )

  const items = data.results
    .filter((result) => result.url && (!result.mature || args.nsfw))
    .map<ImageItem>((result) => {
      const thumb = result.thumbnail || result.url
      return {
        key: `openverse:${result.id}`,
        id: result.id,
        provider: 'openverse',
        providerLabel: 'Openverse',
        thumb,
        preview: args.quality === 'optimo' ? thumb : result.url,
        full: result.url,
        width: result.width ?? 0,
        height: result.height ?? 0,
        tags: result.tags?.map((tag) => tag.name) ?? [],
        title: result.title,
        author: result.creator,
        license: result.license
          ? `${result.license.toUpperCase()}${result.license_version ? ` ${result.license_version}` : ''}`
          : undefined,
        pageUrl: result.foreign_landing_url || result.detail_url || result.url,
        sourceUrl: result.source,
        rating: result.mature ? 'questionable' : 'safe',
      }
    })

  return {
    items,
    hasMore: data.page < data.page_count,
  }
}
