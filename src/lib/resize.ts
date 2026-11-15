import { PROVIDER_MAP } from '../data/providers'
import type { ImageItem, ProviderId } from '../types'
import { hasServerProxy } from './env'
import { buildProxyUrl } from './proxy'

export interface Size {
  width: number
  height: number
}

/**
 * Dimensiones tras aplicar el tope del lado mayor.
 *
 * `maxSide = 0` significa sin tope. Si la imagen original ya cabe dentro del
 * tope se devuelve tal cual; si no, se escala en proporción (nunca se deforma
 * ni se amplía).
 */
export function cappedSize(width: number, height: number, maxSide: number): Size {
  if (!width || !height || !maxSide) return { width, height }
  const side = Math.max(width, height)
  if (side <= maxSide) return { width, height }
  const scale = maxSide / side
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

const WSERV = 'https://wsrv.nl/'

/**
 * Imagen redimensionada por wsrv.nl (images.weserv.nl), un resizer externo
 * gratuito. `fit=inside` limita el lado mayor a `w`/`h` conservando la
 * proporción.
 */
export function wsrvUrl(url: string, maxSide: number): string {
  const params = new URLSearchParams({
    url,
    w: String(maxSide),
    h: String(maxSide),
    fit: 'inside',
    output: 'webp',
  })
  return `${WSERV}?${params.toString()}`
}

/**
 * URL con la que mostrar una imagen limitada a `maxSide` px en su lado mayor.
 *
 * Prioridad:
 *
 * 1. Servidor propio (`hasServerProxy()`): el propio servidor redimensiona.
 *    - Fuentes con CDN que bloquea el hotlink (`needsMediaProxy`: Gelbooru,
 *      Rule34) van por `/media?url=…&w=…`, que añade el referer correcto.
 *    - El resto va por `/resize?url=…&w=…`, que acepta cualquier host https.
 * 2. Sin servidor propio y la URL es externa: `wsrv.nl`, salvo que la fuente
 *    bloquee peticiones sin su referer (ahí wsrv no podría leerla) — en ese
 *    caso se usa el proxy que el usuario tenga en Ajustes → Red, sin tope.
 * 3. Si no se puede redimensionar, la URL tal cual: la cadena de candidatos
 *    de `displayUrls` probará el siguiente nivel si falla.
 *
 * Si la imagen original ya cabe dentro del tope (o se desconoce su tamaño y
 * no hay tope) la URL no se toca. La descarga nunca pasa por aquí: usa
 * siempre `item.full` (original).
 */
export function capDisplayUrl(
  provider: ProviderId,
  url: string,
  item: Partial<Pick<ImageItem, 'width' | 'height'>>,
  maxSide: number,
  proxyUrl?: string,
): string {
  if (!url || !maxSide) return url

  // Las rutas /media llevan la URL del CDN dentro: se les añade el tope.
  if (url.startsWith('/media?')) {
    const inner = new URLSearchParams(url.slice('/media?'.length)).get('url') ?? ''
    return `/media?url=${encodeURIComponent(inner)}&w=${maxSide}`
  }

  if (!/^https?:\/\//i.test(url)) return url

  // Si conocemos el tamaño original y ya cabe, no hace falta redimensionar.
  const width = item.width ?? 0
  const height = item.height ?? 0
  if (width > 0 && height > 0) {
    const capped = cappedSize(width, height, maxSide)
    if (capped.width === width && capped.height === height) return url
  }

  if (hasServerProxy()) {
    if (PROVIDER_MAP[provider]?.needsMediaProxy) {
      return `/media?url=${encodeURIComponent(url)}&w=${maxSide}`
    }
    return `/resize?url=${encodeURIComponent(url)}&w=${maxSide}`
  }

  if (PROVIDER_MAP[provider]?.needsMediaProxy) {
    const proxy = proxyUrl?.trim()
    return proxy ? buildProxyUrl(proxy, url) : url
  }

  return wsrvUrl(url, maxSide)
}
