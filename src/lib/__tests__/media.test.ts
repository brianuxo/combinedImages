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
})
