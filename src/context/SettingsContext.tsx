import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { PROVIDER_IDS } from '../data/providers'
import type { ProviderId, ProviderSettings, Settings } from '../types'

export const ACCENTS = [
  { id: 'violet', label: 'Violeta', value: '#7c6cff' },
  { id: 'cyan', label: 'Cian', value: '#22d3ee' },
  { id: 'emerald', label: 'Esmeralda', value: '#34d399' },
  { id: 'amber', label: 'Ámbar', value: '#f59e0b' },
  { id: 'rose', label: 'Rosa', value: '#fb7185' },
  { id: 'blue', label: 'Azul', value: '#60a5fa' },
] as const

const STORAGE_KEY = 'combined.settings.v1'

const THEME_COLOR = {
  dark: '#07080b',
  midnight: '#04060d',
  contrast: '#000000',
} as const

function defaultProviders(): Record<ProviderId, ProviderSettings> {
  return PROVIDER_IDS.reduce(
    (accumulator, id) => {
      accumulator[id] = { hidden: false }
      return accumulator
    },
    {} as Record<ProviderId, ProviderSettings>,
  )
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: ACCENTS[0].value,
  quality: 'general',
  blacklist: { tags: [], keywords: [] },
  providers: defaultProviders(),
  proxyUrl: '',
  nsfw: { unlocked: false, enabled: false },
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    const providers = defaultProviders()

    for (const id of PROVIDER_IDS) {
      providers[id] = { hidden: false, ...(parsed.providers?.[id] ?? {}) }
    }

    const nsfw = { ...DEFAULT_SETTINGS.nsfw, ...(parsed.nsfw ?? {}) }
    if (!nsfw.unlocked) nsfw.enabled = false

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      blacklist: { ...DEFAULT_SETTINGS.blacklist, ...(parsed.blacklist ?? {}) },
      nsfw,
      providers,
    }
  } catch {
    return DEFAULT_SETTINGS
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

interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  updateProvider: (id: ProviderId, patch: Partial<ProviderSettings>) => void
  unlockNsfw: () => void
  reset: () => void
}

const SettingsContext = createContext<SettingsApi | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // El almacenamiento puede estar lleno o bloqueado; la app sigue funcionando.
    }
  }, [settings])

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
      nsfw: { unlocked: true, enabled: previous.nsfw.enabled },
    }))
  }, [])

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignorar.
    }
  }, [])

  const value = useMemo<SettingsApi>(
    () => ({ settings, update, updateProvider, unlockNsfw, reset }),
    [settings, update, updateProvider, unlockNsfw, reset],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsApi {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings debe usarse dentro de SettingsProvider')
  return context
}
