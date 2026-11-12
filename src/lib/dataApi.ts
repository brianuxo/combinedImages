/** Cliente del almacén de datos locales de la instancia. */

const ENDPOINT = '/api/data'

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })
}

/** Comprueba que la instancia responde. */
export async function checkServer(): Promise<boolean> {
  try {
    const res = await request(`${ENDPOINT}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

/** Lee los favoritos desde el servidor. */
export async function pullFavorites(): Promise<unknown[]> {
  const res = await request(`${ENDPOINT}/favorites`, { method: 'GET' })
  if (!res.ok) throw new Error(`Error al leer favoritos: ${res.status}`)
  return res.json()
}

/** Guarda los favoritos en el servidor. */
export async function pushFavorites(items: unknown[]): Promise<void> {
  const res = await request(`${ENDPOINT}/favorites`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
  if (!res.ok) throw new Error(`Error al guardar favoritos: ${res.status}`)
}

/** Lee la configuración desde el servidor. */
export async function pullSettings(): Promise<unknown> {
  const res = await request(`${ENDPOINT}/settings`, { method: 'GET' })
  if (!res.ok) throw new Error(`Error al leer configuración: ${res.status}`)
  return res.json()
}

/** Guarda la configuración en el servidor. */
export async function pushSettings(settings: unknown): Promise<void> {
  const res = await request(`${ENDPOINT}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error(`Error al guardar configuración: ${res.status}`)
}
