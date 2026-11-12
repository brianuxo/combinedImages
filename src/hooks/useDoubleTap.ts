import { useCallback, useEffect, useRef } from 'react'
import { DOUBLE_TAP_WINDOW_MS, doubleTapAction } from '../lib/doubletap'

/**
 * Devuelve un manejador que distingue el doble toque del toque simple.
 * Sirve para abrir opciones ocultas sin depender del teclado: en el móvil no
 * hay forma de pulsar F.
 *
 * El primer toque arma el gesto y avisa con `onArm`; el siguiente lo
 * completa, siempre que llegue dentro de la ventana. Si la ventana caduca
 * sin segundo toque, `onDisarm` avisa para retirar la pista.
 */
export function useDoubleTap(
  onDoubleTap: () => void,
  onArm?: () => void,
  onDisarm?: () => void,
) {
  const armedAt = useRef(0)
  const timer = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => clear, [clear])

  return useCallback(() => {
    const now = Date.now()

    if (doubleTapAction(armedAt.current, now) === 'fire') {
      armedAt.current = 0
      clear()
      onDoubleTap()
      return
    }

    armedAt.current = now
    onArm?.()
    clear()
    timer.current = window.setTimeout(() => {
      timer.current = null
      armedAt.current = 0
      onDisarm?.()
    }, DOUBLE_TAP_WINDOW_MS)
  }, [clear, onArm, onDisarm, onDoubleTap])
}
