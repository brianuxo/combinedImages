import type { ProviderMeta, Settings } from '../types'

/** Fuente visible en inicio y barra superior. */
export function isProviderVisible(provider: ProviderMeta, settings: Settings): boolean {
  if (settings.providers[provider.id]?.hidden) return false
  if (provider.nsfwOnly && !settings.nsfw.enabled) return false
  return true
}

/** Fuente que debe aparecer en el panel de ajustes (incluye las ocultas). */
export function isProviderInSettings(provider: ProviderMeta, settings: Settings): boolean {
  return !provider.nsfwOnly || settings.nsfw.enabled
}
