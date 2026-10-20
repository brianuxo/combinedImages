import type { ProviderId } from '../types'

/** En desarrollo reescribimos estas APIs a través del proxy de Vite. */
const DEV_REWRITES: Partial<Record<ProviderId, [string, string]>> = {
  konachan: ['https://konachan.com', '/proxy/konachan'],
  yandere: ['https://yande.re', '/proxy/yandere'],
  'anime-pictures': ['https://api.anime-pictures.net', '/proxy/anime-pictures'],
  gelbooru: ['https://gelbooru.com', '/proxy/gelbooru'],
  wallhaven: ['https://wallhaven.cc', '/proxy/wallhaven'],
}

export class HttpError extends Error {
  status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
  }
}

export class ProxyRequiredError extends Error {
  constructor() {
    super('Esta fuente necesita un proxy CORS')
    this.name = 'ProxyRequiredError'
  }
}

export class AuthRequiredError extends Error {
  provider: ProviderId

  constructor(provider: ProviderId, message = 'Falta la clave API de esta fuente') {
    super(message)
    this.name = 'AuthRequiredError'
    this.provider = provider
  }
}

export function buildProxyUrl(template: string, target: string): string {
  if (template.includes('{url}')) {
    return template.replace('{url}', encodeURIComponent(target))
  }
  const separator = template.includes('?') ? '&' : '?'
  return `${template}${separator}url=${encodeURIComponent(target)}`
}

interface FetchJsonOptions {
  provider: ProviderId
  signal: AbortSignal
  proxyUrl?: string
  headers?: Record<string, string>
  needsProxy?: boolean
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const rewrite = DEV_REWRITES[options.provider]
  const primary =
    import.meta.env.DEV && rewrite ? url.replace(rewrite[0], rewrite[1]) : url

  try {
    const response = await fetch(primary, {
      signal: options.signal,
      headers: { Accept: 'application/json', ...options.headers },
    })
    if (!response.ok) throw new HttpError(response.status)
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw error

    const proxyUrl = options.proxyUrl?.trim()
    if (proxyUrl) {
      try {
        // No reenviamos credenciales al proxy: solo la petición pública.
        const response = await fetch(buildProxyUrl(proxyUrl, url), {
          signal: options.signal,
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) throw new HttpError(response.status)
        return (await response.json()) as T
      } catch (proxyError) {
        if (proxyError instanceof HttpError) throw proxyError
        if (proxyError instanceof DOMException && proxyError.name === 'AbortError') {
          throw proxyError
        }
      }
    }

    if (options.needsProxy) throw new ProxyRequiredError()
    throw error
  }
}
