import { useRef } from 'react'
import { Aperture, Heart, MonitorDown, SlidersHorizontal } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import type { ProviderId } from '../../types'
import { ProviderStrip } from './ProviderStrip'

export function TopBar({
  active,
  favoritesActive,
  favoritesCount,
  onSelect,
  onHome,
  onFavorites,
  onOpenDrawer,
  onToggleNsfw,
}: {
  active: ProviderId | null
  favoritesActive: boolean
  favoritesCount: number
  onSelect: (id: ProviderId) => void
  onHome: () => void
  onFavorites: () => void
  onOpenDrawer: () => void
  onToggleNsfw: () => void
}) {
  const timerRef = useRef<number | null>(null)
  const { canInstall, install } = useInstallPrompt()

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

        {canInstall && (
          <button
            type="button"
            className="icon-btn install-btn"
            aria-label="Instalar la app"
            title="Instalar la app"
            onClick={() => void install()}
          >
            <MonitorDown size={18} />
          </button>
        )}

        <button
          type="button"
          className={`icon-btn fav-btn ${favoritesActive ? 'is-active' : ''}`}
          aria-label={
            favoritesCount > 0
              ? `Favoritos (${favoritesCount} guardadas)`
              : 'Favoritos'
          }
          aria-current={favoritesActive ? 'page' : undefined}
          title="Favoritos"
          onClick={onFavorites}
        >
          <Heart size={18} fill={favoritesActive ? 'currentColor' : 'none'} />
          {favoritesCount > 0 && (
            <span className="count-badge">{favoritesCount > 99 ? '99+' : favoritesCount}</span>
          )}
        </button>

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
