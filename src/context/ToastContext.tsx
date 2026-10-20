import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { ToastContext, type Toast, type ToastApi } from './toast'

const ICONS = {
  default: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<number[]>([])

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: Toast['tone'] = 'default', action?: Toast['action']) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
      setToasts((current) => [...current.slice(-3), { id, message, tone, action }])
      const timer = window.setTimeout(() => remove(id), action ? 6500 : 3800)
      timers.current.push(timer)
    },
    [remove],
  )

  const value = useMemo<ToastApi>(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.tone]
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className={`toast toast-${toast.tone}`}
              >
                <Icon size={17} />
                <span>{toast.message}</span>
                {toast.action && (
                  <a
                    className="toast-action"
                    href={toast.action.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {toast.action.label}
                  </a>
                )}
                <button
                  type="button"
                  className="toast-close"
                  aria-label="Cerrar aviso"
                  onClick={() => remove(toast.id)}
                >
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
