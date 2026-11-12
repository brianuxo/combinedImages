import { describe, expect, it } from 'vitest'
import { DOUBLE_TAP_WINDOW_MS, doubleTapAction } from '../doubletap'

describe('doubleTapAction', () => {
  it('el primer toque arma el gesto', () => {
    expect(doubleTapAction(0, 1000)).toBe('arm')
  })

  it('el segundo toque dentro de la ventana lo completa', () => {
    expect(doubleTapAction(1000, 1000 + DOUBLE_TAP_WINDOW_MS - 1)).toBe('fire')
  })

  it('pasada la ventana, el toque vuelve a armar el gesto', () => {
    expect(doubleTapAction(1000, 1000 + DOUBLE_TAP_WINDOW_MS)).toBe('arm')
  })

  it('un gesto armado nunca se completa a sí mismo', () => {
    expect(doubleTapAction(1000, 1000)).toBe('fire')
    expect(doubleTapAction(0, 5000)).toBe('arm')
  })
})
