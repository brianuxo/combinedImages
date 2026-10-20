import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRequiredError } from '../../http'
import { searchPixabay } from '../pixabay'
import { searchWallhaven } from '../wallhaven'
import { lastRequestUrl, makeArgs } from './helpers'

const WALL = {
  id: 'w539w7',
  url: 'https://wallhaven.cc/w/w539w7',
  path: 'https://w.wallhaven.cc/full/w5/wallhaven-w539w7.jpg',
  source: 'https://example.com',
  purity: 'sfw',
  dimension_x: 2560,
  dimension_y: 1440,
  file_type: 'image/jpeg',
  thumbs: {
    large: 'https://th.wallhaven.cc/lg/w5/w539w7.jpg',
    original: 'https://th.wallhaven.cc/or/w5/w539w7.jpg',
    small: 'https://th.wallhaven.cc/sm/w5/w539w7.jpg',
  },
  uploader: { username: 'someone' },
  tags: [{ name: 'nature' }, { name: 'landscape' }],
}

const PIXABAY_HIT = {
  id: 12345,
  pageURL: 'https://pixabay.com/photos/tree-12345/',
  tags: 'tree, forest, green',
  previewURL: 'https://cdn.pixabay.com/photo/preview.jpg',
  webformatURL: 'https://cdn.pixabay.com/photo/medium_640.jpg',
  largeImageURL: 'https://cdn.pixabay.com/photo/large_1280.jpg',
  fullHDURL: 'https://cdn.pixabay.com/photo/full_1920.jpg',
  imageWidth: 4000,
  imageHeight: 3000,
  user: 'photographer',
}

function mockResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('searchWallhaven', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('pide solo contenido SFW si no hay clave o NSFW está apagado', async () => {
    const fetchMock = mockResponse({ data: [WALL], meta: { current_page: 1, last_page: 2 } })
    await searchWallhaven(makeArgs({ nsfw: true }))
    expect(lastRequestUrl(fetchMock as never).searchParams.get('purity')).toBe('100')
  })

  it('pide NSFW cuando hay clave y NSFW está activo', async () => {
    const fetchMock = mockResponse({ data: [WALL], meta: { current_page: 1, last_page: 2 } })
    await searchWallhaven(makeArgs({ nsfw: true, apiKey: 'KEY' }))
    const url = lastRequestUrl(fetchMock as never)
    expect(url.searchParams.get('purity')).toBe('111')
    expect(url.searchParams.get('apikey')).toBe('KEY')
  })

  it('ordena por fecha cuando no hay búsqueda y por relevancia cuando sí', async () => {
    const fetchMock = mockResponse({ data: [], meta: { current_page: 1, last_page: 1 } })
    await searchWallhaven(makeArgs())
    expect(lastRequestUrl(fetchMock as never).searchParams.get('sorting')).toBe('date_added')

    await searchWallhaven(makeArgs({ query: 'cyberpunk' }))
    expect(lastRequestUrl(fetchMock as never).searchParams.get('sorting')).toBe('relevance')
    expect(lastRequestUrl(fetchMock as never).searchParams.get('q')).toBe('cyberpunk')
  })

  it('normaliza los wallpapers y marca no-referer', async () => {
    mockResponse({ data: [WALL], meta: { current_page: 1, last_page: 5 } })
    const { items, hasMore } = await searchWallhaven(makeArgs())

    expect(hasMore).toBe(true)
    const item = items[0]
    expect(item.key).toBe('wallhaven:w539w7')
    expect(item.full).toBe(WALL.path)
    expect(item.preview).toBe(WALL.thumbs.original)
    expect(item.tags).toEqual(['nature', 'landscape'])
    expect(item.author).toBe('someone')
    expect(item.ext).toBe('jpeg')
    expect(item.noReferrer).toBe(true)
  })
})

describe('searchPixabay', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('exige la API key', async () => {
    const fetchMock = mockResponse({ hits: [] })
    await expect(searchPixabay(makeArgs())).rejects.toBeInstanceOf(AuthRequiredError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía la clave y filtra por contenido seguro', async () => {
    const fetchMock = mockResponse({ totalHits: 10, hits: [PIXABAY_HIT] })
    await searchPixabay(makeArgs({ apiKey: 'PIX', query: 'bosque' }))

    const url = lastRequestUrl(fetchMock as never)
    expect(url.searchParams.get('key')).toBe('PIX')
    expect(url.searchParams.get('safesearch')).toBe('true')
    expect(url.searchParams.get('q')).toBe('bosque')
    expect(url.searchParams.get('page')).toBe('1')
  })

  it('normaliza los resultados', async () => {
    mockResponse({ totalHits: 10, hits: [PIXABAY_HIT] })
    const { items } = await searchPixabay(makeArgs({ apiKey: 'PIX' }))

    const item = items[0]
    expect(item.key).toBe('pixabay:12345')
    expect(item.full).toBe(PIXABAY_HIT.fullHDURL)
    expect(item.tags).toEqual(['tree', 'forest', 'green'])
    expect(item.author).toBe('photographer')
    expect(item.license).toBe('Pixabay Content License')
    expect(item.rating).toBe('safe')
  })

  it('limita el scroll infinito a los 500 resultados de la API', async () => {
    mockResponse({ totalHits: 100000, hits: [PIXABAY_HIT] })
    const { hasMore } = await searchPixabay(
      makeArgs({ apiKey: 'PIX', page: 20, perPage: 28 }),
    )
    expect(hasMore).toBe(false)
  })
})
