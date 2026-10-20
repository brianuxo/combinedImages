import type { ImageItem, Rating, SearchArgs, SearchResponse } from '../../types'
import { toBooruExclusions } from '../blacklist'
import { fetchJson } from '../http'

interface DanbooruPost {
  id: number
  rating: string
  image_width: number
  image_height: number
  tag_string: string
  tag_string_artist?: string
  file_url?: string | null
  large_file_url?: string | null
  preview_file_url?: string | null
  source?: string
  file_ext?: string
}

const RATING: Record<string, Rating> = {
  g: 'safe',
  s: 'safe',
  q: 'questionable',
  e: 'explicit',
}

function normalize(post: DanbooruPost, provider: 'danbooru' | 'safebooru', args: SearchArgs): ImageItem {
  const full = post.file_url || post.large_file_url || post.preview_file_url || ''
  const sample = post.large_file_url || post.file_url || post.preview_file_url || ''
  const thumb = post.preview_file_url || sample

  const preview =
    args.quality === 'max'
      ? post.file_url || sample
      : args.quality === 'general'
        ? sample
        : thumb

  return {
    key: `${provider}:${post.id}`,
    id: String(post.id),
    provider,
    providerLabel: provider === 'danbooru' ? 'Danbooru' : 'Safebooru',
    thumb,
    preview,
    full,
    width: post.image_width,
    height: post.image_height,
    tags: post.tag_string ? post.tag_string.split(' ').filter(Boolean) : [],
    author: post.tag_string_artist?.replace(/_/g, ' ') || undefined,
    pageUrl: `https://${provider}.donmai.us/posts/${post.id}`,
    sourceUrl: post.source?.startsWith('http') ? post.source : undefined,
    rating: RATING[post.rating] ?? 'safe',
    ext: post.file_ext,
  }
}

export async function searchDanbooru(
  provider: 'danbooru' | 'safebooru',
  args: SearchArgs,
): Promise<SearchResponse> {
  const tags = [args.query.trim(), ...toBooruExclusions(args.blacklist.tags)]

  if (provider === 'danbooru' && !args.nsfw) tags.push('rating:general')

  const params = new URLSearchParams({
    tags: tags.filter(Boolean).join(' '),
    limit: String(args.perPage),
    page: String(args.page),
  })

  const base = `https://${provider}.donmai.us`
  const data = await fetchJson<DanbooruPost[]>(`${base}/posts.json?${params.toString()}`, {
    provider,
    signal: args.signal,
    proxyUrl: args.proxyUrl,
  })

  const items = data
    .filter((post) => post.file_url || post.large_file_url || post.preview_file_url)
    .map((post) => normalize(post, provider, args))

  return { items, hasMore: data.length >= args.perPage }
}
