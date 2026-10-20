import type { ImageItem, SearchArgs, SearchResponse } from '../../types'
import { fetchJson } from '../http'

interface AnimePicturePost {
  id: number
  md5: string
  width: number
  height: number
  ext: string
  erotics: number
}

interface AnimePictureResponse {
  posts: AnimePicturePost[]
  page_number: number
  max_pages: number
}

function previewUrl(md5: string, suffix: 'sp' | 'cp' | 'bp'): string {
  return `https://opreviews.anime-pictures.net/${md5.slice(0, 3)}/${md5}_${suffix}.avif`
}

export async function searchAnimePictures(args: SearchArgs): Promise<SearchResponse> {
  const params = new URLSearchParams({
    page: String(args.page - 1),
    limit: String(args.perPage),
    lang: 'en',
  })
  if (args.query.trim()) params.set('search_tag', args.query.trim())

  const data = await fetchJson<AnimePictureResponse>(
    `https://api.anime-pictures.net/api/v3/posts?${params.toString()}`,
    {
      provider: 'anime-pictures',
      signal: args.signal,
      proxyUrl: args.proxyUrl,
      needsProxy: true,
    },
  )

  const items = data.posts
    .filter((post) => args.nsfw || post.erotics === 0)
    .map<ImageItem>((post) => ({
      key: `anime-pictures:${post.id}`,
      id: String(post.id),
      provider: 'anime-pictures',
      providerLabel: 'Anime-Pictures',
      thumb: previewUrl(post.md5, 'sp'),
      preview:
        args.quality === 'max'
          ? previewUrl(post.md5, 'bp')
          : args.quality === 'general'
            ? previewUrl(post.md5, 'cp')
            : previewUrl(post.md5, 'sp'),
      full: previewUrl(post.md5, 'bp'),
      width: post.width,
      height: post.height,
      tags: [],
      pageUrl: `https://anime-pictures.net/posts/${post.id}`,
      rating: post.erotics > 0 ? 'questionable' : 'safe',
      ext: 'avif',
    }))

  return {
    items,
    hasMore: data.page_number + 1 < data.max_pages,
  }
}
