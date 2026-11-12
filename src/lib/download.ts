import type { ImageItem } from '../types'
import { hasServerProxy } from './env'
import { buildProxyUrl, sameOriginUrls } from './proxy'

function extensionOf(item: ImageItem): string {
  if (item.ext) return item.ext.replace(/^\./, '')

  // Gelbooru y Rule34 sirven las imágenes como `/media?url=...`: la extensión
  // está en la URL de dentro, no en la del proxy.
  const source = item.full.startsWith('/media?')
    ? (new URLSearchParams(item.full.slice('/media?'.length)).get('url') ?? item.full)
    : item.full

  const match = source.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)
  return match ? match[1].toLowerCase() : 'jpg'
}

export function safeFilename(item: ImageItem): string {
  const slug = (item.tags[0] ?? item.title ?? 'image')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return `${item.provider}-${item.id}${slug ? `-${slug}` : ''}.${extensionOf(item)}`
}

/** Guarda un blob en el disco del usuario sin salir de la app. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export interface FetchImageOptions {
  /** Proxy CORS configurado por el usuario en Ajustes → Red. */
  proxyUrl?: string
  signal?: AbortSignal
}

/**
 * Devuelve el archivo original. Se prueban varias vías porque algunas fuentes
 * no mandan cabeceras CORS y el navegador no deja leer el binario aunque la
 * imagen se vea en pantalla:
 *
 * 1. La ruta del proxy del servidor (`/proxy/konachan/...`), si existe: al
 *    pasar por el mismo origen que la app, sí se puede leer y no deja errores
 *    de CORS en la consola.
 * 2. La URL directa (funciona en las fuentes con CORS).
 * 3. El proxy que haya configurado el usuario en Ajustes → Red, para los
 *    despliegues que no ofrecen `/proxy/*`.
 *
 * `null` significa que ninguna vía sirvió un archivo de imagen.
 */
export async function fetchImageBlob(
  item: ImageItem,
  options: FetchImageOptions = {},
): Promise<Blob | null> {
  const same = sameOriginUrls(item.provider, item.full)
  const candidates = hasServerProxy() ? [...same, item.full] : [item.full, ...same]

  const proxyUrl = options.proxyUrl?.trim()
  if (proxyUrl) candidates.push(buildProxyUrl(proxyUrl, item.full))

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        // Algunos CDN (Wallhaven) bloquean las peticiones que envían referer.
        referrerPolicy: item.noReferrer ? 'no-referrer' : undefined,
        signal: options.signal,
      })
      if (!response.ok) continue

      // Un error del servidor puede llegar como HTML: no lo guardamos como
      // si fuera la imagen.
      const type = (response.headers.get('Content-Type') ?? '').toLowerCase()
      if (type.includes('text/html') || type.includes('application/json')) continue

      const blob = await response.blob()
      if (blob.size === 0) continue

      return blob
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      // Esta vía no ha funcionado: probamos la siguiente.
    }
  }

  return null
}

export type DownloadOutcome = 'saved' | 'opened'

export interface DownloadOptions extends FetchImageOptions {
  /** Guarda además un `.json` con los metadatos. */
  metadata?: boolean
}

export async function downloadImage(
  item: ImageItem,
  options: DownloadOptions = {},
): Promise<DownloadOutcome> {
  const filename = safeFilename(item)
  const blob = await fetchImageBlob(item, options)

  if (!blob) {
    // Sin ninguna vía posible el llamador ofrece el enlace directo para que
    // el usuario lo abra o guarde manualmente.
    return 'opened'
  }

  saveBlob(blob, filename)

  if (options.metadata) {
    const payload = {
      source: item.provider,
      page: item.pageUrl,
      original: item.full,
      author: item.author ?? null,
      license: item.license ?? null,
      tags: item.tags,
      dimensions: { width: item.width, height: item.height },
      downloaded_at: new Date().toISOString(),
    }
    window.setTimeout(() => {
      saveBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        filename.replace(/\.[^.]+$/, '') + '.json',
      )
    }, 250)
  }

  return 'saved'
}
