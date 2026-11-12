import { beforeEach, describe, expect, it } from 'vitest'
import {
  authorQuery,
  completeTag,
  displayTag,
  highlightTag,
  lastToken,
  normalizeTag,
  rememberTags,
  rememberedTags,
  resetRememberedTags,
  seedsFor,
  suggestTags,
  tagScore,
} from '../suggestions'

beforeEach(() => {
  resetRememberedTags()
})

describe('suggestTags', () => {
  it('propone tags que empiezan por lo escrito', () => {
    expect(suggestTags('i', { provider: 'danbooru' })[0]).toBe('ia_generated')
  })

  it('encuentra wuthering_waves y widowmaker al escribir "w"', () => {
    const result = suggestTags('w', { provider: 'danbooru' })

    expect(result).toContain('wuthering_waves')
    expect(result).toContain('widowmaker')
    // Lo curado va antes: wuthering_waves está así en la lista base.
    expect(result.indexOf('wuthering_waves')).toBeLessThan(result.indexOf('widowmaker'))
  })

  it('completa el último término sin tocar los anteriores', () => {
    const result = suggestTags('landscape cy', { provider: 'danbooru' })

    expect(result).toContain('cyberpunk')
    expect(completeTag('landscape cy', 'cyberpunk')).toBe('landscape cyberpunk')
  })

  it('no propone el tag que ya está escrito', () => {
    expect(suggestTags('ia_generated', { provider: 'danbooru' })).not.toContain('ia_generated')
  })

  it('no propone nada con el término vacío', () => {
    expect(suggestTags('landscape ', { provider: 'danbooru' })).toEqual([])
    expect(suggestTags('', { provider: 'danbooru' })).toEqual([])
  })

  it('respeta el límite', () => {
    expect(suggestTags('a', { provider: 'danbooru', limit: 3 })).toHaveLength(3)
  })

  it('prefiere los tags curados frente a lo aprendido en la sesión', () => {
    rememberTags(Array.from({ length: 5 }, () => 'indie_virtual_youtuber'))

    expect(suggestTags('i', { provider: 'danbooru' })[0]).toBe('ia_generated')
  })

  it('ordena lo aprendido por veces visto', () => {
    rememberTags(['zzz_artist', 'zzz_artist', 'zzz_artist', 'zzz_other'])

    expect(suggestTags('zzz', { provider: 'danbooru' })).toEqual(['zzz_artist', 'zzz_other'])
  })

  it('usa sugerencias de texto libre en las fuentes de buscador', () => {
    const result = suggestTags('wall', { provider: 'wallhaven' })

    expect(result).toContain('wallpaper')
    expect(result).not.toContain('wuthering_waves')
  })
})

describe('tagScore', () => {
  it('ordena prefijo, palabra y coincidencia interna', () => {
    expect(tagScore('ia_generated', 'ia')).toBe(0)
    expect(tagScore('wuthering_waves', 'waves')).toBe(1)
    expect(tagScore('wuthering_waves', 'her')).toBe(2)
    expect(tagScore('wuthering_waves', 'zzz')).toBeNull()
    expect(tagScore('ia_generated', 'ia generated')).toBeNull()
  })
})

describe('texto', () => {
  it('normaliza mayúsculas y guiones bajos', () => {
    expect(normalizeTag('WUTHERING_Waves')).toBe('wuthering waves')
    expect(displayTag('wuthering_waves')).toBe('wuthering waves')
  })

  it('saca el último término que se está escribiendo', () => {
    expect(lastToken('landscape w')).toBe('w')
    expect(lastToken('landscape ')).toBe('')
  })

  it('completa el tag cuando el campo está vacío', () => {
    expect(completeTag('', 'wlop')).toBe('wlop')
    expect(completeTag('w', 'wlop')).toBe('wlop')
  })

  it('añade un término nuevo si se venía de un espacio', () => {
    expect(completeTag('landscape ', 'cyberpunk')).toBe('landscape cyberpunk')
  })

  it('resalta la parte que coincide', () => {
    expect(highlightTag('wuthering_waves', 'wuth')).toEqual({
      before: '',
      match: 'wuth',
      after: 'ering waves',
    })
    expect(highlightTag('wuthering_waves', 'waves')).toEqual({
      before: 'wuthering ',
      match: 'waves',
      after: '',
    })
  })
})

describe('rememberTags', () => {
  it('cuenta repeticiones sin duplicar', () => {
    rememberTags(['wlop', 'wlop', ' kantoku '])
    rememberTags(['wlop', ''])

    expect(rememberedTags().sort()).toEqual(['kantoku', 'wlop'])
  })
})

describe('authorQuery', () => {
  it('convierte el nombre en tag de artista en Danbooru', () => {
    expect(authorQuery('ask (askzy)', 'danbooru')).toBe('ask_(askzy)')
    expect(authorQuery('  wlop  ', 'safebooru')).toBe('wlop')
  })

  it('busca por subidor en los Moebooru', () => {
    expect(authorQuery('himeno_nanako', 'yandere')).toBe('user:himeno_nanako')
    expect(authorQuery('himeno nanako', 'konachan')).toBe('user:himeno_nanako')
  })

  it('lo deja como texto en las fuentes de buscador', () => {
    expect(authorQuery('Ansel Adams', 'pixabay')).toBe('Ansel Adams')
  })

  it('devuelve vacío sin autor', () => {
    expect(authorQuery('   ', 'danbooru')).toBe('')
  })
})

describe('seedsFor', () => {
  it('separa los tags de booru de los términos de foto', () => {
    expect(seedsFor('danbooru')).toContain('ia_generated')
    expect(seedsFor('pixabay')).toContain('wallpaper')
    expect(seedsFor('pixabay')).not.toContain('ia_generated')
  })
})
