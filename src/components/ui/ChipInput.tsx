import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { SuggestList } from './TagSuggest'
import { useTagSuggest } from '../../hooks/useTagSuggest'
import type { ProviderId } from '../../types'

export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
  provider = 'danbooru',
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  hint?: string
  /** Fuente cuyas sugerencias de tags se proponen. */
  provider?: ProviderId
}) {
  const [draft, setDraft] = useState('')

  const commit = (value: string) => {
    const clean = value.trim().replace(/,$/, '')
    if (!clean) return
    if (!values.some((entry) => entry.toLowerCase() === clean.toLowerCase())) {
      onChange([...values, clean])
    }
    setDraft('')
  }

  // Los filtros se escriben a mano y es fácil equivocarse con los guiones
  // bajos: el desplegable propone los tags tal y como los conoce la fuente.
  const suggest = useTagSuggest({
    value: draft,
    provider,
    onPick: (completed) => commit(completed),
  })

  return (
    <div className="chip-field">
      <div className="field-label">{label}</div>
      <div className="chip-input-wrap">
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
            role="combobox"
            aria-expanded={suggest.open}
            aria-controls={suggest.listId}
            aria-autocomplete="list"
            aria-activedescendant={
              suggest.open ? suggest.optionId(suggest.active) : undefined
            }
            onChange={(event) => setDraft(event.target.value)}
            onFocus={suggest.onFocus}
            onBlur={suggest.onBlur}
            onKeyDown={(event) => {
              suggest.onKeyDown(event)
              if (event.defaultPrevented) return

              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                commit(draft)
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
            onClick={() => commit(draft)}
          >
            <Plus size={14} />
          </button>
        </div>

        {suggest.open && (
          <SuggestList
            id={suggest.listId}
            items={suggest.items}
            active={suggest.active}
            fragment={suggest.fragment}
            onPick={suggest.pick}
            onHover={suggest.hover}
            label={`Sugerencias para ${label}`}
          />
        )}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
