/**
 * Proxy CORS opcional para Combined.
 *
 * Despliega con `npx wrangler deploy` y configura en la app:
 *   Ajustes → Red → https://<tu-worker>.workers.dev/?url={url}
 *
 * Sirve tanto para el JSON de las APIs sin CORS como para las imágenes de
 * Gelbooru y Rule34, que bloquean el hotlink según el referer.
 */
const ALLOWED_HOSTS = new Set([
  'konachan.com',
  'yande.re',
  'api.anime-pictures.net',
  'gelbooru.com',
  'wallhaven.cc',
  'api.rule34.xxx',
  'img1.gelbooru.com',
  'img2.gelbooru.com',
  'img3.gelbooru.com',
  'img4.gelbooru.com',
  'img5.gelbooru.com',
  'us.rule34.xxx',
  'rule34.xxx',
  'cdn.rule34.xxx',
])

const MEDIA_HOSTS = new Set([
  'img1.gelbooru.com',
  'img2.gelbooru.com',
  'img3.gelbooru.com',
  'img4.gelbooru.com',
  'img5.gelbooru.com',
  'us.rule34.xxx',
  'rule34.xxx',
  'cdn.rule34.xxx',
])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function refererFor(hostname) {
  if (hostname.endsWith('gelbooru.com')) return 'https://gelbooru.com/'
  if (hostname.endsWith('rule34.xxx')) return 'https://rule34.xxx/'
  return undefined
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    if (request.method !== 'GET') {
      return json({ error: 'Método no permitido' }, 405)
    }

    const target = new URL(request.url).searchParams.get('url')
    if (!target) return json({ error: 'Falta el parámetro ?url=' }, 400)

    let url
    try {
      url = new URL(target)
    } catch {
      return json({ error: 'URL inválida' }, 400)
    }

    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
      return json({ error: 'Host no permitido' }, 403)
    }

    const isMedia = MEDIA_HOSTS.has(url.hostname)
    const referer = refererFor(url.hostname)

    let upstream
    try {
      upstream = await fetch(url.toString(), {
        headers: {
          Accept: isMedia ? 'image/*,*/*;q=0.8' : 'application/json',
          'User-Agent': 'combinedImages/0.2',
          ...(referer ? { Referer: referer } : {}),
        },
      })
    } catch {
      return json({ error: 'No se pudo conectar con la fuente' }, 502)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type':
          upstream.headers.get('Content-Type') ??
          (isMedia ? 'application/octet-stream' : 'application/json'),
        'Cache-Control': isMedia ? 'public, max-age=86400' : 'public, max-age=300',
      },
    })
  },
}
