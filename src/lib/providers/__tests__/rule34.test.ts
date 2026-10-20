import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRequiredError } from '../../http'
import { searchRule34 } from '../rule34'
import { lastRequestUrl, makeArgs } from './helpers'

const POST = {
  id: 777,
  rating: 'q',
  width: 1200,
  height: 1600,
  tags: '1girl solo rating:questionable',
  file_url: 'https://us.rule34.xxx/images/ab/cd/file.png',
  sample_url: 'https://us.rule34.xxx/sample/ab/cd/file.png',
  preview_url: 'https://us.rule34.xxx/thumbnails/ab/cd/file.png',
  file_ext: 'png',
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

describe('searchRule34', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exige API key y User ID', async () => {
    const fetchMock = mockResponse([])
    await expect(searchRule34(makeArgs({ userId: '5' }))).rejects.toBeInstanceOf(
      AuthRequiredError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía las credenciales y la página 0-based', async () => {
    const fetchMock = mockResponse([POST])
    await searchRule34(makeArgs({ page: 2, apiKey: 'KEY', userId: '9' }))

    const url = lastRequestUrl(fetchMock as never)
    expect(url.searchParams.get('api_key')).toBe('KEY')
    expect(url.searchParams.get('user_id')).toBe('9')
    expect(url.searchParams.get('pid')).toBe('1')
    expect(url.searchParams.get('json')).toBe('1')
  })

  it('convierte la respuesta de autenticación en AuthRequiredError', async () => {
    mockResponse('Missing authentication. Go to api.rule34.xxx for more information')
    await expect(
      searchRule34(makeArgs({ apiKey: 'bad', userId: '9' })),
    ).rejects.toBeInstanceOf(AuthRequiredError)
  })

  it('normaliza los posts y proxya las imágenes', async () => {
    mockResponse([POST])
    const { items } = await searchRule34(makeArgs({ apiKey: 'KEY', userId: '9' }))

    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.key).toBe('rule34:777')
    expect(item.rating).toBe('questionable')
    expect(item.ext).toBe('png')
    expect(item.pageUrl).toBe('https://rule34.xxx/index.php?page=post&s=view&id=777')
    expect(item.tags).toContain('solo')
    expect(decodeURIComponent(item.full.replace('/media?url=', ''))).toBe(POST.file_url)
  })

  it('acepta la forma { post: [...] }', async () => {
    mockResponse({ post: [POST] })
    const { items } = await searchRule34(makeArgs({ apiKey: 'KEY', userId: '9' }))
    expect(items).toHaveLength(1)
  })
})
