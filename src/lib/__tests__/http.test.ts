import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchJson, HttpError, ProxyRequiredError } from '../http'

const KONACHAN_URL = 'https://konachan.com/post.json?tags=&limit=1&page=1'

function options(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'konachan' as const,
    signal: new AbortController().signal,
    ...overrides,
  }
}

/** Simula un despliegue real: no es el servidor de Vite ni localhost. */
function asRemoteDeployment() {
  vi.stubEnv('DEV', false)
  vi.stubGlobal('window', { location: { hostname: 'app.ejemplo.com' } })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchJson', () => {
  it('usa la ruta /proxy/* cuando la app se sirve desde localhost', async () => {
    // En `preview` la build es de producción pero sigue sirviéndose en local.
    vi.stubEnv('DEV', false)
    vi.stubGlobal('window', { location: { hostname: 'localhost' } })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 1 }],
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchJson(KONACHAN_URL, options())

    const url = fetchMock.mock.calls[0][0] as string
    expect(url.startsWith('/proxy/konachan')).toBe(true)
  })

  it('reintenta con /proxy/* cuando la petición directa falla por CORS', async () => {
    asRemoteDeployment()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: 1 }],
      })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchJson(KONACHAN_URL, options())

    expect(data).toEqual([{ id: 1 }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(KONACHAN_URL)
    expect((fetchMock.mock.calls[1][0] as string).startsWith('/proxy/konachan')).toBe(true)
  })

  it('usa el proxy configurado por el usuario si no hay ruta /proxy/*', async () => {
    asRemoteDeployment()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: 2 }],
      })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchJson(
      KONACHAN_URL,
      options({ proxyUrl: 'https://worker.ejemplo/?url={url}' }),
    )

    expect(data).toEqual([{ id: 2 }])
    const proxyCall = fetchMock.mock.calls[2][0] as string
    expect(proxyCall.startsWith('https://worker.ejemplo/')).toBe(true)
    expect(decodeURIComponent(proxyCall)).toContain('konachan.com/post.json')
  })

  it('avisa de que hace falta un proxy cuando no hay ninguna salida', async () => {
    asRemoteDeployment()
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchJson(KONACHAN_URL, options({ needsProxy: true })),
    ).rejects.toBeInstanceOf(ProxyRequiredError)
  })

  it('propaga los errores HTTP sin buscar alternativa', async () => {
    asRemoteDeployment()
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchJson(KONACHAN_URL, options())).rejects.toBeInstanceOf(HttpError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
