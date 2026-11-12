import { describe, expect, it } from 'vitest'
import {
  FAVORITES_LIMIT,
  FAVORITES_STORAGE_KEY,
  addFavorite,
  parseFavorites,
  removeFavorite,
  toggleFavorite,
  type FavoriteItem,
} from '../favorites'
import type { ImageItem } from '../../types'

function image(id: string): ImageItem {
  return {
    key: `konachan:${id}`,
    id,
    provider: 'konachan',
    providerLabel: 'Konachan',
    thumb: 'https://konachan.com/data/preview/a.jpg',
    preview: 'https://konachan.com/sample/a.jpg',
    full: 'https://konachan.com/image/a.png',
    width: 1920,
    height: 1080,
    tags: ['wlop'],
    pageUrl: `https://konachan.com/post/show/${id}`,
    rating: 'safe',
    ext: 'png',
  }
}

describe('addFavorite', () => {
  it('guarda lo último primero', () => {
    const list = addFavorite(addFavorite([], image('1'), 100), image('2'), 200)

    expect(list.map((entry) => entry.id)).toEqual(['2', '1'])
    expect(list[0].savedAt).toBe(200)
  })

  it('no duplica: al volver a guardar sube al principio', () => {
    const list = addFavorite(addFavorite([], image('1'), 100), image('1'), 300)

    expect(list).toHaveLength(1)
    expect(list[0].savedAt).toBe(300)
  })

  it('respeta el tope de guardados', () => {
    const full: FavoriteItem[] = Array.from({ length: FAVORITES_LIMIT }, (_, index) => ({
      ...image(String(index)),
      savedAt: index,
    }))
    const list = addFavorite(full, image('nueva'))

    expect(list).toHaveLength(FAVORITES_LIMIT)
    expect(list[0].id).toBe('nueva')
  })
})

describe('toggleFavorite', () => {
  it('guarda y quita', () => {
    const first = toggleFavorite([], image('1'), 10)
    expect(first.saved).toBe(true)
    expect(first.list).toHaveLength(1)

    const second = toggleFavorite(first.list, image('1'), 20)
    expect(second.saved).toBe(false)
    expect(second.list).toEqual([])
  })
})

describe('removeFavorite', () => {
  it('quita solo la clave indicada', () => {
    const list = addFavorite(addFavorite([], image('1')), image('2'))

    expect(removeFavorite(list, 'konachan:1').map((entry) => entry.id)).toEqual(['2'])
  })
})

describe('parseFavorites', () => {
  it('devuelve una lista vacía si no hay nada guardado', () => {
    expect(parseFavorites(null)).toEqual([])
    expect(parseFavorites('no es json')).toEqual([])
    expect(parseFavorites('{"items":[]}')).toEqual([])
  })

  it('ordena por fecha y descarta entradas incompletas o repetidas', () => {
    const raw = JSON.stringify([
      { ...image('1'), savedAt: 10 },
      { ...image('1'), savedAt: 99 },
      { ...image('2'), savedAt: 30 },
      { key: 'sin-provider', full: 'https://x/a.png' },
      { ...image('3'), full: '', savedAt: 40 },
    ])

    const list = parseFavorites(raw)

    expect(list.map((entry) => entry.id)).toEqual(['2', '1'])
    expect(list[1].savedAt).toBe(10)
  })

  it('completa los tags que falten', () => {
    const raw = JSON.stringify([{ ...image('1'), savedAt: 1, tags: undefined }])

    expect(parseFavorites(raw)[0].tags).toEqual([])
  })

  it('respeta el tope al leer', () => {
    const raw = JSON.stringify(
      Array.from({ length: FAVORITES_LIMIT + 20 }, (_, index) => ({
        ...image(String(index)),
        savedAt: index,
      })),
    )

    expect(parseFavorites(raw)).toHaveLength(FAVORITES_LIMIT)
  })
})

describe('clave de almacenamiento', () => {
  it('mantiene una versión explícita', () => {
    expect(FAVORITES_STORAGE_KEY).toBe('combined.favorites.v1')
  })
})
