import { buildProxyUrl } from './http'

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

/**
 * Los CDN de Gelbooru y Rule34 bloquean el hotlink por referer. En desarrollo
 * usamos el middleware `/media` de Vite; en producción, el proxy configurado.
 */
export function mediaUrl(url: string, proxyUrl: string): string {
  if (!url) return ''

  if (import.meta.env.DEV || isLocalHost()) {
    return `/media?url=${encodeURIComponent(url)}`
  }

  const proxy = proxyUrl.trim()
  return proxy ? buildProxyUrl(proxy, url) : url
}
