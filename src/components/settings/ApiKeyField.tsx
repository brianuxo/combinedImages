import { useState } from 'react'
import { Eye, EyeOff, Loader2, Plug } from 'lucide-react'

export function ApiKeyField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  helpUrl,
  helpLabel = 'Cómo obtenerla',
  required = false,
  userId,
  onUserIdChange,
  onTest,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  hint?: string
  helpUrl?: string
  helpLabel?: string
  required?: boolean
  userId?: string
  onUserIdChange?: (value: string) => void
  onTest?: () => Promise<void>
}) {
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)

  return (
    <div className="field">
      <div className="field-label">
        {label}
        <span className={`badge ${required ? 'badge-warn' : ''}`}>
          {required ? 'obligatoria' : 'opcional'}
        </span>
      </div>

      <div className="input-row">
        <input
          className="input"
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-btn small"
          aria-label={show ? `Ocultar ${label}` : `Mostrar ${label}`}
          onClick={() => setShow((previous) => !previous)}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        {onTest && (
          <button
            type="button"
            className="icon-btn small"
            aria-label={`Probar la clave de ${label}`}
            disabled={testing}
            onClick={async () => {
              setTesting(true)
              try {
                await onTest()
              } finally {
                setTesting(false)
              }
            }}
          >
            {testing ? <Loader2 size={16} className="spin" /> : <Plug size={16} />}
          </button>
        )}
      </div>

      {onUserIdChange && (
        <div className="input-row">
          <input
            className="input"
            type="text"
            inputMode="numeric"
            value={userId ?? ''}
            placeholder="User ID"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onUserIdChange(event.target.value)}
          />
        </div>
      )}

      {(hint || helpUrl) && (
        <p className="hint">
          {hint}{' '}
          {helpUrl && (
            <a href={helpUrl} target="_blank" rel="noreferrer">
              {helpLabel}
            </a>
          )}
        </p>
      )}
    </div>
  )
}
