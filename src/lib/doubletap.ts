/**
 * Tiempo (ms) que el gesto queda armado esperando el segundo toque.
 * Es generoso a propósito: es un acceso secundario a una opción oculta y
 * en un móvil los toques no salen tan seguidos como en un ratón.
 */
export const DOUBLE_TAP_WINDOW_MS = 2000

export type DoubleTapAction = 'arm' | 'fire'

/**
 * Decide qué hacer con un toque: si el gesto ya estaba armado y no ha
 * caducado, lo completa; si no, lo arma para el siguiente toque.
 * `armedAt` es la marca de tiempo del toque que armó el gesto (0 si no hay).
 */
export function doubleTapAction(
  armedAt: number,
  now: number,
  windowMs: number = DOUBLE_TAP_WINDOW_MS,
): DoubleTapAction {
  if (armedAt === 0) return 'arm'
  return now - armedAt < windowMs ? 'fire' : 'arm'
}
