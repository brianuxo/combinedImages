export type ProviderId =
  | 'danbooru'
  | 'safebooru'
  | 'konachan'
  | 'yandere'
  | 'anime-pictures'
  | 'gelbooru'
  | 'rule34'
  | 'wallhaven'
  | 'openverse'
  | 'wikimedia'
  | 'pixabay'

export type Quality = 'max' | 'general' | 'optimo'
export type ThemeId = 'dark' | 'midnight' | 'contrast'
export type Rating = 'safe' | 'questionable' | 'explicit'
export type SearchMode = 'tags' | 'query'

export type ProviderIcon =
  | 'sparkles'
  | 'shield'
  | 'image'
  | 'layers'
  | 'monitor'
  | 'flame'
  | 'alert'
  | 'wallpaper'
  | 'globe'
  | 'landmark'
  | 'camera'

export interface ProviderMeta {
  id: ProviderId
  name: string
  tagline: string
  description: string
  categories: string[]
  mode: SearchMode
  accent: [string, string]
  icon: ProviderIcon
  /** La API no permite peticiones desde el navegador sin proxy. */
  needsProxy: boolean
  /** Las imágenes necesitan proxy aunque la API sí permita CORS. */
  needsMediaProxy?: boolean
  supportsNsfw: boolean
  /** Solo se muestra cuando el contenido NSFW está activado. */
  nsfwOnly?: boolean
  /** La clave es obligatoria, opcional o no se usa. */
  keyMode?: 'optional' | 'required'
  /** Gelbooru y Rule34 piden también el ID de usuario. */
  needsUserId?: boolean
  experimental?: boolean
  license: string
  defaultQuery: string
  placeholder: string
}

export interface ImageItem {
  key: string
  id: string
  provider: ProviderId
  providerLabel: string
  thumb: string
  preview: string
  full: string
  width: number
  height: number
  tags: string[]
  title?: string
  author?: string
  license?: string
  pageUrl: string
  sourceUrl?: string
  rating: Rating
  ext?: string
  /** El CDN bloquea peticiones con referer (Wallhaven). */
  noReferrer?: boolean
}

export interface ProviderSettings {
  hidden: boolean
  apiKey?: string
  userId?: string
}

export interface Settings {
  theme: ThemeId
  accent: string
  quality: Quality
  blacklist: { tags: string[]; keywords: string[] }
  providers: Record<ProviderId, ProviderSettings>
  proxyUrl: string
  nsfw: { unlocked: boolean; enabled: boolean }
}

export interface SearchArgs {
  query: string
  page: number
  perPage: number
  quality: Quality
  nsfw: boolean
  blacklist: { tags: string[]; keywords: string[] }
  apiKey?: string
  userId?: string
  proxyUrl: string
  signal: AbortSignal
}

export interface SearchResponse {
  items: ImageItem[]
  hasMore: boolean
}
