import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Heart,
  Loader2,
  X,
} from 'lucide-react'
import { useFavorites } from '../../context/favorites'
import { displayUrls } from '../../lib/media'
import type { ImageItem } from '../../types'

const RATING_LABEL = {
  safe: 'Seguro',
  questionable: 'Sugerente',
  explicit: 'Explícito',
} as const

export function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
  onTag,
  onAuthor,
  onDownload,
  proxyUrl,
}: {
  items: ImageItem[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  onTag: (tag: string) => void
  onAuthor: (author: string) => void
  onDownload: (item: ImageItem) => void
  proxyUrl?: string
}) {
  const item = items[index]
  // Guardamos la clave de la imagen cargada en vez de un booleano para no
  // necesitar un efecto que lo reinicie al navegar.
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loaded = Boolean(item) && loadedKey === item.key
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const favorites = useFavorites()
  const saved = item ? favorites.has(item.key) : false

  const toggleFavorite = useCallback(() => {
    if (item) favorites.toggle(item)
  }, [favorites, item])

  // Igual que en la rejilla: primero se pide al CDN directamente —el
  // dispositivo la carga del origen, no del servidor de la app— y, si el
  // CDN la bloquea, se reintentan por el proxy del servidor.
  const candidates = useMemo(
    () => (item ? displayUrls(item.provider, item, proxyUrl) : []),
    [item, proxyUrl],
  )
  // El contador de intentos vive junto a la clave de la imagen mostrada:
  // al cambiar de imagen —durante el propio render— vuelve a empezar por
  // la URL directa sin necesidad de un efecto extra.
  const [state, setState] = useState<{ key?: string; attempt: number }>({
    attempt: 0,
  })
  if (item && state.key !== item.key) setState({ key: item.key, attempt: 0 })
  const attempt = state.key === item?.key ? state.attempt : 0
  const source =
    candidates.length > 0
      ? candidates[Math.min(attempt, candidates.length - 1)]
      : ''
  const retry = () =>
    setState((current) =>
      current.key === item?.key
        ? { ...current, attempt: current.attempt + 1 }
        : current,
    )

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onNavigate((index + 1) % items.length)
      if (event.key === 'ArrowLeft') onNavigate((index - 1 + items.length) % items.length)
      if (event.key.toLowerCase() === 's' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        toggleFavorite()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, items.length, onClose, onNavigate, toggleFavorite])

  if (!item) return null

  return (
    <motion.div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${item.providerLabel}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.24 }}
    >
      <div className="lb-scrim" onClick={onClose} />

      <div className="lb-shell">
        <button type="button" className="icon-btn lb-close" aria-label="Cerrar" onClick={onClose}>
          <X size={19} />
        </button>

        <div className="lb-stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={item.key}
              src={source}
              alt={item.tags.slice(0, 5).join(', ') || item.providerLabel}
              className={loaded ? 'is-loaded' : ''}
              referrerPolicy={item.noReferrer ? 'no-referrer' : undefined}
              onLoad={() => setLoadedKey(item.key)}
              onError={retry}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
              animate={{ opacity: loaded ? 1 : 0.2, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.1 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              drag={reduced ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -90) onNavigate((index + 1) % items.length)
                else if (info.offset.x > 90)
                  onNavigate((index - 1 + items.length) % items.length)
              }}
            />
          </AnimatePresence>
          {!loaded && (
            <span className="lb-loader">
              <Loader2 size={22} className="spin" />
            </span>
          )}
          <span className="lb-counter">
            {index + 1} / {items.length}
          </span>
        </div>

        <button
          type="button"
          className="lb-nav lb-prev"
          aria-label="Anterior"
          onClick={() => onNavigate((index - 1 + items.length) % items.length)}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          className="lb-nav lb-next"
          aria-label="Siguiente"
          onClick={() => onNavigate((index + 1) % items.length)}
        >
          <ChevronRight size={22} />
        </button>

        <aside className="lb-meta">
          <div className="lb-head">
            <span className={`rating rating-${item.rating}`}>{RATING_LABEL[item.rating]}</span>
            <span className="lb-provider">{item.providerLabel}</span>
          </div>

          <div className="lb-facts">
            <div>
              <span>Resolución</span>
              <strong>
                {item.width > 0 && item.height > 0
                  ? `${item.width} × ${item.height}`
                  : 'Desconocida'}
              </strong>
            </div>
            {item.author && (
              <div>
                <span>Autor</span>
                <button
                  type="button"
                  className="lb-author"
                  onClick={() => onAuthor(item.author!)}
                  title={`Ver imágenes de ${item.author}`}
                >
                  {item.author}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              </div>
            )}
            {item.license && (
              <div>
                <span>Licencia</span>
                <strong>{item.license}</strong>
              </div>
            )}
          </div>

          {item.tags.length > 0 && (
            <div className="lb-tags">
              {item.tags.slice(0, 16).map((tag) => (
                <button
                  type="button"
                  className="chip chip-button"
                  key={tag}
                  onClick={() => onTag(tag)}
                  title={`Buscar ${tag}`}
                >
                  {tag.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          <div className="lb-actions">
            <button
              type="button"
              className={`btn ${saved ? 'btn-saved' : 'btn-ghost'}`}
              aria-pressed={saved}
              onClick={toggleFavorite}
            >
              <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
              {saved ? 'Guardado en favoritos' : 'Guardar en favoritos'}
            </button>
            <div className="lb-actions-row">
              <button type="button" className="btn btn-primary" onClick={() => onDownload(item)}>
                <Download size={16} />
                Descargar
              </button>
              <a
                className="btn btn-ghost"
                href={item.pageUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Original
              </a>
            </div>
          </div>

          <p className="hint lb-hint">
            Los favoritos se guardan solo en este navegador. <kbd>S</kbd> guarda la imagen que
            estás viendo.
          </p>
        </aside>
      </div>
    </motion.div>
  )
}
