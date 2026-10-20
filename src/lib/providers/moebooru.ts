import type { ImageItem, Rating, SearchArgs, SearchResponse } from '../../types'
import { toBooruExclusions } from '../blacklist'
import { fetchJson } from '../http'

interface MoebooruPost {
  id: number
  tags: string
  rating: string
  author?: string
  source?: string
  file_url?: string
  sample_url?: string
  preview_url?: string
  jpeg_url?: string
  width: number
  height: number
  file_ext?: string
}

const RATING: Record<string, Rating> = {
  s: 'safe',
  q: 'questionable',
  e: 'explicit',
}

const LABEL = { konachan: 'Konachan', yandere: 'Yande.re' } as const

function normalize(
  post: MoebooruPost,
  provider: 'konachan' | 'yandere',
  args: SearchArgs,
): ImageItem {
  const full = post.file_url || post.jpeg_url || post.sample_url || post.preview_url || ''
  const sample = post.sample_url || post.jpeg_url || post.file_url || post.preview_url || ''
  const thumb = post.preview_url || sample

  const preview =
    args.quality === 'max'
      ? post.file_url || sample
      : args.quality === 'general'
        ? sample
        : thumb

  const base = provider === 'konachan' ? 'https://konachan.com' : 'https://yande.re'

  return {
    key: `${provider}:${post.id}`,
    id: String(post.id),
    provider,
    providerLabel: LABEL[provider],
    thumb,
    preview,
    full,
    width: post.width,
    height: post.height,
    tags: post.tags ? post.tags.split(' ').filter(Boolean) : [],
    author: post.author || undefined,
    pageUrl: `${base}/post/show/${post.id}`,
    sourceUrl: post.source?.startsWith('http') ? post.source : undefined,
    rating: RATING[post.rating] ?? 'safe',
    ext: post.file_ext,
  }
}

export async function searchMoebooru(
  provider: 'konachan' | 'yandere',
  args: SearchArgs,
): Promise<SearchResponse> {
  const tags = [args.query.trim(), ...toBooruExclusions(args.blacklist.tags)]
  if (!args.nsfw) tags.push('rating:safe')

  const base = provider === 'konachan' ? 'https://konachan.com' : 'https://yande.re'
  const params = new URLSearchParams({
    tags: tags.filter(Boolean).join(' '),
    limit: String(args.perPage),
    page: String(args.page),
  })

  const data = await fetchJson<MoebooruPost[]>(`${base}/post.json?${params.toString()}`, {
    provider,
    signal: args.signal,
    proxyUrl: args.proxyUrl,
    needsProxy: true,
  })

  const items = data
    .filter((post) => post.file_url || post.sample_url || post.preview_url)
    .map((post) => normalize(post, provider, args))

  return { items, hasMore: data.length >= args.perPage }
}
