import type { ImageItem } from '../types'
import { fetchImageBlob, safeFilename, saveBlob } from './download'
import { ZipWriter } from './zip'

/**
 * Tope de memoria para armar el ZIP. Las imágenes se guardan enteras en RAM
 * antes de empaquetarlas, así que ponemos un límite sensato: si se supera, el
 * ZIP se entrega con lo que ya tiene y se avisa en la interfaz.
 */
export const ZIP_MEMORY_LIMIT = 400 * 1024 * 1024

export interface ZipProgress {
  done: number
  total: number
}

export interface FavoritesZipResult {
  filename: string
  blob: Blob
  /** Imágenes que entraron en el ZIP. */
  saved: number
  /** Imágenes que no se pudieron traer (CORS, borradas en el origen...). */
  failed: ImageItem[]
  /** Tamaño sumado de las imágenes incluidas. */
  bytes: number
  /** Se llegó al límite de memoria y quedaron imágenes fuera. */
  truncated: boolean
}

export interface ZipOptions {
  proxyUrl?: string
  signal?: AbortSignal
  onProgress?: (progress: ZipProgress) => void
  /** Se puede bajar en las pruebas para forzar el corte. */
  limitBytes?: number
}

function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}`
}

export function zipFilename(date = new Date()): string {
  return `combined-favoritos-${stamp(date)}.zip`
}

/**
 * Descarga los originales de todas las imágenes y los empaqueta en un ZIP.
 * Se guarda siempre con la máxima calidad disponible (`item.full`), no con la
 * vista previa que esté configurada en Ajustes → Calidad.
 */
export async function zipFavorites(
  items: ImageItem[],
  options: ZipOptions = {},
): Promise<FavoritesZipResult> {
  const limit = options.limitBytes ?? ZIP_MEMORY_LIMIT
  const zip = new ZipWriter()
  const failed: ImageItem[] = []
  let saved = 0
  let bytes = 0
  let truncated = false

  for (const [index, item] of items.entries()) {
    if (options.signal?.aborted) {
      throw new DOMException('Copia cancelada', 'AbortError')
    }

    if (bytes >= limit) {
      truncated = true
      break
    }

    options.onProgress?.({ done: index, total: items.length })

    try {
      const blob = await fetchImageBlob(item, {
        proxyUrl: options.proxyUrl,
        signal: options.signal,
      })
      if (!blob) {
        failed.push(item)
        continue
      }

      zip.add(safeFilename(item), new Uint8Array(await blob.arrayBuffer()))
      bytes += blob.size
      saved += 1
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      failed.push(item)
    }
  }

  options.onProgress?.({ done: items.length, total: items.length })

  const result: FavoritesZipResult = {
    filename: zipFilename(),
    blob: zip.finish(),
    saved,
    failed,
    bytes,
    truncated,
  }

  if (saved > 0) saveBlob(result.blob, result.filename)
  return result
}
