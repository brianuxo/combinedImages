import type { Quality } from '../types'

export const QUALITY_LIMITS = {
  /**
   * Tope del lado mayor (ancho o alto, en píxeles) de las imágenes que se
   * *muestran* (miniaturas y vista ampliada). `0` = sin tope. La descarga
   * siempre usa el archivo original de la fuente.
   */
  max: { perPage: 36, autoCap: Number.POSITIVE_INFINITY, step: 36, skeletons: 12, maxSide: 0 },
  general: {
    perPage: 28,
    autoCap: Number.POSITIVE_INFINITY,
    step: 28,
    skeletons: 12,
    maxSide: 2984,
  },
  /**
   * Modo mini: la primera página se queda en 12 tarjetas y el resto se pide
   * a mano. En un móvil la diferencia de datos y de scroll es enorme.
   */
  optimo: { perPage: 12, autoCap: 12, step: 12, skeletons: 6, maxSide: 1920 },
} as const

/** Tope de resolución (px en el lado mayor) para mostrar imágenes; 0 = sin tope. */
export function maxSideFor(quality: Quality): number {
  return QUALITY_LIMITS[quality].maxSide
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('es', { notation: 'compact' }).format(value)
}

export function readableError(error: Error | null): string {
  if (!error) return ''
  if (error.name === 'ProxyRequiredError') {
    return 'Esta fuente no permite peticiones directas desde el navegador.'
  }
  if (error.name === 'AuthRequiredError') {
    return 'Falta la clave API o el ID de usuario de esta fuente.'
  }
  if (error.name === 'HttpError') {
    const status = (error as Error & { status?: number }).status
    if (status === 401 || status === 403) {
      return 'La clave API no es válida o no tiene permisos para esta búsqueda.'
    }
    if (status === 400) {
      return 'La búsqueda no es válida o la clave API es incorrecta.'
    }
    if (status === 429) return 'Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo.'
    if (status === 503) return 'La fuente está caída o en mantenimiento. Prueba con otra.'
    if (status && status >= 500) return 'La fuente está teniendo problemas. Inténtalo más tarde.'
    if (status === 404) return 'La fuente no encontró resultados para esa búsqueda.'
    return `La fuente respondió con un error (${status ?? 'desconocido'}).`
  }
  if (error.name === 'AbortError') return 'Petición cancelada.'
  return 'No se pudo conectar con la fuente. Revisa tu conexión o configura un proxy.'
}
