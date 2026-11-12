import { useCallback, useState } from 'react'
import { useSettings } from '../context/settings'
import { useDoubleTap } from './useDoubleTap'

/**
 * Doble toque sobre la versión para mostrar u ocultar las opciones de contenido
 * adulto. En el móvil no hay teclado para pulsar F, así que el gesto vive en
 * la versión del pie de inicio y en la de Ajustes.
 *
 * Devuelve el manejador del toque y si el gesto está armado a la espera del
 * segundo toque, para poder explicar la siguiente pulsación.
 */
export function useVersionTap(onToggle: () => void) {
  const [armed, setArmed] = useState(false)
  const { settings } = useSettings()

  const onDoubleTap = useCallback(() => {
    setArmed(false)
    onToggle()
  }, [onToggle])

  const onArm = useCallback(() => setArmed(true), [])
  const onDisarm = useCallback(() => setArmed(false), [])

  const onTap = useDoubleTap(onDoubleTap, onArm, onDisarm)

  return { onTap, armed, action: settings.nsfw.unlocked ? 'ocultar' : 'mostrar' }
}
