import { useEffect, useState } from 'react'
import { isStandalone } from '../lib/pwa'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/**
 * Estado compartido del aviso de instalación: el navegador puede disparar
 * `beforeinstallprompt` antes de que React monte, así que se escucha al cargar
 * el módulo y cada componente se suscribe después.
 */
let deferred: InstallPromptEvent | null = null
const listeners = new Set<(event: InstallPromptEvent | null) => void>()

function publish(event: InstallPromptEvent | null) {
  deferred = event
  listeners.forEach((listener) => listener(event))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sin preventDefault el navegador mostraría su propio aviso y perderíamos el botón.
    event.preventDefault()
    publish(event as InstallPromptEvent)
  })

  window.addEventListener('appinstalled', () => publish(null))
}

export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(deferred)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    listeners.add(setEvent)
    return () => {
      listeners.delete(setEvent)
    }
  }, [])

  const install = async (): Promise<boolean> => {
    if (!deferred) return false

    const prompt = deferred
    // Tras usarlo, el evento queda gastado: hay que pedir uno nuevo al navegador.
    publish(null)

    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    return outcome === 'accepted'
  }

  return {
    canInstall: event !== null && !installed,
    installed,
    install,
  }
}
