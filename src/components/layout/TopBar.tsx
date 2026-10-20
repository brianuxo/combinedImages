import { useRef } from 'react'
import { Aperture, SlidersHorizontal } from 'lucide-react'
import type { ProviderId } from '../../types'
import { ProviderStrip } from './ProviderStrip'

export function TopBar({
  active,
  onSelect,
  onHome,
  onOpenDrawer,
  onToggleNsfw,
}: {
  active: ProviderId | null
  onSelect: (id: ProviderId) => void
  onHome: () => void
  onOpenDrawer: () => void
  onToggleNsfw: () => void
}) {
  const timerRef = useRef<number | null>(null)

  const cancelPress = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const startPress = () => {
    cancelPress()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      onToggleNsfw()
    }, 1500)
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button
          type="button"
          className="brand"
          onClick={onHome}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          aria-label="Combined — inicio"
        >
          <span className="logo-mark">
            <Aperture size={17} strokeWidth={2} />
          </span>
          <span className="wordmark">
            combined<span className="dot">.</span>
          </span>
        </button>

        <ProviderStrip active={active} onSelect={onSelect} />

        <button
          type="button"
          className="icon-btn"
          aria-label="Abrir ajustes"
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
    </header>
  )
}
