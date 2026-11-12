import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  KeyRound,
  Loader2,
  Lock,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { useSettings } from '../../context/settings'
import { useToast } from '../../context/toast'
import { PROVIDER_MAP } from '../../data/providers'
import { useInfiniteImages } from '../../hooks/useInfiniteImages'
import { useMasonry } from '../../hooks/useMasonry'
import { downloadImage } from '../../lib/download'
import { hasServerProxy } from '../../lib/env'
import { QUALITY_LIMITS, readableError } from '../../lib/format'
import { HttpError } from '../../lib/http'
import { distributeByColumn, imageRatio, type MasonryItem } from '../../lib/masonry'
import { authorQuery, rememberTags } from '../../lib/suggestions'
import type { ImageItem, ProviderId } from '../../types'
import { useTagSuggest } from '../../hooks/useTagSuggest'
import { ProviderIcon } from '../ui/ProviderIcon'
import { SuggestList } from '../ui/TagSuggest'
import { ImageCard } from './ImageCard'
import { Lightbox } from './Lightbox'

/** Margen que se adelanta al final para empezar a cargar antes de llegar abajo. */
const PREFETCH_MARGIN = 700
/** En Óptimo se pide con menos antelación: menos páginas y menos datos. */
const PREFETCH_MARGIN_OPTIMO = 400

/** Proporciones variadas para que el esqueleto imite la galería real. */
const SKELETON_RATIOS = [3 / 4, 4 / 5, 1 / 1, 16 / 10]

const SKELETON_ITEMS: MasonryItem[] = Array.from({ length: 12 }, (_, index) => {
  const ratio = SKELETON_RATIOS[index % SKELETON_RATIOS.length]
  return { key: `skeleton-${index}`, width: Math.round(ratio * 1000), height: 1000 }
})

export function Gallery({
  provider,
  initialQuery,
  initialAuthor,
  onBack,
  onOpenSettings,
}: {
  provider: ProviderId
  /** Búsqueda con la que se abre (por ejemplo, al pulsar el autor de una imagen). */
  initialQuery?: string
  /** Autor del que viene la búsqueda, si viene de una imagen. */
  initialAuthor?: string
  onBack: () => void
  onOpenSettings: () => void
}) {
  const meta = PROVIDER_MAP[provider]
  const { settings } = useSettings()
  const { push } = useToast()

  const [input, setInput] = useState(initialQuery ?? '')
  const [query, setQuery] = useState(initialQuery ?? '')
  // Autor del que viene la búsqueda, para poder quitar ese filtro de un clic.
  const [authorFilter, setAuthorFilter] = useState<string | null>(initialAuthor ?? null)
  const [selected, setSelected] = useState<number | null>(null)
  const limits = QUALITY_LIMITS[settings.quality]
  const prefetchMargin =
    settings.quality === 'optimo' ? PREFETCH_MARGIN_OPTIMO : PREFETCH_MARGIN
  const { items, loading, error, hasMore, atCap, loadMore, showMore, retry } =
    useInfiniteImages(provider, query)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { ref: masonryRef, columns, metrics } = useMasonry(items)
  const hasItems = items.length > 0

  // Índice de cada imagen en la lista plana, para abrir el lightbox sin
  // buscar la posición a mano dentro de las columnas.
  const indexByKey = useMemo(
    () => new Map(items.map((item, index) => [item.key, index])),
    [items],
  )

  const skeletonColumns = useMemo(
    () => distributeByColumn(SKELETON_ITEMS.slice(0, limits.skeletons), metrics),
    [limits.skeletons, metrics],
  )

  // Las sugerencias del buscador aprenden de los tags que se van viendo.
  // Solo se recuerdan las imágenes nuevas, para no sumar los mismos tags en
  // cada render.
  const remembered = useRef(new Set<string>())
  useEffect(() => {
    const fresh = items.filter((item) => !remembered.current.has(item.key))
    if (fresh.length === 0) return
    for (const item of fresh) remembered.current.add(item.key)
    rememberTags(fresh.flatMap((item) => item.tags))
  }, [items])

  const proxyMissing =
    (meta.needsProxy || meta.needsMediaProxy) &&
    !hasServerProxy() &&
    !settings.proxyUrl.trim()

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
  //
  // El scroll infinito se comprueba en el evento de scroll en vez de con un
  // IntersectionObserver: recrear el observador en cada cambio de estado
  // disparaba una carga extra en cascada (dos páginas por cada scroll).
  useEffect(() => {
    if (!hasItems || atCap) return

    const check = () => {
      const node = sentinelRef.current
      if (!node) return
      if (node.getBoundingClientRect().top < window.innerHeight + prefetchMargin) {
        loadMore()
      }
    }

    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [atCap, hasItems, loadMore, prefetchMargin])

  const handleDownload = useCallback(
    async (item: ImageItem) => {
      const outcome = await downloadImage(item, { proxyUrl: settings.proxyUrl })
      if (outcome === 'saved') {
        push('Descarga iniciada', 'success')
      } else {
        push(
          settings.proxyUrl.trim()
            ? 'No se pudo descargar la imagen.'
            : 'Esta fuente no permite descarga directa. Configura un proxy en Ajustes → Red.',
          'warn',
          {
            label: 'Abrir original',
            href: item.full,
          },
        )
      }
    },
    [push, settings.proxyUrl],
  )

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }

  const applyQuery = (value: string) => {
    setQuery(value)
    setSelected(null)
    setAuthorFilter(null)
    if (value !== query) scrollToTop()
  }

  const handleTag = (tag: string) => {
    setInput(tag)
    setSelected(null)
    setAuthorFilter(null)
    setQuery(tag)
  }

  // En los booru el autor es un tag, así que se busca tal cual y queda marcado
  // como filtro activo para poder quitarlo de un clic.
  const handleAuthor = (author: string) => {
    const value = authorQuery(author, provider)
    setAuthorFilter(author)
    setInput(value)
    setSelected(null)
    setQuery(value)
    scrollToTop()
  }

  const clearAuthor = () => {
    setAuthorFilter(null)
    setInput('')
    setSelected(null)
    setQuery('')
    scrollToTop()
  }

  const suggest = useTagSuggest({
    value: input,
    provider,
    onPick: (completed) => {
      setInput(completed)
      applyQuery(completed)
    },
  })

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

        <div className="search-wrap">
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
              role="combobox"
              aria-expanded={suggest.open}
              aria-controls={suggest.listId}
              aria-autocomplete="list"
              aria-activedescendant={
                suggest.open ? suggest.optionId(suggest.active) : undefined
              }
              onChange={(event) => setInput(event.target.value)}
              onFocus={suggest.onFocus}
              onBlur={suggest.onBlur}
              onKeyDown={suggest.onKeyDown}
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

          {suggest.open && (
            <SuggestList
              id={suggest.listId}
              items={suggest.items}
              active={suggest.active}
              fragment={suggest.fragment}
              onPick={suggest.pick}
              onHover={suggest.hover}
              label="Sugerencias de búsqueda"
            />
          )}
        </div>
      </header>

      <div className="gallery-meta">
        {authorFilter && (
          <button
            type="button"
            className="meta-chip meta-chip-accent meta-button"
            onClick={clearAuthor}
            title="Quitar el filtro de autor"
          >
            <UserRound size={11} />
            Autor: {authorFilter}
            <X size={11} />
          </button>
        )}
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
        <div className="masonry" ref={masonryRef} style={{ gap: metrics.gap }} aria-busy="true">
          {skeletonColumns.map((column, columnIndex) => (
            <div className="masonry-col" key={columnIndex} style={{ gap: metrics.gap }}>
              {column.map((item) => (
                <div
                  className="skeleton"
                  key={item.key}
                  style={{ aspectRatio: String(imageRatio(item)) }}
                />
              ))}
            </div>
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
          <div className="masonry" ref={masonryRef} style={{ gap: metrics.gap }}>
            {columns.map((column, columnIndex) => (
              <div className="masonry-col" key={columnIndex} style={{ gap: metrics.gap }}>
                {column.map((item) => (
                  <ImageCard
                    key={item.key}
                    item={item}
                    proxyUrl={settings.proxyUrl}
                    onOpen={() => {
                      const index = indexByKey.get(item.key)
                      if (index !== undefined) setSelected(index)
                    }}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
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

          {atCap && !loading && (
            <button type="button" className="load-more-btn" onClick={showMore}>
              <ChevronDown size={16} />
              Ver {limits.step} más
            </button>
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
            proxyUrl={settings.proxyUrl}
            onClose={() => setSelected(null)}
            onNavigate={setSelected}
            onTag={handleTag}
            onAuthor={handleAuthor}
            onDownload={handleDownload}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
