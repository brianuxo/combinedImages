import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { distributeByColumn, masonryMetrics, type MasonryMetrics } from '../lib/masonry'
import type { ImageItem } from '../types'

/**
 * Reparte las imágenes en columnas que llenan el ancho disponible.
 *
 * El número de columnas depende del ancho, así que se mide el contenedor con
 * un `ResizeObserver`. La ref es un callback para volver a observar cuando
 * cambia el nodo (por ejemplo cuando el esqueleto da paso a las tarjetas
 * reales) y no solo cuando se monta.
 */
export function useMasonry(items: ImageItem[]) {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [metrics, setMetrics] = useState<MasonryMetrics>(() =>
    masonryMetrics(0, window.innerWidth),
  )

  const measure = useCallback(() => {
    const node = nodeRef.current
    if (!node) return
    const next = masonryMetrics(node.getBoundingClientRect().width, window.innerWidth)
    setMetrics((prev) =>
      prev.columns === next.columns &&
      prev.gap === next.gap &&
      Math.abs(prev.columnWidth - next.columnWidth) < 0.5
        ? prev
        : next,
    )
  }, [])

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      nodeRef.current = node
      if (!node) return
      observerRef.current = new ResizeObserver(measure)
      observerRef.current.observe(node)
    },
    [measure],
  )

  // `useLayoutEffect` para que el primer pintado ya use las columnas
  // correctas y no se vea un destello con una sola columna.
  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const columns = useMemo(() => distributeByColumn(items, metrics), [items, metrics])

  return { ref, columns, metrics }
}
