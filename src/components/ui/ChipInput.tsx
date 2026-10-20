import { useState } from 'react'
import { Plus, X } from 'lucide-react'

export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  hint?: string
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim().replace(/,$/, '')
    if (!value) return
    if (!values.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value])
    }
    setDraft('')
  }

  return (
    <div className="chip-field">
      <div className="field-label">{label}</div>
      <div className="chip-input">
        {values.map((value) => (
          <span className="chip" key={value}>
            {value}
            <button
              type="button"
              aria-label={`Quitar ${value}`}
              onClick={() => onChange(values.filter((entry) => entry !== value))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add()
            } else if (event.key === 'Backspace' && !draft && values.length > 0) {
              onChange(values.slice(0, -1))
            }
          }}
        />
        <button
          type="button"
          className="chip-add"
          aria-label="Añadir"
          disabled={!draft.trim()}
          onClick={add}
        >
          <Plus size={14} />
        </button>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
