import type { ImageItem, Rating, SearchArgs, SearchResponse } from '../../types'
import { toBooruExclusions } from '../blacklist'
import { AuthRequiredError, fetchJson } from '../http'
import { mediaUrl } from '../media'

interface GelbooruPost {
  id: number
  rating: string
  width: number
  height: number
  tags: string
  file_url?: string | null
  sample_url?: string | null
  preview_url?: string | null
  file_ext?: string
  source?: string
}

type GelbooruResponse =
  | { post?: GelbooruPost[] | GelbooruPost }
  | GelbooruPost[]

const RATING: Record<string, Rating> = {
  general: 'safe',
  safe: 'safe',
  sensitive: 'questionable',
  questionable: 'questionable',
  explicit: 'explicit',
}

function normalize(post: GelbooruPost, args: SearchArgs): ImageItem {
  const full = post.file_url || post.sample_url || post.preview_url || ''
  const sample = post.sample_url || post.file_url || post.preview_url || ''
  const thumb = post.preview_url || sample

  const preview =
    args.quality === 'max'
      ? post.file_url || sample
      : args.quality === 'general'
        ? post.sample_url || sample
        : thumb

  return {
    key: `gelbooru:${post.id}`,
    id: String(post.id),
    provider: 'gelbooru',
    providerLabel: 'Gelbooru',
    thumb: mediaUrl(thumb, args.proxyUrl),
    preview: mediaUrl(preview, args.proxyUrl),
    full: mediaUrl(full, args.proxyUrl),
    width: post.width,
    height: post.height,
    tags: post.tags ? post.tags.split(' ').filter(Boolean) : [],
    pageUrl: `https://gelbooru.com/index.php?page=post&s=view&id=${post.id}`,
    sourceUrl: post.source?.startsWith('http') ? post.source : undefined,
    rating: RATING[post.rating] ?? 'questionable',
    ext: post.file_ext,
  }
}

export async function searchGelbooru(args: SearchArgs): Promise<SearchResponse> {
  if (!args.apiKey?.trim() || !args.userId?.trim()) {
    throw new AuthRequiredError(
      'gelbooru',
      'Gelbooru necesita una API key y un User ID gratuitos',
    )
  }

  const tags = [args.query.trim(), ...toBooruExclusions(args.blacklist.tags)]
  if (!args.nsfw) tags.push('rating:general')

  const params = new URLSearchParams({
    page: 'dapi',
    s: 'post',
    q: 'index',
    json: '1',
    limit: String(args.perPage),
    pid: String(Math.max(0, args.page - 1)),
    tags: tags.filter(Boolean).join(' '),
    api_key: args.apiKey.trim(),
    user_id: args.userId.trim(),
  })

  const data = await fetchJson<GelbooruResponse>(
    `https://gelbooru.com/index.php?${params.toString()}`,
    {
      provider: 'gelbooru',
      signal: args.signal,
      proxyUrl: args.proxyUrl,
      needsProxy: true,
    },
  )

  const posts = Array.isArray(data)
    ? data
    : Array.isArray(data.post)
      ? data.post
      : data.post
        ? [data.post]
        : []

  const items = posts
    .filter((post) => post.file_url || post.sample_url || post.preview_url)
    .map((post) => normalize(post, args))

  return { items, hasMore: posts.length >= args.perPage }
}
