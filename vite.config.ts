import react from '@vitejs/plugin-react'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
// La extensión `.ts` es explícita porque este archivo lo compila el proyecto
// de Node (`nodenext`), que no admite importaciones sin extensión.
import { PROXY_ROUTES } from './src/lib/proxy.ts'

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0'

// Las APIs de Konachan, Yande.re, Anime-Pictures, Gelbooru y Wallhaven no
// envían cabeceras CORS. En desarrollo las proxeamos desde el propio servidor
// de Vite. En producción puedes apuntar `proxyUrl` (Ajustes > Red) a un proxy
// CORS propio.
//
// Las rutas salen de `src/lib/proxy.ts`, que es la misma tabla que usa la app
// para reescribir las URLs: así el servidor y el cliente no se desincronizan.
const EXTRA_HEADERS: Record<string, Record<string, string>> = {
  '/proxy/gelbooru': { 'User-Agent': USER_AGENT },
  '/proxy/wallhaven': { 'User-Agent': USER_AGENT },
  // Yande.re no sirve la imagen si la petición no viene de su propia web:
  // redirige al post y devuelve el HTML en lugar del archivo.
  '/proxy/yandere': { 'User-Agent': USER_AGENT, Referer: 'https://yande.re/' },
  '/proxy/yandere-files': {
    'User-Agent': USER_AGENT,
    Referer: 'https://yande.re/',
  },
  '/proxy/yandere-assets': {
    'User-Agent': USER_AGENT,
    Referer: 'https://yande.re/',
  },
}

const proxy = Object.fromEntries(
  Object.entries(PROXY_ROUTES)
    .flatMap(([, routes]) => routes ?? [])
    // La ruta más larga va primero: si no, `/proxy/yandere` se comería a
    // `/proxy/yandere-files` y el proxy apuntaría al host equivocado.
    .sort((a, b) => b.path.length - a.path.length)
    .map((route) => [
      route.path,
      {
        target: route.origin,
        changeOrigin: true,
        headers: EXTRA_HEADERS[route.path],
        rewrite: (path: string) => path.replace(new RegExp(`^${route.path}`), ''),
      },
    ]),
)

// CDN de Gelbooru y Rule34: bloquean el hotlink según el referer. El
// middleware añade el referer correcto para poder mostrar y descargar.
//
// Estas fuentes cambian de host sin avisar (img1..img5, us, api-cdn-us,
// api-cdn, cdn...) y una lista cerrada se queda obsoleta: `cdn.rule34.xxx`
// e `img1.gelbooru.com` ya no existen y `api-cdn-us.rule34.xxx` sí. Por eso
// se acepta cualquier subdominio de sus dominios en lugar de host a host.
//
// Ojo: la misma regla está copiada en `worker/index.js` (el worker se
// despliega tal cual, sin compilar, así que no puede importar de `src/`).
// Si se cambia una, hay que cambiar la otra.
const MEDIA_HOSTS = new Set(['gelbooru.com', 'rule34.xxx'])
const MEDIA_HOST_SUFFIXES = ['.gelbooru.com', '.rule34.xxx']

function isMediaHost(hostname: string): boolean {
  if (MEDIA_HOSTS.has(hostname)) return true
  return MEDIA_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
}

function refererFor(hostname: string): string | undefined {
  if (hostname.endsWith('gelbooru.com')) return 'https://gelbooru.com/'
  if (hostname.endsWith('rule34.xxx')) return 'https://rule34.xxx/'
  if (hostname.endsWith('yande.re')) return 'https://yande.re/'
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

  if (parsed.protocol !== 'https:' || !isMediaHost(parsed.hostname)) {
    console.warn(`[media] Host no permitido: ${parsed.hostname}`)
    response.statusCode = 403
    response.end('Host no permitido')
    return
  }

  const referer = refererFor(parsed.hostname)

  let upstream: Response
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': USER_AGENT,
        ...(referer ? { Referer: referer } : {}),
      },
    })
  } catch {
    response.statusCode = 502
    response.end('No se pudo obtener la imagen')
    return
  }

  response.statusCode = upstream.status
  response.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'application/octet-stream',
  )
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) response.setHeader('Content-Length', contentLength)
  response.setHeader('Access-Control-Allow-Origin', '*')

  if (!upstream.ok || !upstream.body) {
    // Los errores se sirven igual (el `<img>` reacciona al estado), pero sin
    // nada que anime al navegador a guardarlos.
    response.setHeader('Cache-Control', 'no-store')
    response.end()
    return
  }

  // Las URLs llevan el MD5 del archivo: una URL es siempre el mismo archivo,
  // así que el navegador puede guardarlo y no volver a pedirlo en semanas.
  response.setHeader('Cache-Control', 'public, max-age=2592000, immutable')

  // Se reenvía el flujo del CDN tal cual llega: guardar el archivo entero en
  // memoria antes de responder retrasaba la primera tanda de píxeles y
  // multiplicaba la memoria usada con varias peticiones a la vez.
  const stream = Readable.fromWeb(upstream.body as unknown as NodeReadableStream)
  stream.pipe(response)
  // Si el CDN corta a mitad de cuerpo, hay que soltar la conexión: un 200
  // interrumpido hace que el navegador marque la imagen con error.
  stream.on('error', () => response.destroy())
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

/*
 * Almacén de datos locales.
 *
 * La instancia guarda los favoritos y la configuración en archivos JSON
 * dentro de `data/`. No se requiere frase de sincronización ni cifrado:
 * cualquier navegador que acceda a la instancia puede leer y escribir.
 *
 * Los archivos están en `.gitignore` para que no se suban al repositorio.
 * Cada dispositivo que usa la misma instancia comparte los mismos datos.
 *
 * Endpoints:
 *   GET  /api/data/favorites  → lee data/favorites.json
 *   PUT  /api/data/favorites  → escribe data/favorites.json
 *   GET  /api/data/settings   → lee data/settings.json
 *   PUT  /api/data/settings   → escribe data/settings.json
 *   GET  /api/data/health     → { ok: true }
 */
const DATA_BODY_LIMIT = 500_000

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(body))
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  let tooLarge = false

  await new Promise<void>((done, fail) => {
    request.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      if (size > DATA_BODY_LIMIT) {
        tooLarge = true
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (tooLarge) fail(new Error('payload-too-large'))
      else done()
    })
    request.on('error', fail)
  })

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function dataStore(): Plugin {
  let root = process.cwd()

  const dataDir = () => resolve(process.env.DATA_DIR ?? join(root, 'data'))

  const safeRead = (fileName: string): unknown => {
    try {
      const file = join(dataDir(), fileName)
      const raw = readFileSync(file, 'utf8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const safeWrite = (fileName: string, data: unknown): void => {
    mkdirSync(dataDir(), { recursive: true, mode: 0o700 })
    const file = join(dataDir(), fileName)
    const tmp = `${file}.tmp`

    if (existsSync(file)) {
      try {
        copyFileSync(file, `${file}.bak`)
      } catch {
        // Sin copia de seguridad se sigue.
      }
    }

    writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
    renameSync(tmp, file)
  }

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const path = url.pathname

    // CORS: permitir que la app se abra desde file:// o otro origen.
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }

    // Health check
    if (path === '/data/health' && request.method === 'GET') {
      sendJson(response, 200, { ok: true })
      return
    }

    // Favoritos
    if (path === '/data/favorites') {
      if (request.method === 'GET') {
        const data = safeRead('favorites.json')
        sendJson(response, 200, data ?? [])
        return
      }

      if (request.method === 'PUT') {
        let body: unknown
        try {
          body = await readJsonBody(request)
        } catch (error) {
          const tooLarge = error instanceof Error && error.message === 'payload-too-large'
          sendJson(response, tooLarge ? 413 : 400, { error: tooLarge ? 'demasiado-grande' : 'json-invalido' })
          return
        }

        if (!Array.isArray(body)) {
          sendJson(response, 400, { error: 'se-espera-un-array' })
          return
        }

        safeWrite('favorites.json', body)
        sendJson(response, 200, { ok: true, count: body.length })
        return
      }
    }

    // Settings
    if (path === '/data/settings') {
      if (request.method === 'GET') {
        const data = safeRead('settings.json')
        sendJson(response, 200, data ?? {})
        return
      }

      if (request.method === 'PUT') {
        let body: unknown
        try {
          body = await readJsonBody(request)
        } catch (error) {
          const tooLarge = error instanceof Error && error.message === 'payload-too-large'
          sendJson(response, tooLarge ? 413 : 400, { error: tooLarge ? 'demasiado-grande' : 'json-invalido' })
          return
        }

        if (!body || typeof body !== 'object') {
          sendJson(response, 400, { error: 'se-espera-un-objeto' })
          return
        }

        safeWrite('settings.json', body)
        sendJson(response, 200, { ok: true })
        return
      }
    }

    sendJson(response, 404, { error: 'no-encontrado' })
  }

  const middleware = (request: IncomingMessage, response: ServerResponse) => {
    void handle(request, response).catch((error: unknown) => {
      console.error('[data]', error)
      if (!response.headersSent) sendJson(response, 500, { error: 'error-interno' })
      else response.end()
    })
  }

  return {
    name: 'combined-data-store',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use('/api', middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', middleware)
    },
  }
}

// `vite` y `vite preview` rechazan peticiones cuyo Host no conocen. Para
// servir la app por un dominio propio (Tailscale, un túnel…) hay que
// añadirlo: ALLOWED_HOSTS=midominio.ts.net npm run preview
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react(), mediaProxy(), dataStore()],
  server: { proxy, allowedHosts: ALLOWED_HOSTS },
  preview: { proxy, allowedHosts: ALLOWED_HOSTS },
})
