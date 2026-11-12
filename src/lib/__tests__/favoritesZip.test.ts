// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { zipFavorites, zipFilename } from '../favoritesZip'
import type { ImageItem } from '../../types'

function image(id: string, provider: ImageItem['provider'] = 'konachan'): ImageItem {
  return {
    key: `${provider}:${id}`,
    id,
    provider,
    providerLabel: provider,
    thumb: 'https://example.com/thumb.jpg',
    preview: 'https://example.com/sample.jpg',
    full: `https://example.com/file-${id}.png`,
    width: 1920,
    height: 1080,
    tags: ['wlop'],
    pageUrl: `https://example.com/post/${id}`,
    rating: 'safe',
    ext: 'png',
  }
}

/** Guarda la descarga disparada, si la hubo. */
let downloaded: string | null = null

function mockFetch(fail: string[] = []) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      if (fail.some((needle) => url.includes(needle))) {
        return { ok: false, status: 404, headers: new Headers() }
      }
      const body = new TextEncoder().encode(`cuerpo:${url}`)
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'image/png' }),
        blob: async () => new Blob([body]),
      }
    }),
  )
  return calls
}

/** Busca un nombre dentro del ZIP en claro (sin compresión). */
function contains(bytes: Uint8Array, needle: string): boolean {
  return new TextDecoder('utf-8').decode(bytes).includes(needle)
}

beforeEach(() => {
  downloaded = null
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

describe('zipFavorites', () => {
  it('descarga los originales y los empaqueta', async () => {
    mockFetch()
    const progress: number[] = []

    const result = await zipFavorites([image('1'), image('2', 'yandere')], {
      onProgress: (state) => progress.push(state.done),
    })
    const bytes = new Uint8Array(await result.blob.arrayBuffer())

    expect(result.saved).toBe(2)
    expect(result.failed).toEqual([])
    expect(result.bytes).toBeGreaterThan(0)
    expect(result.truncated).toBe(false)
    expect(result.filename).toMatch(/^combined-favoritos-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/)
    expect(downloaded).toBe(result.filename)
    expect(contains(bytes, 'konachan-1-wlop.png')).toBe(true)
    expect(contains(bytes, 'yandere-2-wlop.png')).toBe(true)
    expect(progress.at(-1)).toBe(2)
  })

  it('sigue adelante si una imagen no se puede traer', async () => {
    mockFetch(['file-2'])

    const result = await zipFavorites([image('1'), image('2')])

    expect(result.saved).toBe(1)
    expect(result.failed.map((entry) => entry.id)).toEqual(['2'])
    expect(downloaded).not.toBeNull()
  })

  it('no guarda nada si no se pudo traer ninguna imagen', async () => {
    mockFetch(['file-1'])

    const result = await zipFavorites([image('1')])

    expect(result.saved).toBe(0)
    expect(downloaded).toBeNull()
  })

  it('corta al llegar al límite de memoria y lo avisa', async () => {
    mockFetch()

    const result = await zipFavorites([image('1'), image('2')], { limitBytes: 1 })

    expect(result.truncated).toBe(true)
    expect(result.saved).toBe(1)
  })

  it('se puede cancelar', async () => {
    mockFetch()
    const controller = new AbortController()
    controller.abort()

    await expect(
      zipFavorites([image('1')], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(downloaded).toBeNull()
  })
})

describe('zipFilename', () => {
  it('incluye la fecha y la hora', () => {
    expect(zipFilename(new Date(2026, 9, 21, 4, 5))).toBe(
      'combined-favoritos-2026-10-21-0405.zip',
    )
  })
})
