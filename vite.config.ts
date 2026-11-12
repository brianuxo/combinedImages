import react from '@vitejs/plugin-react'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
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
 * Sincronización entre dispositivos.
 *
 * La instancia guarda un único paquete cifrado con los favoritos, las claves
 * y los ajustes. El navegador solo manda y recibe ese texto: no puede leer
 * las claves, porque la frase con la que se descifra nunca llega al servidor.
 *
 * La conexión se autoriza con la propia frase: el cliente deriva de ella una
 * credencial (PBKDF2) y el servidor guarda solo su hash en `data/auth`. La
 * primera conexión reclama el hash; después, solo esa frase (o el token fijo
 * de `data/token`, por compatibilidad) puede leer y escribir.
 *
 * El paquete lleva un número de revisión. Un PUT solo se aplica si parte de
 * la revisión que el cliente conoce; si otro dispositivo escribió antes, se
 * responde 409 con el estado actual y el cliente vuelve a mezclar.
 *
 * Vive aquí, en el mismo proceso que `vite preview`, para no añadir otro
 * servicio ni otro puerto. Los datos van a `data/` (fuera del despliegue).
 */
const SYNC_BODY_LIMIT = 2_000_000

interface SyncStore {
  revision: number
  updatedAt: number
  blob: string
}

const EMPTY_SYNC: SyncStore = { revision: 0, updatedAt: 0, blob: '' }

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
      if (size > SYNC_BODY_LIMIT) {
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

function syncStore(): Plugin {
  let root = process.cwd()
  let cachedToken: string | null = null

  const dataDir = () => resolve(process.env.SYNC_DATA_DIR ?? join(root, 'data'))
  const storeFile = () => join(dataDir(), 'sync.json')

  // El token puede venir del entorno (systemd) o de `data/token`. Si no
  // existe, se genera la primera vez y se guarda con permisos de propietario.
  // Ya no se usa para conectar desde la app (eso lo hace la frase), pero se
  // conserva por compatibilidad con dispositivos ya vinculados y para curl.
  const token = (): string => {
    if (cachedToken) return cachedToken

    const fromEnv = (process.env.SYNC_TOKEN ?? '').trim()
    if (fromEnv) {
      cachedToken = fromEnv
      return cachedToken
    }

    const file = join(dataDir(), 'token')
    try {
      const saved = readFileSync(file, 'utf8').trim()
      if (saved) {
        cachedToken = saved
        return cachedToken
      }
    } catch {
      // Todavía no hay token: se crea abajo.
    }

    cachedToken = randomBytes(24).toString('hex')
    mkdirSync(dataDir(), { recursive: true, mode: 0o700 })
    writeFileSync(file, `${cachedToken}\n`, { mode: 0o600 })
    console.log(`[sync] Token creado en ${file}`)
    return cachedToken
  }

  const readStore = (): SyncStore => {
    try {
      const parsed = JSON.parse(readFileSync(storeFile(), 'utf8')) as Partial<SyncStore>
      if (typeof parsed.revision !== 'number' || typeof parsed.blob !== 'string') {
        return { ...EMPTY_SYNC }
      }
      return {
        revision: parsed.revision,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        blob: parsed.blob,
      }
    } catch {
      return { ...EMPTY_SYNC }
    }
  }

  const writeStore = (store: SyncStore): void => {
    mkdirSync(dataDir(), { recursive: true, mode: 0o700 })
    const file = storeFile()
    const tmp = `${file}.tmp`

    if (existsSync(file)) {
      try {
        copyFileSync(file, `${file}.bak`)
      } catch {
        // Sin copia de seguridad se sigue: el archivo principal es el bueno.
      }
    }

    writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 })
    renameSync(tmp, file)
  }

  // Hash de la credencial derivada de la frase, en `data/auth`. Va en un
  // archivo aparte para poder resetear el acceso sin tocar el paquete.
  const authFile = () => join(dataDir(), 'auth')

  const readAuthHash = (): string | null => {
    try {
      const saved = readFileSync(authFile(), 'utf8').trim()
      return saved || null
    } catch {
      // Nadie ha reclamado la credencial todavía.
      return null
    }
  }

  const writeAuthHash = (hash: string): void => {
    mkdirSync(dataDir(), { recursive: true, mode: 0o700 })
    writeFileSync(authFile(), `${hash}\n`, { mode: 0o600 })
  }

  const sameValue = (left: string, right: string): boolean => {
    const a = Buffer.from(left)
    const b = Buffer.from(right)
    return a.byteLength === b.byteLength && timingSafeEqual(a, b)
  }

  const hashBearer = (value: string): string =>
    createHash('sha256').update(value, 'utf8').digest('hex')

  // Autoriza con el token fijo o con la credencial derivada de la frase.
  // Si nadie ha reclamado la credencial, la primera conexión la reclama.
  const authorized = (request: IncomingMessage): boolean => {
    const header = request.headers.authorization ?? ''
    const match = /^Bearer\s+(.+)$/i.exec(header)
    if (!match) return false

    const given = match[1]
    if (sameValue(given, token())) return true

    const digest = hashBearer(given)
    const saved = readAuthHash()
    if (saved) return sameValue(digest, saved)

    writeAuthHash(digest)
    console.log('[sync] Credencial de frase reclamada en data/auth')
    return true
  }

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname

    if (!authorized(request)) {
      sendJson(response, 401, { error: 'no-autorizado' })
      return
    }

    if (path === '/health' && request.method === 'GET') {
      sendJson(response, 200, { ok: true })
      return
    }

    if (path === '/sync' && request.method === 'GET') {
      sendJson(response, 200, readStore())
      return
    }

    if (path === '/sync' && request.method === 'PUT') {
      let body: unknown
      try {
        body = await readJsonBody(request)
      } catch (error) {
        const tooLarge = error instanceof Error && error.message === 'payload-too-large'
        sendJson(response, tooLarge ? 413 : 400, { error: tooLarge ? 'demasiado-grande' : 'json-invalido' })
        return
      }

      const payload = body as { baseRevision?: unknown; blob?: unknown } | null
      const baseRevision = payload?.baseRevision
      const blob = payload?.blob

      if (
        typeof baseRevision !== 'number' ||
        !Number.isInteger(baseRevision) ||
        baseRevision < 0 ||
        typeof blob !== 'string' ||
        blob.length === 0 ||
        blob.length > SYNC_BODY_LIMIT
      ) {
        sendJson(response, 400, { error: 'datos-invalidos' })
        return
      }

      const current = readStore()
      if (baseRevision !== current.revision) {
        // El cliente mezcla con lo que devolvemos y reenvía.
        sendJson(response, 409, current)
        return
      }

      const next: SyncStore = {
        revision: current.revision + 1,
        updatedAt: Date.now(),
        blob,
      }
      writeStore(next)
      sendJson(response, 200, next)
      return
    }

    sendJson(response, 404, { error: 'no-encontrado' })
  }

  const middleware = (request: IncomingMessage, response: ServerResponse) => {
    void handle(request, response).catch((error: unknown) => {
      console.error('[sync]', error)
      if (!response.headersSent) sendJson(response, 500, { error: 'error-interno' })
      else response.end()
    })
  }

  return {
    name: 'combined-sync-store',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      // Crear el token al arrancar: si se espera a la primera petición, un
      // cliente sin token recibe 401 antes de que el archivo exista.
      token()
      server.middlewares.use('/api', middleware)
    },
    configurePreviewServer(server) {
      token()
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
  plugins: [react(), mediaProxy(), syncStore()],
  server: { proxy, allowedHosts: ALLOWED_HOSTS },
  preview: { proxy, allowedHosts: ALLOWED_HOSTS },
})
