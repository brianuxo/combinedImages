import type { ProviderId } from '../../types'
import { HttpError, fetchJson } from '../http'

export interface ProbeResult {
  ok: boolean
  message: string
}

interface ProbeOptions {
  apiKey?: string
  userId?: string
  proxyUrl: string
  signal: AbortSignal
}

const MESSAGES = {
  missingKey: 'Falta la API key',
  missingUserId: 'Falta el User ID',
  invalid: 'La API key no es válida',
  network: 'No se pudo conectar con la API',
  ok: 'Clave válida',
} as const

async function probe(
  provider: ProviderId,
  url: string,
  options: ProbeOptions,
  config: {
    headers?: Record<string, string>
    /** Devuelve un mensaje si el cuerpo de la respuesta indica un fallo. */
    validate?: (body: unknown) => string | null
  } = {},
): Promise<ProbeResult> {
  try {
    const body = await fetchJson<unknown>(url, {
      provider,
      signal: options.signal,
      proxyUrl: options.proxyUrl,
      headers: config.headers,
    })
    const problem = config.validate?.(body)
    if (problem) return { ok: false, message: problem }
    return { ok: true, message: MESSAGES.ok }
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401 || error.status === 403 || error.status === 400) {
        return { ok: false, message: MESSAGES.invalid }
      }
      return { ok: false, message: `La API respondió con un error (${error.status})` }
    }
    return { ok: false, message: MESSAGES.network }
  }
}

/**
 * Comprueba que una API key funciona contra la fuente real, sin descargar
 * imágenes. Se usa desde Ajustes → Claves API.
 */
export async function probeProviderKey(
  provider: ProviderId,
  options: ProbeOptions,
): Promise<ProbeResult> {
  const apiKey = options.apiKey?.trim()
  const userId = options.userId?.trim()

  switch (provider) {
    case 'gelbooru': {
      if (!apiKey) return { ok: false, message: MESSAGES.missingKey }
      if (!userId) return { ok: false, message: MESSAGES.missingUserId }
      const params = new URLSearchParams({
        page: 'dapi',
        s: 'post',
        q: 'index',
        json: '1',
        limit: '1',
        api_key: apiKey,
        user_id: userId,
      })
      return probe(
        provider,
        `https://gelbooru.com/index.php?${params.toString()}`,
        options,
      )
    }

    case 'rule34': {
      if (!apiKey) return { ok: false, message: MESSAGES.missingKey }
      if (!userId) return { ok: false, message: MESSAGES.missingUserId }
      const params = new URLSearchParams({
        page: 'dapi',
        s: 'post',
        q: 'index',
        json: '1',
        limit: '1',
        api_key: apiKey,
        user_id: userId,
      })
      return probe(
        provider,
        `https://api.rule34.xxx/index.php?${params.toString()}`,
        options,
        {
          // Rule34 responde 200 con un texto de error cuando la credencial falla.
          validate: (body) =>
            typeof body === 'string' && /authentication|api key|user id/i.test(body)
              ? MESSAGES.invalid
              : null,
        },
      )
    }

    case 'pixabay': {
      if (!apiKey) return { ok: false, message: MESSAGES.missingKey }
      const params = new URLSearchParams({
        key: apiKey,
        per_page: '3',
        safesearch: 'true',
        order: 'popular',
      })
      return probe(provider, `https://pixabay.com/api/?${params.toString()}`, options)
    }

    case 'wallhaven': {
      if (!apiKey) return { ok: false, message: MESSAGES.missingKey }
      const params = new URLSearchParams({
        page: '1',
        purity: '100',
        apikey: apiKey,
      })
      return probe(
        provider,
        `https://wallhaven.cc/api/v1/search?${params.toString()}`,
        options,
      )
    }

    case 'openverse': {
      if (!apiKey) return { ok: false, message: MESSAGES.missingKey }
      return probe(
        provider,
        'https://api.openverse.org/v1/images/?q=wallpaper&page_size=1',
        options,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      )
    }

    default:
      return { ok: false, message: 'Esta fuente no necesita clave' }
  }
}
