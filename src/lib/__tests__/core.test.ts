import { describe, expect, it } from 'vitest'
import { isBlacklisted, toBooruExclusions } from '../blacklist'
import { readableError } from '../format'
import { safeFilename } from '../download'
import { AuthRequiredError, HttpError, ProxyRequiredError } from '../http'
import { isProviderInSettings, isProviderVisible } from '../visibility'
import { PROVIDERS } from '../../data/providers'
import type { ImageItem, Settings } from '../../types'

const blacklist = { tags: ['guro'], keywords: ['lowres'] }

function item(overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    key: 'x:1',
    id: '1',
    provider: 'danbooru',
    providerLabel: 'Danbooru',
    thumb: '',
    preview: '',
    full: 'https://example.com/image.jpg',
    width: 100,
    height: 100,
    tags: ['1girl', 'guro'],
    pageUrl: 'https://example.com/post/1',
    rating: 'safe',
    ...overrides,
  }
}

describe('lista negra', () => {
  it('detecta tags exactos sin distinguir mayúsculas', () => {
    expect(isBlacklisted(item(), blacklist)).toBe(true)
    expect(isBlacklisted(item({ tags: ['1girl'] }), blacklist)).toBe(false)
  })

  it('detecta prefijos de tag como artist:algo', () => {
    expect(
      isBlacklisted(item({ tags: ['artist:someone'] }), { tags: ['artist'], keywords: [] }),
    ).toBe(true)
  })

  it('filtra por palabras clave en título y autor', () => {
    expect(isBlacklisted(item({ title: 'lowres wallpaper' }), blacklist)).toBe(true)
    expect(isBlacklisted(item({ author: 'lowres_master' }), blacklist)).toBe(true)
  })

  it('convierte los tags excluidos en -tag', () => {
    expect(toBooruExclusions(['Guro', 'watermark space'])).toEqual(['-guro', '-watermark_space'])
  })
})

describe('visibilidad de fuentes', () => {
  const settings = {
    nsfw: { unlocked: true, enabled: false },
    providers: {},
  } as unknown as Settings

  it('oculta las fuentes marcadas por el usuario', () => {
    const provider = PROVIDERS.find((p) => p.id === 'danbooru')!
    const hidden = {
      ...settings,
      providers: { danbooru: { hidden: true } },
    } as unknown as Settings
    expect(isProviderVisible(provider, hidden)).toBe(false)
  })

  it('oculta las fuentes solo adultas mientras NSFW está apagado', () => {
    const gelbooru = PROVIDERS.find((p) => p.id === 'gelbooru')!
    const rule34 = PROVIDERS.find((p) => p.id === 'rule34')!
    expect(isProviderVisible(gelbooru, settings)).toBe(false)
    expect(isProviderVisible(rule34, settings)).toBe(false)
    expect(isProviderInSettings(gelbooru, settings)).toBe(false)
  })

  it('muestra las fuentes solo adultas cuando NSFW está activo', () => {
    const gelbooru = PROVIDERS.find((p) => p.id === 'gelbooru')!
    const enabled = {
      ...settings,
      nsfw: { unlocked: true, enabled: true },
    } as unknown as Settings
    expect(isProviderVisible(gelbooru, enabled)).toBe(true)
    expect(isProviderInSettings(gelbooru, enabled)).toBe(true)
  })
})

describe('nombres de archivo', () => {
  it('usa la extensión de la API y normaliza el slug', () => {
    const name = safeFilename(item({ tags: ['1girl', 'cute'], ext: 'png' }))
    expect(name).toBe('danbooru-1-1girl.png')
  })

  it('deduce la extensión de la URL si la API no la da', () => {
    const name = safeFilename(
      item({ tags: [], full: 'https://example.com/photo.webp?v=2' }),
    )
    expect(name.endsWith('.webp')).toBe(true)
  })

  it('quita acentos y caracteres raros', () => {
    const name = safeFilename(item({ tags: ['corazón', 'niño!'] }))
    expect(name).toBe('danbooru-1-corazon.jpg')
  })
})

describe('mensajes de error', () => {
  it('explica los errores de clave y de proxy', () => {
    expect(readableError(new AuthRequiredError('gelbooru'))).toContain('clave API')
    expect(readableError(new ProxyRequiredError())).toContain('navegador')
    expect(readableError(new HttpError(401))).toContain('clave API')
    expect(readableError(new HttpError(429))).toContain('Demasiadas')
  })
})
