/** Cliente del pequeño almacén de sincronización que sirve la instancia. */

export interface RemoteSyncState {
  revision: number
  updatedAt: number
  blob: string
}

export class SyncApiError extends Error {
  /** 0 cuando no hubo respuesta (sin red, timeout…). */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SyncApiError'
    this.status = status
  }
}

const ENDPOINT = '/api/sync'

function describe(status: number): string {
  if (status === 0) return 'No se pudo conectar con la instancia.'
  if (status === 401) return 'La instancia no aceptó esta frase.'
  if (status === 409) return 'Otro dispositivo escribió antes. Se volverá a intentar.'
  if (status === 413) return 'El paquete de sincronización es demasiado grande.'
  if (status === 429) return 'Demasiados intentos. Espera un momento.'
  return `La instancia respondió con un error (${status}).`
}

async function request(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      cache: 'no-store',
      credentials: 'same-origin',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new SyncApiError(describe(0), 0)
  }

  if (!response.ok && response.status !== 409) {
    throw new SyncApiError(describe(response.status), response.status)
  }

  return response
}

export async function pullSync(token: string, signal?: AbortSignal): Promise<RemoteSyncState> {
  const response = await request(ENDPOINT, token, { method: 'GET', signal })
  const data = (await response.json()) as Partial<RemoteSyncState>

  return {
    revision: typeof data.revision === 'number' ? data.revision : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    blob: typeof data.blob === 'string' ? data.blob : '',
  }
}

export type PushResult =
  | { ok: true; revision: number; updatedAt: number }
  | { ok: false; remote: RemoteSyncState }

export async function pushSync(
  token: string,
  payload: { baseRevision: number; blob: string },
  signal?: AbortSignal,
): Promise<PushResult> {
  const response = await request(ENDPOINT, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
    signal,
  })

  const raw = (await response.json()) as Partial<RemoteSyncState>

  if (response.status === 409) {
    return {
      ok: false,
      remote: {
        revision: typeof raw.revision === 'number' ? raw.revision : 0,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
        blob: typeof raw.blob === 'string' ? raw.blob : '',
      },
    }
  }

  return {
    ok: true,
    revision: typeof raw.revision === 'number' ? raw.revision : payload.baseRevision + 1,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  }
}

/** Comprueba token y conectividad sin tocar los datos. */
export async function checkSync(token: string, signal?: AbortSignal): Promise<void> {
  await request('/api/health', token, { method: 'GET', signal })
}
