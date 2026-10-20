import { createContext, useContext } from 'react'

export type ToastTone = 'default' | 'success' | 'warn' | 'error'

export interface ToastAction {
  label: string
  href: string
}

export interface Toast {
  id: string
  message: string
  tone: ToastTone
  action?: ToastAction
}

export interface ToastApi {
  push: (message: string, tone?: ToastTone, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context
}
