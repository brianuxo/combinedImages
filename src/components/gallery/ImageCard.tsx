import { useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import type { ImageItem } from '../../types'

export function ImageCard({
  item,
  onOpen,
  onDownload,
}: {
  item: ImageItem
  onOpen: () => void
  onDownload: (item: ImageItem) => void
}) {
  // La galería monta cada tarjeta con `key={item.key}`, así que el estado
  // se reinicia solo al cambiar de imagen.
  const [source, setSource] = useState(item.thumb)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const ratio =
    item.width > 0 && item.height > 0
      ? Math.min(2, Math.max(0.55, item.width / item.height))
      : 0.75

  return (
    <article className="img-card" onClick={onOpen}>
      <div className="img-wrap" style={{ aspectRatio: String(ratio) }}>
        {!loaded && !failed && <div className="img-placeholder" />}
        {!failed ? (
          <img
            src={source}
            alt={item.tags.slice(0, 4).join(', ') || item.providerLabel}
            loading="lazy"
            decoding="async"
            referrerPolicy={item.noReferrer ? 'no-referrer' : undefined}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (source !== item.preview) {
                setSource(item.preview)
              } else {
                setFailed(true)
              }
            }}
          />
        ) : (
          <div className="img-failed">Vista previa no disponible</div>
        )}

        <div className="img-overlay">
          <div className="img-tags">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag}>{tag.replace(/_/g, ' ')}</span>
            ))}
          </div>
          <span className="img-size">
            {item.width > 0 && item.height > 0 ? `${item.width} × ${item.height}` : '—'}
          </span>
        </div>

        <div className="img-actions">
          <button
            type="button"
            className="img-action"
            aria-label="Descargar imagen"
            onClick={(event) => {
              event.stopPropagation()
              onDownload(item)
            }}
          >
            <Download size={16} />
          </button>
          <a
            className="img-action"
            href={item.pageUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir página original"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink size={15} />
          </a>
        </div>

        {item.rating !== 'safe' && <span className="img-nsfw">18+</span>}
      </div>
    </article>
  )
}
