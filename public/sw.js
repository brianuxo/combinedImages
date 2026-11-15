/*
 * Service worker de Combined.
 *
 * Guarda el armazón de la app (HTML, JS, CSS, fuentes e iconos) para poder abrirla
 * sin conexión. Nunca toca /proxy/*, /media, /resize ni /api: por ahí pasan las
 * búsquedas, las imágenes (incluidas las redimensionadas al tope de la calidad),
 * las descargas de las fuentes y el paquete de sincronización, y esas respuestas
 * no se guardan en el dispositivo.
 *
 * Los assets de Vite llevan hash en el nombre, así que se pueden cachear para
 * siempre: si cambia el código, cambia el nombre. El HTML sí va a red primero,
 * de modo que una recarga con conexión siempre trae la última versión.
 */

const CACHE = 'combined-shell-v2'
const CACHE_PREFIX = 'combined-'
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)))

      // Los nombres con hash solo se conocen al leer el HTML servido.
      try {
        const html = await fetch('/', { cache: 'reload' }).then((response) => response.text())
        const assets = new Set()
        for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
          assets.add(match[1])
        }
        await Promise.allSettled([...assets].map((url) => cache.add(url)))
      } catch {
        // Sin red en la instalación: el runtime se encarga en la primera visita.
      }

      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

const isPrivate = (pathname) =>
  pathname.startsWith('/proxy/') ||
  pathname === '/proxy' ||
  pathname.startsWith('/media') ||
  pathname.startsWith('/resize') ||
  pathname.startsWith('/api/') ||
  pathname === '/api' ||
  pathname === '/sw.js'

const isStatic = (pathname) =>
  pathname.startsWith('/assets/') ||
  pathname.startsWith('/icons/') ||
  pathname.startsWith('/screenshots/') ||
  pathname === '/favicon.svg' ||
  pathname === '/manifest.webmanifest'

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  // ignoreVary: el servidor responde con `Vary: Origin` y los módulos con
  // `crossorigin` mandan Origin, así que una búsqueda estricta no encontraría el asset.
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put('/', response.clone())
    }
    return response
  } catch {
    const cached =
      (await cache.match(request, { ignoreVary: true })) ||
      (await cache.match('/', { ignoreVary: true }))
    if (cached) return cached
    return new Response('Sin conexión. Vuelve a intentarlo cuando recuperes la red.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isPrivate(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (isStatic(url.pathname)) {
    event.respondWith(cacheFirst(request))
  }
})
