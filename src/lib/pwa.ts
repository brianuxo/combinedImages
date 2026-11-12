/** Registro del service worker y detección de la app instalada. */

type StandaloneEnv = {
  matchMedia?: (query: string) => { matches: boolean }
  navigator?: { standalone?: boolean }
}

/** true cuando la página corre como app instalada (ventana propia o pantalla de inicio). */
export function isStandalone(env: StandaloneEnv = window as unknown as StandaloneEnv): boolean {
  const displayMode = env.matchMedia?.('(display-mode: standalone)')
  return displayMode?.matches === true || env.navigator?.standalone === true
}

/**
 * Registra /sw.js solo en la build de producción: en desarrollo el service worker
 * estorbaría al refresco en caliente. HTTPS (o localhost) es obligatorio.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Sin service worker la app sigue funcionando; solo se pierde el arranque sin red.
      })
  })
}
