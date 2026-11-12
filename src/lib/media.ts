import type { ImageItem, ProviderId } from '../types'
import { hasServerProxy } from './env'
import { buildProxyUrl, sameOriginUrls } from './proxy'

/**
 * URLs del CDN de Gelbooru y Rule34, que bloquean el hotlink por referer.
 *
 * Cuando el servidor de la app ofrece `/media` lo usamos (en streaming, sin
 * guardar el archivo en memoria); si no, el proxy configurado por el usuario
 * en Ajustes → Red.
 */
export function mediaUrl(url: string, proxyUrl: string): string {
  if (!url) return ''

  if (hasServerProxy()) {
    return `/media?url=${encodeURIComponent(url)}`
  }

  const proxy = proxyUrl.trim()
  return proxy ? buildProxyUrl(proxy, url) : url
}

/**
 * URL con la que mostrar una imagen.
 *
 * Hay fuentes que no mandan cabeceras CORS y otras (Yande.re) que redirigen
 * al post cuando la petición no viene de su web: en ambos casos la imagen
 * se acaba mostrando como HTML o directamente se queda cargando. Al pasar
 * por el proxy del servidor —o por el que configuró el usuario— llega
 * intacta.
 *
 * Las URLs que ya son rutas del mismo origen (por ejemplo `/media?url=...`)
 * se dejan como están.
 */
export function proxiedUrl(
  provider: ProviderId,
  url: string,
  proxyUrl?: string,
): string {
  if (!url || !/^https?:\/\//i.test(url)) return url

  if (hasServerProxy()) {
    const same = sameOriginUrls(provider, url)
    return same[0] ?? url
  }

  const proxy = proxyUrl?.trim()
  return proxy ? buildProxyUrl(proxy, url) : url
}

/**
 * URLs con las que mostrar una imagen, en orden de intento.
 *
 * Para *mostrar* no hace falta leer el binario: un `<img>` carga la imagen
 * aunque el CDN no mande CORS, y con `referrerPolicy="no-referrer"` los CDNs
 * que odian el hotlink (Yande.re redirige al post con referer ajeno; Konachan
 * funciona igual sin referer) la sirven. Por eso el primer intento de cada
 * nivel de resolución (`thumb`, `preview`, `full`) es la URL directa: la
 * imagen va del CDN al dispositivo y el servidor de la app solo recibe lo
 * inevitable (el JSON de las APIs sin CORS, las descargas y los CDNs que
 * exigen referer propio, que ya llegan como rutas `/media`).
 *
 * El segundo intento de cada nivel es la misma imagen por el servidor
 * (`proxiedUrl`), para los despliegues o los caprichos del CDN que la
 * bloqueen. Los candidatos repetidos se descartan: hay fuentes que devuelven
 * `thumb === preview`.
 */
export function displayUrls(
  provider: ProviderId,
  item: Pick<ImageItem, 'thumb' | 'preview' | 'full'>,
  proxyUrl?: string,
): string[] {
  const levels = [item.thumb, item.preview, item.full].filter(Boolean)
  const urls = levels.flatMap((level) => [
    level,
    proxiedUrl(provider, level, proxyUrl),
  ])
  return Array.from(new Set(urls))
}
