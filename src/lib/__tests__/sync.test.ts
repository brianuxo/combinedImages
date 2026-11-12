import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../context/settings'
import type { FavoriteItem } from '../../context/favorites'
import type { Settings } from '../../types'
import {
  createSyncState,
  isSyncState,
  mergeFavorites,
  mergeSyncState,
  stableStringify,
  tombstonesForRemovals,
  TOMBSTONE_DAYS,
  toSharedSettings,
  withLocalQuality,
  type SyncState,
  type SyncTombstone,
} from '../sync'

const DAY = 24 * 60 * 60 * 1000

function favorite(key: string, savedAt: number): FavoriteItem {
  return {
    key,
    id: key,
    provider: 'danbooru',
    providerLabel: 'Danbooru',
    thumb: `https://example.com/${key}-thumb.jpg`,
    preview: `https://example.com/${key}-preview.jpg`,
    full: `https://example.com/${key}.jpg`,
    width: 1000,
    height: 1000,
    tags: [],
    pageUrl: `https://example.com/posts/${key}`,
    rating: 'safe',
    savedAt,
  }
}

function settings(patch: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

describe('ajustes compartidos', () => {
  it('quita la calidad al subir', () => {
    const shared = toSharedSettings(settings({ quality: 'max' }))
    expect('quality' in shared).toBe(false)
    expect(shared.theme).toBe('dark')
  })

  it('conserva la calidad del dispositivo al aplicar los del servidor', () => {
    const local = settings({ quality: 'optimo' })
    const remote = toSharedSettings(settings({ quality: 'max', accent: '#123456' }))

    const merged = withLocalQuality(local, remote)
    expect(merged.quality).toBe('optimo')
    expect(merged.accent).toBe('#123456')
  })
})

describe('mergeFavorites', () => {
  it('une las dos listas sin duplicar', () => {
    const local = [favorite('a', 100), favorite('b', 200)]
    const remote = [favorite('b', 200), favorite('c', 300)]

    const { favorites } = mergeFavorites(local, remote)
    expect(favorites.map((item) => item.key)).toEqual(['c', 'b', 'a'])
  })

  it('gana la entrada con savedAt más reciente', () => {
    const local = [favorite('a', 100)]
    const remote = [{ ...favorite('a', 900), tags: ['nuevo'] } as FavoriteItem]

    const { favorites } = mergeFavorites(local, remote)
    expect(favorites).toHaveLength(1)
    expect(favorites[0].savedAt).toBe(900)
    expect(favorites[0].tags).toEqual(['nuevo'])
  })

  it('borra lo que tiene una lápida posterior', () => {
    const now = Date.now()
    const local = [favorite('a', now - 1000), favorite('b', now - 500)]
    const tombstones: SyncTombstone[] = [{ key: 'a', deletedAt: now - 500 }]

    const { favorites } = mergeFavorites(local, [], tombstones, [], now)
    expect(favorites.map((item) => item.key)).toEqual(['b'])
  })

  it('conserva lo que se volvió a guardar después de borrarlo', () => {
    const now = Date.now()
    const local = [favorite('a', now - 100)]
    const tombstones: SyncTombstone[] = [{ key: 'a', deletedAt: now - 200 }]

    const { favorites } = mergeFavorites(local, [], [], tombstones, now)
    expect(favorites.map((item) => item.key)).toEqual(['a'])
  })

  it('olvida las lápidas de más de 30 días', () => {
    const now = 100 * DAY
    const local: SyncTombstone[] = [{ key: 'viejo', deletedAt: now - (TOMBSTONE_DAYS + 1) * DAY }]
    const remote: SyncTombstone[] = [{ key: 'nuevo', deletedAt: now - DAY }]

    const { tombstones } = mergeFavorites([], [], local, remote, now)
    expect(tombstones.map((entry) => entry.key)).toEqual(['nuevo'])
  })
})

describe('tombstonesForRemovals', () => {
  it('marca lo que desaparece y no toca lo que sigue', () => {
    const previous = [favorite('a', 100), favorite('b', 200)]
    const next = [favorite('a', 100)]

    const tombstones = tombstonesForRemovals(previous, next, [], 500)
    expect(tombstones).toEqual([{ key: 'b', deletedAt: 500 }])
  })

  it('no crea lápidas cuando solo se añade', () => {
    const previous = [favorite('a', 100)]
    const next = [favorite('a', 100), favorite('b', 200)]

    expect(tombstonesForRemovals(previous, next, [], 500)).toEqual([])
  })

  it('conserva las lápidas anteriores', () => {
    const previous = [favorite('a', 100), favorite('b', 200)]
    const next: FavoriteItem[] = []
    const existing: SyncTombstone[] = [{ key: 'a', deletedAt: 90 }]

    const tombstones = tombstonesForRemovals(previous, next, existing, 500)
    expect(tombstones.map((entry) => entry.key)).toEqual(['a', 'b'])
    // Al volver a borrarla, manda la fecha más reciente.
    expect(tombstones.find((entry) => entry.key === 'a')?.deletedAt).toBe(500)
  })
})

describe('mergeSyncState', () => {
  function state(
    favorites: FavoriteItem[],
    patch: Partial<Settings> = {},
    tombstones: SyncTombstone[] = [],
    updatedAt = 0,
  ): SyncState {
    return createSyncState(settings(patch), favorites, tombstones, updatedAt)
  }

  it('al bajar, los ajustes del servidor ganan', () => {
    const local = state([], { accent: '#local' })
    const remote = state([], { accent: '#remote' })

    expect(mergeSyncState(local, remote, 'remote').settings.accent).toBe('#remote')
  })

  it('al resolver un conflicto, los ajustes locales ganan', () => {
    const local = state([], { accent: '#local' })
    const remote = state([], { accent: '#remote' })

    expect(mergeSyncState(local, remote, 'local').settings.accent).toBe('#local')
  })

  it('siempre une los favoritos', () => {
    const local = state([favorite('a', 100)])
    const remote = state([favorite('b', 200)])

    const merged = mergeSyncState(local, remote, 'remote')
    expect(merged.favorites.map((item) => item.key)).toEqual(['b', 'a'])
  })

  it('sin estado remoto devuelve el local tal cual', () => {
    const local = state([favorite('a', 100)])
    expect(mergeSyncState(local, null)).toBe(local)
  })
})

describe('stableStringify', () => {
  it('da la misma cadena aunque cambie el orden de las claves', () => {
    const a = { uno: 1, dos: { tres: 3, cuatro: 4 } }
    const b = { dos: { cuatro: 4, tres: 3 }, uno: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('mantiene el orden de los arrays', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]))
  })
})

describe('isSyncState', () => {
  it('acepta un estado creado por la app', () => {
    expect(isSyncState(createSyncState(settings(), []))).toBe(true)
  })

  it('rechaza cualquier otra cosa', () => {
    expect(isSyncState(null)).toBe(false)
    expect(isSyncState({ version: 1 })).toBe(false)
    expect(isSyncState({ ...createSyncState(settings(), []), version: 99 })).toBe(false)
  })
})
