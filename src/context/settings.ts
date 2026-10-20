import { createContext, useContext } from 'react'
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

export function defaultProviders(): Record<ProviderId, ProviderSettings> {
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

export interface SettingsApi {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  updateProvider: (id: ProviderId, patch: Partial<ProviderSettings>) => void
  /** Muestra los controles de contenido adulto (atajo F). */
  unlockNsfw: () => void
  /** Activa o desactiva el contenido adulto. */
  enableNsfw: (enabled: boolean) => void
  nsfwNoticeOpen: boolean
  closeNsfwNotice: () => void
  reset: () => void
}

export const SettingsContext = createContext<SettingsApi | null>(null)

export function useSettings(): SettingsApi {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings debe usarse dentro de SettingsProvider')
  return context
}
