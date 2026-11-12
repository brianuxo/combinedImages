import { describe, expect, it } from 'vitest'
import { PROXY_ROUTES, sameOriginUrls } from '../proxy'
import viteConfig from '../../../vite.config.ts'

const serverProxy = (viteConfig as { server?: { proxy?: Record<string, unknown> } }).server
  ?.proxy as Record<string, unknown>

describe('sameOriginUrls', () => {
  it('convierte la URL de la imagen en la ruta del proxy', () => {
    expect(sameOriginUrls('konachan', 'https://konachan.com/image/a.png')).toEqual([
      '/proxy/konachan/image/a.png',
    ])
  })

  it('traduce los hosts de imagen de Yande.re', () => {
    expect(sameOriginUrls('yandere', 'https://files.yande.re/image/a.jpg')).toEqual([
      '/proxy/yandere-files/image/a.jpg',
    ])
    expect(sameOriginUrls('yandere', 'https://assets.yande.re/data/preview/a.jpg')).toEqual([
      '/proxy/yandere-assets/data/preview/a.jpg',
    ])
  })

  it('no inventa rutas para hosts que no son de la fuente', () => {
    expect(sameOriginUrls('konachan', 'https://otro-sitio.com/a.png')).toEqual([])
  })
})

describe('proxy del servidor de Vite', () => {
  it('tiene una ruta por cada entrada de la tabla compartida', () => {
    const expected = Object.values(PROXY_ROUTES)
      .flatMap((routes) => routes ?? [])
      .map((route) => route.path)
      .sort()

    expect(Object.keys(serverProxy).sort()).toEqual(expected)
  })

  it('ordena las rutas de la más larga a la más corta', () => {
    // Si no, `/proxy/yandere` se comería a `/proxy/yandere-files` y el
    // proxy apuntaría al host equivocado.
    const lengths = Object.keys(serverProxy).map((path) => path.length)
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a))
  })

  it('las rutas de Yande.re envían el referer de su web', () => {
    // Yande.re redirige al post si la imagen no viene de su web.
    const route = serverProxy['/proxy/yandere-files'] as {
      headers?: Record<string, string>
    }
    expect(route.headers?.Referer).toBe('https://yande.re/')
  })
})
