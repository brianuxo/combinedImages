import type { ImageItem } from '../types'

function extensionOf(item: ImageItem): string {
  if (item.ext) return item.ext.replace(/^\./, '')
  const match = item.full.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)
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

function triggerDownload(blob: Blob, filename: string): void {
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

export type DownloadOutcome = 'saved' | 'opened'

export async function downloadImage(
  item: ImageItem,
  options: { metadata?: boolean } = {},
): Promise<DownloadOutcome> {
  const filename = safeFilename(item)

  try {
    const response = await fetch(item.full, {
      mode: 'cors',
      credentials: 'omit',
      // Algunos CDN (Wallhaven) bloquean las peticiones que envían referer.
      referrerPolicy: item.noReferrer ? 'no-referrer' : undefined,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    if (blob.size === 0) throw new Error('Archivo vacío')
    triggerDownload(blob, filename)

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
        triggerDownload(
          new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
          filename.replace(/\.[^.]+$/, '') + '.json',
        )
      }, 250)
    }

    return 'saved'
  } catch {
    // Sin cabeceras CORS no podemos leer el binario. El llamador ofrece el
    // enlace directo para que el usuario lo abra o guarde manualmente.
    return 'opened'
  }
}
