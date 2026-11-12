import type { ProviderId } from '../types'
import { hasServerProxy } from './env'
import { apiRoute, buildProxyUrl } from './proxy'

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

// Reexportados para no romper las importaciones existentes.
export { buildProxyUrl } from './proxy'
export { hasServerProxy, isLocalHost } from './env'

interface FetchJsonOptions {
  provider: ProviderId
  signal: AbortSignal
  proxyUrl?: string
  headers?: Record<string, string>
  needsProxy?: boolean
}

async function fetchJsonFrom<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const response = await fetch(url, {
    signal: options.signal,
    headers: { Accept: 'application/json', ...options.headers },
  })
  if (!response.ok) throw new HttpError(response.status)
  return (await response.json()) as T
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const route = apiRoute(options.provider)
  // El servidor de Vite sirve estas rutas tanto en `dev` como en `preview`.
  const local = hasServerProxy()
  const primary = local && route ? url.replace(route.origin, route.path) : url

  try {
    return await fetchJsonFrom<T>(primary, options)
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw error

    // Un despliegue propio puede reenviar `/proxy/*` al host original (ver
    // README). Si esa ruta no existe, seguimos con el proxy configurado por
    // el usuario en Ajustes -> Red.
    if (route && !local) {
      try {
        return await fetchJsonFrom<T>(url.replace(route.origin, route.path), options)
      } catch (proxyError) {
        if (proxyError instanceof DOMException && proxyError.name === 'AbortError') {
          throw proxyError
        }
        // Un 404 significa que no hay proxy en este origen: probamos el
        // siguiente. Cualquier otro error es real y se propaga.
        if (proxyError instanceof HttpError && proxyError.status !== 404) {
          throw proxyError
        }
      }
    }

    const proxyUrl = options.proxyUrl?.trim()
    if (proxyUrl) {
      try {
        // No reenviamos credenciales al proxy: solo la petición pública.
        return await fetchJsonFrom<T>(buildProxyUrl(proxyUrl, url), options)
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
