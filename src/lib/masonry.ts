/** Datos mínimos que necesita el masonry de una tarjeta. */
export interface MasonryItem {
  key: string
  width: number
  height: number
}

/**
 * Medidas del masonry. Reproducen las reglas que usaba antes la propiedad
 * CSS `columns` (4 columnas de 170px con 14px de separación en escritorio,
 * 2 columnas de 140px con 10px en móvil).
 */
export const MASONRY_BREAKPOINT = 720
/** Por debajo de este ancho la galería va a una columna: tarjetas grandes. */
export const MASONRY_ONE_COLUMN = 560
export const MASONRY_GAP = 14
export const MASONRY_GAP_MOBILE = 10
export const MASONRY_MIN_COLUMN = 170
export const MASONRY_MIN_COLUMN_MOBILE = 140
export const MASONRY_MAX_COLUMNS = 4
export const MASONRY_MAX_COLUMNS_MOBILE = 2

/** Límites de proporción de la tarjeta. */
export const IMAGE_RATIO_MIN = 0.5
export const IMAGE_RATIO_MAX = 2.4

/** Borde de `.img-card` (1px por lado), incluido en el cálculo de altura. */
const CARD_BORDER = 2

export interface MasonryMetrics {
  /** Número de columnas. */
  columns: number
  /** Separación entre tarjetas y entre columnas, en px. */
  gap: number
  /** Ancho de cada columna, en px. */
  columnWidth: number
}

/**
 * Proporción de la tarjeta, recortada para que nunca sea extrema. Es el
 * mismo valor que `ImageCard` aplica como `aspect-ratio`, así que la altura
 * calculada coincide exactamente con la que se pinta en el DOM.
 */
export function imageRatio(item: Pick<MasonryItem, 'width' | 'height'>): number {
  return item.width > 0 && item.height > 0
    ? Math.min(IMAGE_RATIO_MAX, Math.max(IMAGE_RATIO_MIN, item.width / item.height))
    : 0.75
}

/**
 * Las imágenes muy panorámicas o muy verticales se recortarían demasiado con
 * `cover`; en esos casos la tarjeta las muestra completas (`contain`).
 */
export function isExtremeRatio(item: Pick<MasonryItem, 'width' | 'height'>): boolean {
  if (!(item.width > 0) || !(item.height > 0)) return false
  const ratio = item.width / item.height
  return ratio > IMAGE_RATIO_MAX || ratio < IMAGE_RATIO_MIN
}

/**
 * Número de columnas y separación para el ancho disponible, con las mismas
 * reglas que aplicaba el atajo `columns` de CSS. En pantallas estrechas se
 * usa una sola columna: así las imágenes se ven grandes y sin recortes.
 */
export function masonryMetrics(
  containerWidth: number,
  viewportWidth: number,
): MasonryMetrics {
  const mobile = viewportWidth <= MASONRY_BREAKPOINT
  const gap = mobile ? MASONRY_GAP_MOBILE : MASONRY_GAP
  const minColumn = mobile ? MASONRY_MIN_COLUMN_MOBILE : MASONRY_MIN_COLUMN
  const maxColumns = mobile ? MASONRY_MAX_COLUMNS_MOBILE : MASONRY_MAX_COLUMNS

  const columns =
    viewportWidth <= MASONRY_ONE_COLUMN
      ? 1
      : Math.max(
          1,
          Math.min(maxColumns, Math.floor((containerWidth + gap) / (minColumn + gap))),
        )
  const columnWidth = (containerWidth - gap * (columns - 1)) / columns

  return { columns, gap, columnWidth }
}

/** Alto en px que ocupará una tarjeta dentro de una columna de ese ancho. */
export function cardHeight(
  item: Pick<MasonryItem, 'width' | 'height'>,
  columnWidth: number,
): number {
  return Math.max(0, (columnWidth - CARD_BORDER) / imageRatio(item) + CARD_BORDER)
}

/**
 * Reparte las imágenes en columnas, colocando siempre la siguiente en la
 * columna más corta.
 *
 * La colocación de las N primeras imágenes no depende de las que llegan
 * después, así que al añadir una página nueva ninguna tarjeta cambia de
 * sitio: el masonry solo crece. Esto es justo lo que el `columns` de CSS no
 * hacía: en cada adición el navegador reequilibraba las columnas y movía
 * las tarjetas que ya estaban en pantalla.
 */
export function distributeByColumn<T extends MasonryItem>(
  items: T[],
  metrics: MasonryMetrics,
): T[][] {
  const { columns, columnWidth, gap } = metrics
  const buckets: T[][] = Array.from({ length: columns }, () => [])
  const heights = new Array<number>(columns).fill(0)

  for (const item of items) {
    let target = 0
    for (let i = 1; i < columns; i += 1) {
      if (heights[i] < heights[target]) target = i
    }
    buckets[target].push(item)
    heights[target] += cardHeight(item, columnWidth) + gap
  }

  return buckets
}
