import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Gauge, Palette, SlidersHorizontal, X } from 'lucide-react'
import { useSettings } from '../../context/settings'
import { QualityPanel } from '../settings/QualityPanel'
import { SettingsPanel } from '../settings/SettingsPanel'
import { ThemePanel } from '../settings/ThemePanel'

export type DrawerTab = 'settings' | 'theme' | 'quality'

const TABS: { id: DrawerTab; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal },
  { id: 'theme', label: 'Tema', icon: Palette },
  { id: 'quality', label: 'Calidad', icon: Gauge },
]

export function RightDrawer({
  open,
  tab,
  onTab,
  onClose,
}: {
  open: boolean
  tab: DrawerTab
  onTab: (tab: DrawerTab) => void
  onClose: () => void
}) {
  const { settings } = useSettings()
  const reduced = settings.quality === 'optimo'
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Panel de personalización"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={
              reduced
                ? { duration: 0.2, ease: 'easeOut' }
                : { type: 'spring', stiffness: 320, damping: 34 }
            }
          >
            <header className="drawer-head">
              <div>
                <span className="drawer-eyebrow">Panel</span>
                <h2>Personaliza tu flujo</h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="icon-btn"
                aria-label="Cerrar panel"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </header>

            <nav className="drawer-tabs" role="tablist" aria-label="Secciones del panel">
              {TABS.map((item) => {
                const Icon = item.icon
                const active = tab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`drawer-tab ${active ? 'is-active' : ''}`}
                    onClick={() => onTab(item.id)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                    {active && (
                      <motion.span
                        layoutId="drawer-tab-bg"
                        className="drawer-tab-bg"
                        transition={
                          reduced
                            ? { duration: 0.15 }
                            : { type: 'spring', stiffness: 420, damping: 34 }
                        }
                      />
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="drawer-body">
              {tab === 'settings' && <SettingsPanel />}
              {tab === 'theme' && <ThemePanel />}
              {tab === 'quality' && <QualityPanel />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
