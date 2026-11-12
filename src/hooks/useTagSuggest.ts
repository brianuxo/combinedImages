import { useCallback, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { completeTag, lastToken, suggestTags } from '../lib/suggestions'
import type { ProviderId } from '../types'

export interface TagSuggestOptions {
  value: string
  provider: ProviderId
  /** Recibe el texto completo ya completado y el tag elegido. */
  onPick: (value: string, tag: string) => void
  limit?: number
  enabled?: boolean
}

export interface TagSuggestApi {
  open: boolean
  items: string[]
  /** Índice resaltado con las flechas. */
  active: number
  /** Lo que se está escribiendo en el último término. */
  fragment: string
  listId: string
  optionId: (index: number) => string
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  pick: (index: number) => void
  hover: (index: number) => void
}

/**
 * Estado del desplegable de sugerencias para un input.
 *
 * Se separa del marcado para poder usarlo tanto en el buscador como en los
 * campos de filtros, que tienen estructuras distintas.
 */
export function useTagSuggest({
  value,
  provider,
  onPick,
  limit = 8,
  enabled = true,
}: TagSuggestOptions): TagSuggestApi {
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  // Se recuerda para qué texto se cerró: al seguir escribiendo vuelve a abrirse.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  const items = useMemo(
    () => (enabled ? suggestTags(value, { provider, limit }) : []),
    [enabled, limit, provider, value],
  )

  const fragment = lastToken(value)
  const open = enabled && focused && items.length > 0 && dismissedFor !== value
  const activeIndex = Math.min(active, Math.max(0, items.length - 1))

  const pick = useCallback(
    (index: number) => {
      const tag = items[index]
      if (!tag) return
      const completed = completeTag(value, tag)
      setDismissedFor(completed)
      setActive(0)
      onPick(completed, tag)
    },
    [items, onPick, value],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (event.key === 'ArrowDown' && items.length > 0) {
          event.preventDefault()
          setFocused(true)
          setActive(0)
        }
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((current) => (current + 1) % items.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((current) => (current - 1 + items.length) % items.length)
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        pick(activeIndex)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setDismissedFor(value)
      }
    },
    [activeIndex, items.length, open, pick, value],
  )

  return {
    open,
    items,
    active: activeIndex,
    fragment,
    listId,
    optionId: (index: number) => `${listId}-${index}`,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onKeyDown,
    pick,
    hover: setActive,
  }
}
