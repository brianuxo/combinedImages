import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { AlertTriangle, ArrowLeft, KeyRound, Loader2, Lock, Search, X } from 'lucide-react'
import { useSettings } from '../../context/settings'
import { useToast } from '../../context/toast'
import { PROVIDER_MAP } from '../../data/providers'
import { useInfiniteImages } from '../../hooks/useInfiniteImages'
import { downloadImage } from '../../lib/download'
import { readableError } from '../../lib/format'
import { HttpError } from '../../lib/http'
import type { ImageItem, ProviderId } from '../../types'
import { ProviderIcon } from '../ui/ProviderIcon'
import { ImageCard } from './ImageCard'
import { Lightbox } from './Lightbox'

export function Gallery({
  provider,
  onBack,
  onOpenSettings,
}: {
  provider: ProviderId
  onBack: () => void
  onOpenSettings: () => void
}) {
  const meta = PROVIDER_MAP[provider]
  const { settings } = useSettings()
  const { push } = useToast()

  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const { items, loading, error, hasMore, loadMore, retry } = useInfiniteImages(
    provider,
    query,
  )
  const sentinelRef = useRef<HTMLDivElement>(null)

  const isLocal =
    import.meta.env.DEV ||
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  const proxyMissing =
    (meta.needsProxy || meta.needsMediaProxy) && !isLocal && !settings.proxyUrl.trim()

  const providerSettings = settings.providers[provider]
  const keyMissing =
    !providerSettings?.apiKey?.trim() ||
    Boolean(meta.needsUserId && !providerSettings?.userId?.trim())
  const authError =
    error?.name === 'AuthRequiredError' ||
    (error instanceof HttpError &&
      (error.status === 401 ||
        error.status === 403 ||
        (meta.keyMode === 'required' && error.status === 400)))

  // La galería se monta con `key={provider}` y las búsquedas limpian la
  // selección al aplicarse, así que no hace falta un efecto para reiniciarla.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '700px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore, hasMore, loading])

  const handleDownload = useCallback(
    async (item: ImageItem) => {
      const outcome = await downloadImage(item)
      if (outcome === 'saved') {
        push('Descarga iniciada', 'success')
      } else {
        push('Esta fuente no permite descarga directa.', 'warn', {
          label: 'Abrir original',
          href: item.full,
        })
      }
    },
    [push],
  )

  const applyQuery = (value: string) => {
    setQuery(value)
    setSelected(null)
    if (value !== query) {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })
    }
  }

  const handleTag = (tag: string) => {
    setInput(tag)
    setSelected(null)
    setQuery(tag)
  }

  const proxyError = error?.name === 'ProxyRequiredError'

  return (
    <div className="gallery">
      <header className="gallery-head">
        <div className="gallery-title">
          <button type="button" className="icon-btn ghost" aria-label="Volver" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <span
            className="gallery-badge"
            style={
              {
                '--pa': meta.accent[0],
                '--pb': meta.accent[1],
              } as React.CSSProperties
            }
          >
            <ProviderIcon name={meta.icon} size={20} />
          </span>
          <div className="gallery-names">
            <h1>{meta.name}</h1>
            <p>{meta.tagline}</p>
          </div>
        </div>

        <form
          className="searchbar"
          onSubmit={(event) => {
            event.preventDefault()
            applyQuery(input.trim())
          }}
        >
          <Search size={17} />
          <input
            value={input}
            aria-label="Buscar imágenes"
            placeholder={meta.placeholder}
            onChange={(event) => setInput(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {input && (
            <button
              type="button"
              className="search-clear"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setInput('')
                applyQuery('')
              }}
            >
              <X size={14} />
            </button>
          )}
          <button type="submit" className="btn btn-primary search-submit">
            Buscar
          </button>
        </form>
      </header>

      <div className="gallery-meta">
        {meta.categories.map((category) => (
          <span className="meta-chip" key={category}>
            {category}
          </span>
        ))}
        <span className="meta-chip meta-chip-dim">{meta.license}</span>
        {settings.nsfw.enabled && meta.supportsNsfw && (
          <span className="meta-chip is-warn">NSFW activo</span>
        )}
        {proxyMissing && (
          <button type="button" className="meta-chip is-warn meta-button" onClick={onOpenSettings}>
            <Lock size={11} />
            Requiere proxy
          </button>
        )}
      </div>

      {proxyMissing && (
        <button type="button" className="inline-notice" onClick={onOpenSettings}>
          <Lock size={15} />
          <span>
            {meta.needsProxy
              ? 'Esta fuente no permite peticiones directas desde el navegador.'
              : 'Las imágenes de esta fuente bloquean el hotlink.'}{' '}
            Configura un proxy CORS en Ajustes → Red.
          </span>
        </button>
      )}

      {items.length === 0 && loading && (
        <div className="masonry" aria-busy="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <div className="skeleton" key={index} />
          ))}
        </div>
      )}

      {items.length === 0 && !loading && authError && (
        <div className="state-panel">
          <span className="state-icon">
            <KeyRound size={22} />
          </span>
          <h2>{keyMissing ? 'Falta la clave API' : 'La clave API no es válida'}</h2>
          <p>
            {keyMissing
              ? `Añade la API key${meta.needsUserId ? ' y el User ID' : ''} de ${
                  meta.name
                } en Ajustes → Claves API.`
              : `Revisa la API key${meta.needsUserId ? ' y el User ID' : ''} de ${
                  meta.name
                } en Ajustes → Claves API.`}
          </p>
          <div className="state-actions">
            <button type="button" className="btn btn-primary" onClick={onOpenSettings}>
              <KeyRound size={15} />
              Abrir ajustes
            </button>
            <button type="button" className="btn btn-ghost" onClick={retry}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !loading && error && !authError && (
        <div className="state-panel">
          <span className="state-icon">
            {proxyError ? <Lock size={22} /> : <AlertTriangle size={22} />}
          </span>
          <h2>{proxyError ? 'Esta fuente necesita un proxy' : 'No se pudo cargar la fuente'}</h2>
          <p>
            {proxyError
              ? 'Esta API no envía cabeceras CORS. En desarrollo funciona con el proxy de Vite; para producción configura un proxy en Ajustes → Red.'
              : readableError(error)}
          </p>
          <div className="state-actions">
            {proxyError && (
              <button type="button" className="btn btn-primary" onClick={onOpenSettings}>
                <Lock size={15} />
                Configurar proxy
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={retry}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !loading && !error && (
        <div className="state-panel">
          <span className="state-icon">
            <Search size={22} />
          </span>
          <h2>Sin resultados</h2>
          <p>
            {query
              ? `No encontramos nada para “${query}”. Prueba con otros tags.`
              : 'Esta fuente no devolvió imágenes. Prueba a buscar algo.'}
          </p>
          {query && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setInput('')
                applyQuery('')
              }}
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="masonry">
            {items.map((item, index) => (
              <ImageCard
                key={item.key}
                item={item}
                onOpen={() => setSelected(index)}
                onDownload={handleDownload}
              />
            ))}
          </div>

          {error && (
            <div className="inline-error">
              <span>{readableError(error)}</span>
              <button type="button" className="btn btn-ghost" onClick={retry}>
                Reintentar
              </button>
            </div>
          )}

          <div ref={sentinelRef} className="sentinel" />

          {loading && (
            <div className="load-more">
              <Loader2 size={18} className="spin" />
              Cargando más…
            </div>
          )}

          {!loading && !hasMore && (
            <div className="end-note">Eso es todo por ahora · {items.length} imágenes</div>
          )}
        </>
      )}

      <AnimatePresence>
        {selected !== null && items[selected] && (
          <Lightbox
            key="lightbox"
            items={items}
            index={selected}
            onClose={() => setSelected(null)}
            onNavigate={setSelected}
            onTag={handleTag}
            onDownload={handleDownload}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
