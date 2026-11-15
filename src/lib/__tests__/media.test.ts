import { describe, expect, it } from 'vitest'
import { displayUrls } from '../media'

const YANDERE = {
  thumb: 'https://files.yande.re/data/preview/a/sample.jpg',
  preview: 'https://files.yande.re/image/sample/sample.jpg',
  full: 'https://files.yande.re/image/a/original.jpg',
}

describe('displayUrls', () => {
  it('primero la URL directa del CDN y después la del servidor, por nivel', () => {
    expect(displayUrls('yandere', YANDERE)).toEqual([
      // Directa: la carga el dispositivo del CDN.
      'https://files.yande.re/data/preview/a/sample.jpg',
      // Respaldo: la misma imagen por el servidor.
      '/proxy/yandere-files/data/preview/a/sample.jpg',
      'https://files.yande.re/image/sample/sample.jpg',
      '/proxy/yandere-files/image/sample/sample.jpg',
      'https://files.yande.re/image/a/original.jpg',
      '/proxy/yandere-files/image/a/original.jpg',
    ])
  })

  it('descarta candidatos repetidos cuando thumb === preview', () => {
    expect(displayUrls('yandere', { ...YANDERE, thumb: YANDERE.preview })).toEqual([
      'https://files.yande.re/image/sample/sample.jpg',
      '/proxy/yandere-files/image/sample/sample.jpg',
      'https://files.yande.re/image/a/original.jpg',
      '/proxy/yandere-files/image/a/original.jpg',
    ])
  })

  it('no duplica las URLs que ya van por el servidor (Gelbooru, Rule34)', () => {
    const media = '/media?url=https%3A%2F%2Fsimg3.gelbooru.com%2Fsamples%2Fa.jpg'
    expect(
      displayUrls('gelbooru', { thumb: media, preview: media, full: media }),
    ).toEqual([media])
  })

  it('funciona sin URL válida: no devuelve candidatos vacíos', () => {
    expect(displayUrls('konachan', { thumb: '', preview: '', full: '' })).toEqual([])
  })

  it('con tope, el primer candidato de cada nivel es la versión redimensionada', () => {
    // En los tests hay servidor propio (DEV), así que va por /resize.
    const item = { ...YANDERE, width: 4000, height: 3000 }
    expect(displayUrls('yandere', item, undefined, 1920)).toEqual([
      `/resize?url=${encodeURIComponent(YANDERE.thumb)}&w=1920`,
      YANDERE.thumb,
      '/proxy/yandere-files/data/preview/a/sample.jpg',
      `/resize?url=${encodeURIComponent(YANDERE.preview)}&w=1920`,
      YANDERE.preview,
      '/proxy/yandere-files/image/sample/sample.jpg',
      `/resize?url=${encodeURIComponent(YANDERE.full)}&w=1920`,
      YANDERE.full,
      '/proxy/yandere-files/image/a/original.jpg',
    ])
  })

  it('startLevel "preview" empieza por la vista ampliada (visor)', () => {
    const item = { ...YANDERE, width: 4000, height: 3000 }
    const urls = displayUrls('yandere', item, undefined, 1920, 'preview')
    expect(urls[0]).toBe(`/resize?url=${encodeURIComponent(YANDERE.preview)}&w=1920`)
    expect(urls).toContain(`/resize?url=${encodeURIComponent(YANDERE.thumb)}&w=1920`)
  })

  it('si la imagen original ya cabe en el tope no se añade /resize', () => {
    const item = { ...YANDERE, width: 1000, height: 800 }
    expect(displayUrls('yandere', item, undefined, 1920)).toEqual([
      YANDERE.thumb,
      '/proxy/yandere-files/data/preview/a/sample.jpg',
      YANDERE.preview,
      '/proxy/yandere-files/image/sample/sample.jpg',
      YANDERE.full,
      '/proxy/yandere-files/image/a/original.jpg',
    ])
  })

  it('las fuentes con hotlink bloqueado usan /media con w aunque ya vengan por /media', () => {
    const inner = 'https://api-cdn-us.rule34.xxx/images/a.jpg'
    const media = `/media?url=${encodeURIComponent(inner)}`
    expect(
      displayUrls('rule34', { thumb: media, preview: media, full: media, width: 5000, height: 4000 }, undefined, 1920),
    ).toEqual([
      // Primero la versión topada…
      `/media?url=${encodeURIComponent(inner)}&w=1920`,
      // …y como respaldo la misma ruta sin redimensionar.
      media,
    ])
  })
})
