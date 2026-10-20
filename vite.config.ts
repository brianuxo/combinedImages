import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0'

// Las APIs de Konachan, Yande.re, Anime-Pictures, Gelbooru y Wallhaven no
// envían cabeceras CORS. En desarrollo las proxeamos desde el propio servidor
// de Vite. En producción puedes apuntar `proxyUrl` (Ajustes > Red) a un proxy
// CORS propio.
const proxy = {
  '/proxy/konachan': {
    target: 'https://konachan.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/proxy\/konachan/, ''),
  },
  '/proxy/yandere': {
    target: 'https://yande.re',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/proxy\/yandere/, ''),
  },
  '/proxy/anime-pictures': {
    target: 'https://api.anime-pictures.net',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/proxy\/anime-pictures/, ''),
  },
  '/proxy/gelbooru': {
    target: 'https://gelbooru.com',
    changeOrigin: true,
    headers: { 'User-Agent': USER_AGENT },
    rewrite: (path: string) => path.replace(/^\/proxy\/gelbooru/, ''),
  },
  '/proxy/wallhaven': {
    target: 'https://wallhaven.cc',
    changeOrigin: true,
    headers: { 'User-Agent': USER_AGENT },
    rewrite: (path: string) => path.replace(/^\/proxy\/wallhaven/, ''),
  },
}

// CDN de Gelbooru y Rule34: bloquean el hotlink según el referer. El
// middleware añade el referer correcto para poder mostrar y descargar.
const MEDIA_HOSTS = new Set([
  'img1.gelbooru.com',
  'img2.gelbooru.com',
  'img3.gelbooru.com',
  'img4.gelbooru.com',
  'img5.gelbooru.com',
  'us.rule34.xxx',
  'api.rule34.xxx',
  'rule34.xxx',
  'cdn.rule34.xxx',
])

function refererFor(hostname: string): string | undefined {
  if (hostname.endsWith('gelbooru.com')) return 'https://gelbooru.com/'
  if (hostname.endsWith('rule34.xxx')) return 'https://rule34.xxx/'
  return undefined
}

async function handleMedia(
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void,
) {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost')

  if (requestUrl.pathname !== '/' && requestUrl.pathname !== '') {
    next()
    return
  }

  const target = requestUrl.searchParams.get('url')
  if (!target) {
    response.statusCode = 400
    response.end('Falta el parámetro ?url=')
    return
  }

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    response.statusCode = 400
    response.end('URL inválida')
    return
  }

  if (parsed.protocol !== 'https:' || !MEDIA_HOSTS.has(parsed.hostname)) {
    response.statusCode = 403
    response.end('Host no permitido')
    return
  }

  const referer = refererFor(parsed.hostname)

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': USER_AGENT,
        ...(referer ? { Referer: referer } : {}),
      },
    })

    const buffer = Buffer.from(await upstream.arrayBuffer())

    response.statusCode = upstream.status
    response.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/octet-stream',
    )
    response.setHeader('Content-Length', String(buffer.byteLength))
    response.setHeader('Cache-Control', 'public, max-age=86400')
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.end(buffer)
  } catch {
    response.statusCode = 502
    response.end('No se pudo obtener la imagen')
  }
}

function mediaProxy(): Plugin {
  return {
    name: 'combined-media-proxy',
    configureServer(server) {
      server.middlewares.use('/media', handleMedia)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/media', handleMedia)
    },
  }
}

export default defineConfig({
  plugins: [react(), mediaProxy()],
  server: { proxy },
  preview: { proxy },
})
