import { describe, expect, it } from 'vitest'
import { isStandalone } from '../pwa'

describe('isStandalone', () => {
  it('detecta la ventana propia de la app instalada', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: true }) })).toBe(true)
  })

  it('usa navigator.standalone en iOS', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).toBe(
      true,
    )
  })

  it('en una pestaña normal no está instalada', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false)
  })

  it('no falla si el navegador no tiene matchMedia', () => {
    expect(isStandalone({})).toBe(false)
  })
})
