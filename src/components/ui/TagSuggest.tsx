import { CornerDownLeft } from 'lucide-react'
import { displayTag, highlightTag } from '../../lib/suggestions'

/**
 * Lista de sugerencias. Va con `position: absolute`, así que el contenedor
 * tiene que ser `position: relative` (`.search-wrap`, `.chip-input-wrap`).
 */
export function SuggestList({
  id,
  items,
  active,
  fragment,
  onPick,
  onHover,
  label,
}: {
  id: string
  items: string[]
  active: number
  fragment: string
  onPick: (index: number) => void
  onHover: (index: number) => void
  label: string
}) {
  return (
    <div className="suggest">
      <ul id={id} role="listbox" aria-label={label}>
        {items.map((tag, index) => {
          const parts = highlightTag(tag, fragment)
          return (
            <li
              key={tag}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`suggest-item ${index === active ? 'is-active' : ''}`}
              // Sin `preventDefault` el input pierde el foco antes del click.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onHover(index)}
              onClick={() => onPick(index)}
            >
              <span className="suggest-text">
                {parts ? (
                  <>
                    {parts.before}
                    <mark>{parts.match}</mark>
                    {parts.after}
                  </>
                ) : (
                  displayTag(tag)
                )}
              </span>
              <CornerDownLeft size={12} className="suggest-enter" aria-hidden="true" />
            </li>
          )
        })}
      </ul>
      <p className="suggest-hint">
        <kbd>↑</kbd>
        <kbd>↓</kbd> para elegir · <kbd>Enter</kbd> para buscar
      </p>
    </div>
  )
}
