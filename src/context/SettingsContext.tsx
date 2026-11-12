import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  SettingsContext,
  defaultProviders,
  type SettingsApi,
} from './settings'
import { PROVIDER_IDS } from '../data/providers'
import type { ProviderId, ProviderSettings, Settings } from '../types'
import { pullSettings, pushSettings, checkServer } from '../lib/dataApi'

const STORAGE_KEY = 'combined.settings.v1'
const PUSH_DELAY = 800

const THEME_COLOR = {
  dark: '#07080b',
  midnight: '#04060d',
  contrast: '#000000',
} as const

function initialQuality(): Settings['quality'] {
  try {
    // En el móvil, Óptimo es el punto de partida: 12 tarjetas, sin
    // animaciones y con las siguientes a un toque.
    return window.matchMedia('(max-width: 720px)').matches ? 'optimo' : DEFAULT_SETTINGS.quality
  } catch {
    return DEFAULT_SETTINGS.quality
  }
}

function loadSettingsLocal(): Settings {
  const base: Settings = { ...DEFAULT_SETTINGS, quality: initialQuality() }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<Settings>
    const providers = defaultProviders()

    for (const id of PROVIDER_IDS) {
      providers[id] = { hidden: false, ...(parsed.providers?.[id] ?? {}) }
    }

    const nsfw = { ...DEFAULT_SETTINGS.nsfw, ...(parsed.nsfw ?? {}) }
    if (!nsfw.unlocked) nsfw.enabled = false

    return {
      ...base,
      ...parsed,
      blacklist: { ...DEFAULT_SETTINGS.blacklist, ...(parsed.blacklist ?? {}) },
      nsfw,
      providers,
    }
  } catch {
    return base
  }
}

function mergeServerSettings(serverData: unknown): Settings | null {
  if (!serverData || typeof serverData !== 'object') return null
  const parsed = serverData as Partial<Settings>
  const base: Settings = { ...DEFAULT_SETTINGS, quality: initialQuality() }
  const providers = defaultProviders()

  for (const id of PROVIDER_IDS) {
    providers[id] = { hidden: false, ...(parsed.providers?.[id] ?? {}) }
  }

  const nsfw = { ...DEFAULT_SETTINGS.nsfw, ...(parsed.nsfw ?? {}) }
  if (!nsfw.unlocked) nsfw.enabled = false

  return {
    ...base,
    ...parsed,
    blacklist: { ...DEFAULT_SETTINGS.blacklist, ...(parsed.blacklist ?? {}) },
    nsfw,
    providers,
  }
}

function accentForeground(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return '#090a0f'
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#090a0f' : '#ffffff'
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettingsLocal)
  const [nsfwNoticeOpen, setNsfwNoticeOpen] = useState(false)
  const [serverAvailable, setServerAvailable] = useState(false)
  const checkedRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const pushingRef = useRef(false)

  // Verificar si el servidor está disponible al montar
  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true

    checkServer().then((available) => {
      setServerAvailable(available)
      if (available) {
        pullSettings()
          .then((data) => {
            const merged = mergeServerSettings(data)
            if (merged) {
              setSettings(merged)
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
              } catch { /* ignorar */ }
            }
          })
          .catch(() => {
            setServerAvailable(false)
          })
      }
    }).catch(() => {
      setServerAvailable(false)
    })
  }, [])

  // Guardar en localStorage como respaldo siempre
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // El almacenamiento puede estar lleno o bloqueado; la app sigue funcionando.
    }
  }, [settings])

  // Subir al servidor con debounce cuando hay cambios
  useEffect(() => {
    if (!serverAvailable || pushingRef.current) return

    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      pushingRef.current = true
      pushSettings(settings)
        .then(() => {
          pushingRef.current = false
        })
        .catch(() => {
          pushingRef.current = false
        })
    }, PUSH_DELAY)
  }, [settings, serverAvailable])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.quality = settings.quality
    root.style.setProperty('--accent', settings.accent)
    root.style.setProperty('--accent-fg', accentForeground(settings.accent))
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[settings.theme])
  }, [settings.theme, settings.quality, settings.accent])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch }
      if (!next.nsfw.unlocked) next.nsfw = { ...next.nsfw, enabled: false }
      return next
    })
  }, [])

  const updateProvider = useCallback((id: ProviderId, patch: Partial<ProviderSettings>) => {
    setSettings((previous) => ({
      ...previous,
      providers: {
        ...previous.providers,
        [id]: { ...previous.providers[id], ...patch },
      },
    }))
  }, [])

  const unlockNsfw = useCallback(() => {
    setSettings((previous) => ({
      ...previous,
      nsfw: { ...previous.nsfw, unlocked: true },
    }))
  }, [])

  // Ocultar la sección de contenido adulto la deja como estaba: sin Adulto
  // desbloqueado y con el modo adulto desactivado.
  const lockNsfw = useCallback(() => {
    setSettings((previous) => ({
      ...previous,
      nsfw: { ...previous.nsfw, unlocked: false, enabled: false },
    }))
    setNsfwNoticeOpen(false)
  }, [])

  const enableNsfw = useCallback(
    (enabled: boolean) => {
      setSettings((previous) => ({
        ...previous,
        nsfw: { ...previous.nsfw, unlocked: true, enabled },
      }))
      // El aviso de contenido adulto se muestra solo la primera vez.
      if (enabled && !settings.nsfw.acknowledged) setNsfwNoticeOpen(true)
    },
    [settings.nsfw.acknowledged],
  )

  const closeNsfwNotice = useCallback(() => {
    setNsfwNoticeOpen(false)
    setSettings((previous) => ({
      ...previous,
      nsfw: { ...previous.nsfw, acknowledged: true },
    }))
  }, [])

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    setNsfwNoticeOpen(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignorar.
    }
  }, [])

  const value = useMemo<SettingsApi>(
    () => ({
      settings,
      update,
      updateProvider,
      unlockNsfw,
      lockNsfw,
      enableNsfw,
      nsfwNoticeOpen,
      closeNsfwNotice,
      reset,
    }),
    [
      settings,
      update,
      updateProvider,
      unlockNsfw,
      lockNsfw,
      enableNsfw,
      nsfwNoticeOpen,
      closeNsfwNotice,
      reset,
    ],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
