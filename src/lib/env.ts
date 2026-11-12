/**
 * Entorno de ejecución de la app.
 *
 * Vive aparte porque `src/lib/proxy.ts` lo compila también el proyecto de
 * Node (lo usa `vite.config.ts`), y ese proyecto no tiene DOM.
 */

/** La app servida desde localhost puede usar el proxy de Vite (dev y preview). */
export function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

/** ¿Estamos en el servidor de desarrollo? */
export function isDevServer(): boolean {
  return import.meta.env.DEV
}

/**
 * ¿El servidor que sirve la app reenvía `/proxy/*` y `/media`?
 *
 * Es el caso de `npm run dev` y `npm run preview`, y también el de un
 * despliegue propio montado igual (por ejemplo `vite preview` en una máquina
 * remota): ese build se compila con `VITE_SERVER_PROXY=1`.
 */
export function hasServerProxy(): boolean {
  return isDevServer() || isLocalHost() || import.meta.env.VITE_SERVER_PROXY === '1'
}
