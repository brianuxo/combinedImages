import { useEffect, useRef } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { PROVIDERS } from '../../data/providers'
import { isProviderVisible } from '../../lib/visibility'
import type { ProviderId } from '../../types'
import { ProviderIcon } from '../ui/ProviderIcon'

export function ProviderStrip({
  active,
  onSelect,
}: {
  active: ProviderId | null
  onSelect: (id: ProviderId) => void
}) {
  const { settings } = useSettings()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ down: false, startX: 0, startScroll: 0, moved: false })

  const visible = PROVIDERS.filter((provider) => isProviderVisible(provider, settings))

  useEffect(() => {
    if (!active) return
    const element = scrollerRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)
    element?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [active, visible.length])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    const scroller = scrollerRef.current
    if (!scroller) return
    dragRef.current = {
      down: true,
      startX: event.clientX,
      startScroll: scroller.scrollLeft,
      moved: false,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.down) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const delta = event.clientX - dragRef.current.startX
    if (Math.abs(delta) > 4) dragRef.current.moved = true
    scroller.scrollLeft = dragRef.current.startScroll - delta
  }

  const endDrag = () => {
    dragRef.current.down = false
  }

  return (
    <div className="strip-wrap">
      <div
        ref={scrollerRef}
        className="strip"
        role="tablist"
        aria-label="Fuentes de imágenes"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {visible.map((provider) => (
          <button
            key={provider.id}
            type="button"
            role="tab"
            aria-selected={active === provider.id}
            data-id={provider.id}
            className={`pill ${active === provider.id ? 'is-active' : ''}`}
            onClick={() => {
              if (dragRef.current.moved) {
                dragRef.current.moved = false
                return
              }
              onSelect(provider.id)
            }}
          >
            <ProviderIcon name={provider.icon} size={15} />
            <span>{provider.name}</span>
            {(provider.needsProxy || provider.needsMediaProxy) && (
              <i className="pill-dot" title="Requiere proxy en producción" />
            )}
          </button>
        ))}
        {visible.length === 0 && <span className="strip-empty">Sin fuentes visibles</span>}
      </div>
    </div>
  )
}
