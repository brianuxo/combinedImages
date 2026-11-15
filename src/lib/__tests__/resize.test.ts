import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hasServerProxy } from '../env'
import { capDisplayUrl, cappedSize, wsrvUrl } from '../resize'

vi.mock('../env', () => ({ hasServerProxy: vi.fn(() => true) }))

const serverProxy = vi.mocked(hasServerProxy)

const BIG = { width: 4000, height: 3000 }
const SMALL = { width: 1000, height: 800 }
const DANBOORU_URL = 'https://cdn.donmai.us/original/a/b/abc.jpg'
const GELBOORU_URL = 'https://api-cdn-us.rule34.xxx/images/a/b/abc.jpg'

beforeEach(() => {
  serverProxy.mockReturnValue(true)
})

describe('cappedSize', () => {
  it('no toca la imagen si ya cabe en el tope', () => {
    expect(cappedSize(1000, 800, 1920)).toEqual({ width: 1000, height: 800 })
  })

  it(' escala el lado mayor horizontalmente conservando la proporción', () => {
    expect(cappedSize(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 })
  })

  it('escala el lado mayor verticalmente conservando la proporción', () => {
    expect(cappedSize(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 })
  })

  it('maxSide 0 significa sin tope', () => {
    expect(cappedSize(9000, 9000, 0)).toEqual({ width: 9000, height: 9000 })
  })

  it('dimensiones desconocidas (0) no se tocan', () => {
    expect(cappedSize(0, 0, 1920)).toEqual({ width: 0, height: 0 })
  })
})

describe('wsrvUrl', () => {
  it('usa fit=inside para limitar el lado mayor sin deformar', () => {
    const url = wsrvUrl(DANBOORU_URL, 1920)
    expect(url.startsWith('https://wsrv.nl/?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('url')).toBe(DANBOORU_URL)
    expect(params.get('w')).toBe('1920')
    expect(params.get('h')).toBe('1920')
    expect(params.get('fit')).toBe('inside')
  })
})

describe('capDisplayUrl', () => {
  it('sin tope (maxSide 0) devuelve la URL tal cual', () => {
    expect(capDisplayUrl('danbooru', DANBOORU_URL, BIG, 0)).toBe(DANBOORU_URL)
  })

  it('no toca URLs que no son http(s)', () => {
    expect(capDisplayUrl('danbooru', '/proxy/x/a.jpg', BIG, 1920)).toBe('/proxy/x/a.jpg')
  })

  it('si la imagen original ya cabe, no redimensiona', () => {
    expect(capDisplayUrl('danbooru', DANBOORU_URL, SMALL, 1920)).toBe(DANBOORU_URL)
  })

  it('con servidor propio, las fuentes normales van por /resize?url=…&w=', () => {
    expect(capDisplayUrl('danbooru', DANBOORU_URL, BIG, 1920)).toBe(
      `/resize?url=${encodeURIComponent(DANBOORU_URL)}&w=1920`,
    )
  })

  it('con servidor propio, las de hotlink bloqueado van por /media?url=…&w=', () => {
    expect(capDisplayUrl('gelbooru', GELBOORU_URL, BIG, 2984)).toBe(
      `/media?url=${encodeURIComponent(GELBOORU_URL)}&w=2984`,
    )
  })

  it('a una ruta /media existente solo se le añade el parámetro w', () => {
    const media = `/media?url=${encodeURIComponent(GELBOORU_URL)}`
    expect(capDisplayUrl('gelbooru', media, BIG, 1920)).toBe(
      `/media?url=${encodeURIComponent(GELBOORU_URL)}&w=1920`,
    )
  })

  it('sin servidor propio, las externas usan wsrv.nl', () => {
    serverProxy.mockReturnValue(false)
    const url = capDisplayUrl('danbooru', DANBOORU_URL, BIG, 1920)
    expect(url.startsWith('https://wsrv.nl/?')).toBe(true)
    expect(new URL(url).searchParams.get('url')).toBe(DANBOORU_URL)
  })

  it('sin servidor propio, las de hotlink bloqueado usan el proxy del usuario', () => {
    serverProxy.mockReturnValue(false)
    expect(
      capDisplayUrl('gelbooru', GELBOORU_URL, BIG, 1920, 'https://mi-worker.dev/?url={url}'),
    ).toBe(`https://mi-worker.dev/?url=${encodeURIComponent(GELBOORU_URL)}`)
  })

  it('sin servidor propio ni proxy del usuario, la URL queda tal cual (fallback)', () => {
    serverProxy.mockReturnValue(false)
    expect(capDisplayUrl('gelbooru', GELBOORU_URL, BIG, 1920)).toBe(GELBOORU_URL)
  })
})
