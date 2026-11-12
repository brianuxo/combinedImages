import { describe, expect, it } from 'vitest'
import {
  distributeByColumn,
  imageRatio,
  isExtremeRatio,
  masonryMetrics,
  type MasonryItem,
} from '../masonry'

function makeItems(count: number, offset = 0): MasonryItem[] {
  const sizes: Array<[number, number]> = [
    [1920, 1080],
    [1080, 1920],
    [1600, 1200],
    [1200, 1600],
    [2560, 1440],
    [800, 1200],
    [1400, 2100],
    [1920, 1200],
  ]
  return Array.from({ length: count }, (_, index) => {
    const [width, height] = sizes[(index + offset) % sizes.length]
    return { key: `item-${index + offset}`, width, height }
  })
}

describe('imageRatio', () => {
  it('usa la proporción real de la imagen', () => {
    expect(imageRatio({ width: 1920, height: 1080 })).toBeCloseTo(16 / 9)
  })

  it('recorta las proporciones extremas', () => {
    expect(imageRatio({ width: 100, height: 2000 })).toBe(0.5)
    expect(imageRatio({ width: 2000, height: 100 })).toBe(2.4)
  })

  it('usa 3/4 cuando la API no da dimensiones', () => {
    expect(imageRatio({ width: 0, height: 0 })).toBe(0.75)
  })
})

describe('isExtremeRatio', () => {
  it('marca panorámicas y tiras verticales', () => {
    expect(isExtremeRatio({ width: 3000, height: 800 })).toBe(true)
    expect(isExtremeRatio({ width: 800, height: 3000 })).toBe(true)
  })

  it('deja pasar las proporciones normales', () => {
    expect(isExtremeRatio({ width: 1920, height: 1080 })).toBe(false)
    expect(isExtremeRatio({ width: 1080, height: 1920 })).toBe(false)
    expect(isExtremeRatio({ width: 0, height: 0 })).toBe(false)
  })
})

describe('masonryMetrics', () => {
  it('usa 4 columnas en escritorio', () => {
    const metrics = masonryMetrics(1282, 1400)
    expect(metrics.columns).toBe(4)
    expect(metrics.gap).toBe(14)
    expect(metrics.columnWidth).toBeCloseTo(310)
  })

  it('reduce columnas cuando el ancho no da para cuatro', () => {
    expect(masonryMetrics(600, 1400).columns).toBe(3)
    expect(masonryMetrics(400, 1400).columns).toBe(2)
  })

  it('usa 2 columnas en móvil ancho', () => {
    const metrics = masonryMetrics(700, 600)
    expect(metrics.columns).toBe(2)
    expect(metrics.gap).toBe(10)
  })

  it('usa 1 columna en pantallas estrechas', () => {
    const metrics = masonryMetrics(358, 390)
    expect(metrics.columns).toBe(1)
    expect(metrics.gap).toBe(10)
    expect(metrics.columnWidth).toBeCloseTo(358)
  })

  it('nunca devuelve menos de una columna', () => {
    expect(masonryMetrics(0, 1400).columns).toBe(1)
    expect(masonryMetrics(10, 600).columns).toBe(1)
  })
})

describe('distributeByColumn', () => {
  const metrics = masonryMetrics(1282, 1400)

  it('reparte todas las imágenes', () => {
    const items = makeItems(28)
    const columns = distributeByColumn(items, metrics)
    expect(columns.flat()).toHaveLength(28)
    expect(columns).toHaveLength(metrics.columns)
  })

  it('no pierde ni duplica ninguna imagen', () => {
    const items = makeItems(28)
    const columns = distributeByColumn(items, metrics)
    const flat = columns.flat().map((item) => item.key)
    expect(flat).toHaveLength(28)
    expect(new Set(flat).size).toBe(28)
    expect([...flat].sort()).toEqual(items.map((item) => item.key).sort())
  })

  it('respeta el orden original dentro de cada columna', () => {
    const items = makeItems(28)
    const columns = distributeByColumn(items, metrics)
    const position = new Map(items.map((item, index) => [item.key, index]))
    for (const column of columns) {
      const indexes = column.map((item) => position.get(item.key) as number)
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b))
    }
  })

  it('no mueve ninguna tarjeta al añadir una página nueva', () => {
    const first = makeItems(28)
    const second = makeItems(28, 28)

    const before = distributeByColumn(first, metrics)
    const after = distributeByColumn([...first, ...second], metrics)

    // La posición de las N primeras imágenes no depende de las siguientes:
    // al paginar, ninguna tarjeta cambia de sitio.
    for (let column = 0; column < metrics.columns; column += 1) {
      const previous = before[column].map((item) => item.key)
      const current = after[column].slice(0, previous.length).map((item) => item.key)
      expect(current).toEqual(previous)
    }
  })

  it('coloca cada imagen en la columna más corta', () => {
    const items = makeItems(8)
    const columns = distributeByColumn(items, metrics)
    // Con 8 imágenes y 4 columnas, las dos primeras van a columnas distintas.
    expect(columns[0][0].key).toBe('item-0')
    expect(columns[1][0].key).toBe('item-1')
  })
})
