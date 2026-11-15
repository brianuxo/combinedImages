import type { ImageItem, SearchArgs, SearchResponse } from '../../types'
import { maxSideFor } from '../format'
import { fetchJson } from '../http'

interface WikimediaImageInfo {
  url: string
  descriptionurl: string
  thumburl?: string
  width: number
  height: number
  extmetadata?: Record<string, { value: string }>
}

interface WikimediaPage {
  pageid: number
  title: string
  index: number
  imageinfo?: WikimediaImageInfo[]
}

interface WikimediaResponse {
  query?: { pages?: Record<string, WikimediaPage> }
  continue?: Record<string, string>
}

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined
  const element = document.createElement('div')
  element.innerHTML = value
  const text = element.textContent?.replace(/\s+/g, ' ').trim()
  return text || undefined
}

const THUMB_WIDTH = { max: 1600, general: 1280, optimo: 960 } as const

/**
 * Vista ampliada: Wikimedia genera miniaturas a cualquier ancho con
 * `Special:FilePath`, así que en Óptimo/General se pide directamente la
 * versión topada (1920/2984 px en el lado mayor) en vez de la original.
 */
function previewFor(page: WikimediaPage, info: WikimediaImageInfo, maxSide: number): string {
  if (!maxSide || info.width <= maxSide) return info.thumburl || info.url
  const file = page.title.replace(/^File:/i, '')
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${maxSide}`
}

export async function searchWikimedia(args: SearchArgs): Promise<SearchResponse> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${args.query.trim() || 'featured pictures'}`,
    gsrnamespace: '6',
    gsrlimit: String(args.perPage),
    gsroffset: String((args.page - 1) * args.perPage),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: String(THUMB_WIDTH[args.quality]),
  })

  const data = await fetchJson<WikimediaResponse>(
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
    { provider: 'wikimedia', signal: args.signal, proxyUrl: args.proxyUrl },
  )

  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index)

  const items = pages
    .filter((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
    .map<ImageItem>((page) => {
      const info = page.imageinfo![0]
      const meta = info.extmetadata ?? {}
      const categories = stripHtml(meta.Categories?.value)
      const tags = categories
        ? categories.split('|').map((tag) => tag.trim()).filter(Boolean)
        : page.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').split(' ').slice(0, 8)

      return {
        key: `wikimedia:${page.pageid}`,
        id: String(page.pageid),
        provider: 'wikimedia',
        providerLabel: 'Wikimedia',
        thumb: info.thumburl || info.url,
        preview: previewFor(page, info, maxSideFor(args.quality)),
        full: info.url,
        width: info.width,
        height: info.height,
        tags,
        title: page.title.replace(/^File:/, ''),
        author: stripHtml(meta.Artist?.value) || stripHtml(meta.Credit?.value),
        license:
          stripHtml(meta.LicenseShortName?.value) ||
          stripHtml(meta.UsageTerms?.value),
        pageUrl: info.descriptionurl,
        rating: 'safe',
      }
    })

  return { items, hasMore: Boolean(data.continue) }
}
