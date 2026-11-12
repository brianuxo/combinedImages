// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadImage, safeFilename } from '../download'
import { sameOriginUrls } from '../proxy'
import type { ImageItem } from '../../types'

// El orden de las vías depende de si el servidor de la app reenvía `/proxy/*`.
const env = vi.hoisted(() => ({ serverProxy: true }))
vi.mock('../env', () => ({ hasServerProxy: () => env.serverProxy }))

const ITEM: ImageItem = {
  key: 'konachan:1',
  id: '1',
  provider: 'konachan',
  providerLabel: 'Konachan',
  thumb: 'https://konachan.com/data/preview/aa/bb/cc.jpg',
  preview: 'https://konachan.com/sample/aa/bb/cc.jpg',
  full: 'https://konachan.com/image/aa/bb/cc.png',
  width: 1920,
  height: 1080,
  tags: ['sora_(arknights)', 'wolfgirl'],
  pageUrl: 'https://konachan.com/post/show/1',
  rating: 'safe',
  ext: 'png',
}

interface FetchSpec {
  ok?: boolean
  status?: number
  type?: string
  size?: number
}

function mockFetch(responses: FetchSpec[]) {
  const calls: string[] = []
  let index = 0
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url)
    const spec = responses[Math.min(index, responses.length - 1)]
    index += 1
    if (spec.ok === false) {
      return { ok: false, status: spec.status ?? 500, headers: new Headers() }
    }
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': spec.type ?? 'image/png' }),
      blob: async () => ({ size: spec.size ?? 1024 }),
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

/** Nombre del archivo con el que se disparó la descarga, si la hubo. */
let downloaded: string | null = null

beforeEach(() => {
  downloaded = null
  env.serverProxy = true
  URL.createObjectURL = vi.fn(() => 'blob:mock') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloaded = this.download
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sameOriginUrls', () => {
  it('convierte la URL de la imagen en la ruta del proxy', () => {
    expect(sameOriginUrls('konachan', ITEM.full)).toEqual([
      '/proxy/konachan/image/aa/bb/cc.png',
    ])
  })

  it('no inventa rutas para hosts que no son de la fuente', () => {
    expect(sameOriginUrls('konachan', 'https://otro-sitio.com/a.png')).toEqual([])
  })

  it('traduce también el host de las imágenes de Yande.re', () => {
    expect(sameOriginUrls('yandere', 'https://yande.re/image/a.png')).toEqual([
      '/proxy/yandere/image/a.png',
    ])
  })
})

describe('downloadImage', () => {
  it('pide la imagen por el proxy del servidor y evita el error de CORS', async () => {
    const { calls } = mockFetch([{ type: 'image/png' }])

    const outcome = await downloadImage(ITEM)

    expect(outcome).toBe('saved')
    expect(calls).toEqual(['/proxy/konachan/image/aa/bb/cc.png'])
    expect(downloaded).toBe('konachan-1-sora-arknights.png')
  })

  it('cae a la URL directa si el proxy del servidor no responde', async () => {
    const { calls } = mockFetch([
      { ok: false, status: 404 },
      { type: 'image/png', size: 2048 },
    ])

    const outcome = await downloadImage(ITEM)

    expect(outcome).toBe('saved')
    expect(calls).toEqual(['/proxy/konachan/image/aa/bb/cc.png', ITEM.full])
    expect(downloaded).toBe('konachan-1-sora-arknights.png')
  })

  it('prueba la URL directa primero cuando no hay proxy en el servidor', async () => {
    env.serverProxy = false
    const { calls } = mockFetch([{ type: 'image/png' }])

    const outcome = await downloadImage(ITEM)

    expect(outcome).toBe('saved')
    expect(calls).toEqual([ITEM.full])
  })

  it('usa el proxy configurado por el usuario si el del servidor no está', async () => {
    env.serverProxy = false
    const { calls } = mockFetch([
      { ok: false, status: 0 },
      { ok: false, status: 404 },
      { type: 'image/png' },
    ])

    const outcome = await downloadImage(ITEM, {
      proxyUrl: 'https://worker.ejemplo/?url={url}',
    })

    expect(outcome).toBe('saved')
    expect(calls).toHaveLength(3)
    expect(calls[2].startsWith('https://worker.ejemplo/')).toBe(true)
    expect(downloaded).toBe('konachan-1-sora-arknights.png')
  })

  it('no guarda una página de error en lugar de la imagen', async () => {
    mockFetch([{ type: 'text/html; charset=utf-8' }])

    const outcome = await downloadImage(ITEM)

    expect(outcome).toBe('opened')
    expect(downloaded).toBeNull()
  })

  it('devuelve "opened" cuando ninguna vía funciona', async () => {
    mockFetch([{ ok: false, status: 403 }])

    expect(await downloadImage(ITEM)).toBe('opened')
    expect(downloaded).toBeNull()
  })
})

describe('safeFilename', () => {
  it('usa la fuente, el id y el primer tag', () => {
    expect(safeFilename(ITEM)).toBe('konachan-1-sora-arknights.png')
  })
})
