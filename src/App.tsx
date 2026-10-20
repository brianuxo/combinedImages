import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RightDrawer, type DrawerTab } from './components/layout/RightDrawer'
import { TopBar } from './components/layout/TopBar'
import { Gallery } from './components/gallery/Gallery'
import { Home } from './components/home/Home'
import { NsfwNotice } from './components/settings/NsfwNotice'
import { useSettings } from './context/settings'
import { useToast } from './context/toast'
import { PROVIDER_MAP } from './data/providers'
import { isProviderVisible } from './lib/visibility'
import type { ProviderId } from './types'

type View = { name: 'home' } | { name: 'gallery'; provider: ProviderId }

export default function App() {
  const { settings, unlockNsfw, lockNsfw, nsfwNoticeOpen, closeNsfwNotice } = useSettings()
  const { push } = useToast()
  const [view, setView] = useState<View>({ name: 'home' })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('settings')

  const duration = settings.quality === 'optimo' ? 0.16 : 0.3

  const openProvider = useCallback((provider: ProviderId) => {
    setView({ name: 'gallery', provider })
    window.scrollTo({ top: 0 })
  }, [])

  const goHome = useCallback(() => setView({ name: 'home' }), [])

  const openDrawer = useCallback((tab: DrawerTab = 'settings') => {
    setDrawerTab(tab)
    setDrawerOpen(true)
  }, [])

  // Atajo F (y pulsación larga en el logo): muestra u oculta los controles de
  // contenido adulto en Ajustes. Al ocultarlos, el modo adulto se desactiva.
  const toggleNsfw = useCallback(() => {
    if (settings.nsfw.unlocked) {
      lockNsfw()
      setDrawerOpen(false)
      push('Contenido adulto oculto', 'default')
      return
    }

    unlockNsfw()
    openDrawer('settings')
    push('Opciones de contenido adulto visibles. Actívalas con la casilla.', 'warn')
    window.setTimeout(() => {
      document.getElementById('nsfw-section')?.scrollIntoView({ block: 'center' })
    }, 320)
  }, [settings.nsfw.unlocked, unlockNsfw, lockNsfw, openDrawer, push])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() !== 'f') return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      event.preventDefault()
      toggleNsfw()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleNsfw])

  // Si la fuente abierta se oculta o deja de estar disponible, volvemos al inicio.
  // Ajustamos el estado durante el render para no provocar un segundo render en cascada.
  const provider = view.name === 'gallery' ? PROVIDER_MAP[view.provider] : null
  if (view.name === 'gallery' && (!provider || !isProviderVisible(provider, settings))) {
    setView({ name: 'home' })
  }

  return (
    <div className="app">
      <div className="bg-aurora" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />

      <TopBar
        active={view.name === 'gallery' ? view.provider : null}
        onSelect={openProvider}
        onHome={goHome}
        onToggleNsfw={toggleNsfw}
        onOpenDrawer={() => openDrawer('settings')}
      />

      <AnimatePresence mode="wait" initial={false}>
        {view.name === 'home' ? (
          <motion.main
            key="home"
            className="page"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
          >
            <Home onOpen={openProvider} />
          </motion.main>
        ) : (
          <motion.main
            key={view.provider}
            className="page"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
          >
            <Gallery
              provider={view.provider}
              onBack={goHome}
              onOpenSettings={() => openDrawer('settings')}
            />
          </motion.main>
        )}
      </AnimatePresence>

      <RightDrawer
        open={drawerOpen}
        tab={drawerTab}
        onTab={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
      />

      <NsfwNotice open={nsfwNoticeOpen} onClose={closeNsfwNotice} />
    </div>
  )
}
