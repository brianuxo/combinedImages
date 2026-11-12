import { useMemo, useState } from 'react'
import { Download, ExternalLink, Heart } from 'lucide-react'
import { useFavorites } from '../../context/favorites'
import { displayUrls } from '../../lib/media'
import { imageRatio, isExtremeRatio } from '../../lib/masonry'
import type { ImageItem } from '../../types'

export function ImageCard({
  item,
  onOpen,
  onDownload,
  proxyUrl,
}: {
  item: ImageItem
  onOpen: () => void
  onDownload: (item: ImageItem) => void
  proxyUrl?: string
}) {
  // La galería monta cada tarjeta con `key={item.key}`, así que el estado
  // se reinicia solo al cambiar de imagen.
  //
  // Mostrar no exige leer el binario: el `<img>` pide la imagen al CDN
  // directamente (rápido, sin pasar por el servidor de la app) y con
  // `referrerPolicy="no-referrer"` los CDNs que odian el referer ajeno la
  // sirven igualmente. Si el CDN la bloquea, el siguiente candidato la trae
  // por el proxy del servidor y la tarjeta no se queda rota.
  const candidates = useMemo(
    () => displayUrls(item.provider, item, proxyUrl),
    [item, proxyUrl],
  )

  const [index, setIndex] = useState(0)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const source = candidates[index] ?? ''
  const loaded = loadedUrl === source
  const failed = index >= candidates.length

  const favorites = useFavorites()
  const saved = favorites.has(item.key)

  // La proporción la calcula `imageRatio`, la misma función que usa el
  // masonry para estimar el alto de la columna. Si divergen, las columnas
  // quedan descuadradas.
  const ratio = imageRatio(item)
  // Los panoramas y las tiras verticales se recortarían en exceso: se muestran
  // completos sobre el fondo de la tarjeta.
  const contain = isExtremeRatio(item)

  return (
    <article className="img-card" onClick={onOpen}>
      <div
        className={`img-wrap${contain ? ' is-contain' : ''}`}
        style={{ aspectRatio: String(ratio) }}
      >
        {!loaded && !failed && <div className="img-placeholder" />}
        {!failed ? (
          <img
            src={source}
            alt={item.tags.slice(0, 4).join(', ') || item.providerLabel}
            loading="lazy"
            decoding="async"
            referrerPolicy={item.noReferrer ? 'no-referrer' : undefined}
            onLoad={() => setLoadedUrl(source)}
            onError={() => {
              // Se prueba la preview y, si tampoco carga, la original.
              console.warn('[imagen] no se pudo cargar', source)
              setIndex((current) => current + 1)
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
            className={`img-action ${saved ? 'is-fav' : ''}`}
            aria-label={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            aria-pressed={saved}
            title={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            onClick={(event) => {
              event.stopPropagation()
              favorites.toggle(item)
            }}
          >
            <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
          </button>
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
