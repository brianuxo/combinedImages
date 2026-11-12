import { useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Archive, ArrowLeft, Heart, Loader2, Trash2 } from 'lucide-react'
import { useFavorites } from '../../context/favorites'
import { useSettings } from '../../context/settings'
import { useSync } from '../../context/sync'
import { useToast } from '../../context/toast'
import { useMasonry } from '../../hooks/useMasonry'
import { downloadImage } from '../../lib/download'
import { zipFavorites, type ZipProgress } from '../../lib/favoritesZip'
import type { ImageItem, ProviderId } from '../../types'
import { ImageCard } from '../gallery/ImageCard'
import { Lightbox } from '../gallery/Lightbox'

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FavoritesView({
  onBack,
  onExplore,
  onSearch,
  onAuthor,
}: {
  onBack: () => void
  onExplore: () => void
  /** Abre una fuente con una búsqueda de tags. */
  onSearch: (provider: ProviderId, query: string) => void
  /** Abre una fuente filtrada por el autor indicado. */
  onAuthor: (provider: ProviderId, author: string) => void
}) {
  const { items, count, clear } = useFavorites()
  const { settings } = useSettings()
  const sync = useSync()
  const { push } = useToast()
  const where = sync.enabled ? 'en tus dispositivos' : 'solo en este navegador'

  const [selected, setSelected] = useState<number | null>(null)
  const [job, setJob] = useState<ZipProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { ref: masonryRef, columns, metrics } = useMasonry(items)

  // Si se quita el favorito que está abierto, el índice deja de existir: se
  // ignora en lugar de cerrar el visor de golpe.
  const openIndex = selected !== null && items[selected] ? selected : null

  const handleDownload = async (item: ImageItem) => {
    const outcome = await downloadImage(item, { proxyUrl: settings.proxyUrl })
    if (outcome === 'saved') {
      push('Descarga iniciada', 'success')
    } else {
      push('No se pudo descargar la imagen.', 'warn', {
        label: 'Abrir original',
        href: item.full,
      })
    }
  }

  const handleZip = async () => {
    if (job) return

    const controller = new AbortController()
    abortRef.current = controller
    setJob({ done: 0, total: items.length })

    try {
      const result = await zipFavorites(items, {
        proxyUrl: settings.proxyUrl,
        signal: controller.signal,
        onProgress: setJob,
      })

      if (result.saved === 0) {
        push('No se pudo descargar ninguna imagen. Prueba con otra fuente.', 'warn')
        return
      }

      if (result.truncated) {
        push(
          `ZIP con ${result.saved} imágenes (${megabytes(result.bytes)}): se alcanzó el límite de memoria.`,
          'warn',
        )
      } else if (result.failed.length > 0) {
        push(
          `ZIP con ${result.saved} imágenes (${megabytes(result.bytes)}) · ${result.failed.length} no se pudieron descargar.`,
          'warn',
        )
      } else {
        push(`ZIP listo: ${result.saved} imágenes · ${megabytes(result.bytes)}`, 'success')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        push('Copia cancelada', 'default')
      } else {
        push('No se pudo crear el ZIP.', 'error')
      }
    } finally {
      abortRef.current = null
      setJob(null)
    }
  }

  const handleClear = () => {
    const scope = sync.enabled ? 'de todos tus dispositivos' : 'de este navegador'
    if (!window.confirm(`¿Vaciar los ${count} favoritos ${scope}?`)) return
    clear()
    setSelected(null)
    push('Favoritos vaciados', 'success')
  }

  return (
    <div className="gallery favorites">
      <header className="gallery-head fav-head">
        <div className="gallery-title">
          <button type="button" className="icon-btn ghost" aria-label="Volver" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <span className="gallery-badge fav-badge">
            <Heart size={20} fill="currentColor" />
          </span>
          <div className="gallery-names">
            <h1>Favoritos</h1>
            <p>
              {count === 0
                ? 'Tu galería dentro de la app'
                : `${count} ${count === 1 ? 'imagen guardada' : 'imágenes guardadas'} · ${where}`}
            </p>
          </div>
        </div>

        <div className="fav-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={count === 0 || Boolean(job)}
            onClick={handleZip}
          >
            <Archive size={15} />
            Descargar ZIP
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={count === 0 || Boolean(job)}
            onClick={handleClear}
          >
            <Trash2 size={15} />
            Vaciar
          </button>
        </div>
      </header>

      {job && (
        <div className="zip-job" role="status" aria-live="polite">
          <div className="zip-job-head">
            <span>
              <Loader2 size={14} className="spin" />
              Preparando el ZIP · {job.done} de {job.total}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => abortRef.current?.abort()}
            >
              Cancelar
            </button>
          </div>
          <div className="zip-bar">
            <span
              style={{
                width: `${job.total > 0 ? Math.round((job.done / job.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="hint">
            Se descargan los originales a máxima calidad, no las miniaturas. Tarda según el
            tamaño de cada archivo.
          </p>
        </div>
      )}

      {count === 0 && !job && (
        <div className="state-panel">
          <span className="state-icon">
            <Heart size={22} />
          </span>
          <h2>Todavía no hay favoritos</h2>
          <p>
            Abre una imagen y pulsa <strong>Guardar en favoritos</strong> (o la tecla{' '}
            <kbd>S</kbd>). Desde aquí puedes descargarlas todas juntas en un ZIP.
          </p>
          <div className="state-actions">
            <button type="button" className="btn btn-primary" onClick={onExplore}>
              Explorar fuentes
            </button>
          </div>
        </div>
      )}

      {count > 0 && (
        <>
          <div className="masonry" ref={masonryRef} style={{ gap: metrics.gap }}>
            {columns.map((column, columnIndex) => (
              <div className="masonry-col" key={columnIndex} style={{ gap: metrics.gap }}>
                {column.map((item) => (
                  <ImageCard
                    key={item.key}
                    item={item}
                    proxyUrl={settings.proxyUrl}
                    onOpen={() => {
                      const index = items.findIndex((entry) => entry.key === item.key)
                      if (index >= 0) setSelected(index)
                    }}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="end-note">
            {count} {count === 1 ? 'imagen' : 'imágenes'} · se guardan {where}
          </div>
        </>
      )}

      <AnimatePresence>
        {openIndex !== null && items[openIndex] && (
          <Lightbox
            key="lightbox"
            items={items}
            index={openIndex}
            proxyUrl={settings.proxyUrl}
            onClose={() => setSelected(null)}
            onNavigate={setSelected}
            onTag={(tag) => onSearch(items[openIndex].provider, tag)}
            onAuthor={(author) => onAuthor(items[openIndex].provider, author)}
            onDownload={handleDownload}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
