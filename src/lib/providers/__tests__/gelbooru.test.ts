import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRequiredError } from '../../http'
import { searchGelbooru } from '../gelbooru'
import { lastRequestUrl, makeArgs } from './helpers'

const POST = {
  id: 4242,
  rating: 'explicit',
  width: 1920,
  height: 1080,
  tags: '1girl solo long_hair rating:explicit',
  file_url: 'https://img4.gelbooru.com/images/aa/bb/file.jpg',
  sample_url: 'https://img4.gelbooru.com/sample/aa/bb/file.jpg',
  preview_url: 'https://img4.gelbooru.com/thumbnails/aa/bb/file.jpg',
  file_ext: 'jpg',
  source: 'https://example.com/original',
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

describe('searchGelbooru', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exige API key y User ID', async () => {
    const fetchMock = mockResponse({ post: [] })
    await expect(searchGelbooru(makeArgs())).rejects.toBeInstanceOf(AuthRequiredError)
    await expect(
      searchGelbooru(makeArgs({ apiKey: 'key' })),
    ).rejects.toBeInstanceOf(AuthRequiredError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía las credenciales, la página 0-based y el límite', async () => {
    const fetchMock = mockResponse({ post: [POST] })

    await searchGelbooru(
      makeArgs({
        query: '1girl',
        page: 3,
        perPage: 36,
        apiKey: 'ABC123',
        userId: '77',
      }),
    )

    const url = lastRequestUrl(fetchMock as never)
    expect(url.searchParams.get('api_key')).toBe('ABC123')
    expect(url.searchParams.get('user_id')).toBe('77')
    expect(url.searchParams.get('pid')).toBe('2')
    expect(url.searchParams.get('limit')).toBe('36')
    expect(url.searchParams.get('tags')).toContain('1girl')
    expect(url.searchParams.get('json')).toBe('1')
  })

  it('filtra por rating:general cuando NSFW está desactivado', async () => {
    const fetchMock = mockResponse({ post: [POST] })
    await searchGelbooru(
      makeArgs({ nsfw: false, apiKey: 'ABC123', userId: '77' }),
    )
    const url = lastRequestUrl(fetchMock as never)
    expect(url.searchParams.get('tags')).toContain('rating:general')
  })

  it('añade las exclusiones de la lista negra como -tag', async () => {
    const fetchMock = mockResponse({ post: [POST] })
    await searchGelbooru(
      makeArgs({
        apiKey: 'ABC123',
        userId: '77',
        blacklist: { tags: ['guro', 'watermark'], keywords: [] },
      }),
    )
    const tags = lastRequestUrl(fetchMock as never).searchParams.get('tags') ?? ''
    expect(tags).toContain('-guro')
    expect(tags).toContain('-watermark')
  })

  it('normaliza la respuesta y proxya las imágenes', async () => {
    mockResponse({ post: [POST] })
    const { items, hasMore } = await searchGelbooru(
      makeArgs({ apiKey: 'ABC123', userId: '77' }),
    )

    expect(hasMore).toBe(false)
    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.key).toBe('gelbooru:4242')
    expect(item.providerLabel).toBe('Gelbooru')
    expect(item.rating).toBe('explicit')
    expect(item.tags).toContain('1girl')
    expect(item.pageUrl).toBe('https://gelbooru.com/index.php?page=post&s=view&id=4242')
    expect(item.ext).toBe('jpg')
    expect(item.width).toBe(1920)

    const decode = (value: string) => decodeURIComponent(value.replace('/media?url=', ''))
    expect(decode(item.thumb)).toBe(POST.preview_url)
    expect(decode(item.preview)).toBe(POST.sample_url)
    expect(decode(item.full)).toBe(POST.file_url)
  })

  it('usa la calidad máxima para la vista previa completa', async () => {
    mockResponse({ post: [POST] })
    const { items } = await searchGelbooru(
      makeArgs({ quality: 'max', apiKey: 'ABC123', userId: '77' }),
    )
    expect(decodeURIComponent(items[0].preview.replace('/media?url=', ''))).toBe(POST.file_url)
  })

  it('devuelve lista vacía cuando la API no trae posts', async () => {
    mockResponse({ '@attributes': { total: 0 } })
    const { items, hasMore } = await searchGelbooru(
      makeArgs({ apiKey: 'ABC123', userId: '77' }),
    )
    expect(items).toEqual([])
    expect(hasMore).toBe(false)
  })
})
