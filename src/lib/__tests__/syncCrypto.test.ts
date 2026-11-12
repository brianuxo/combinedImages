import { describe, expect, it } from 'vitest'
import { deriveAuthToken, openPayload, sealPayload, SyncCryptoError } from '../syncCrypto'

describe('deriveAuthToken', () => {
  it('deriva una credencial estable de 64 caracteres hexadecimales', async () => {
    const first = await deriveAuthToken('mi frase')
    const second = await deriveAuthToken('mi frase')

    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(first).toBe(second)
  })

  it('cambia con la frase y normaliza equivalencias NFKC', async () => {
    const a = await deriveAuthToken('contrase\u00f1a')
    const b = await deriveAuthToken('otra frase')

    expect(a).not.toBe(b)
    await expect(deriveAuthToken('contrasen\u0303a')).resolves.toBe(a)
  })
})

describe('sealPayload / openPayload', () => {
  it('cifra y descifra el mismo objeto', async () => {
    const value = { favoritos: ['a', 'b'], ajustes: { tema: 'oscuro' }, n: 42 }
    const blob = await sealPayload('frase correcta', value)

    expect(typeof blob).toBe('string')
    // El texto en claro no debe aparecer en el paquete.
    expect(blob).not.toContain('oscuro')

    await expect(openPayload('frase correcta', blob)).resolves.toEqual(value)
  })

  it('rechaza una frase incorrecta', async () => {
    const blob = await sealPayload('frase correcta', { a: 1 })

    await expect(openPayload('otra frase', blob)).rejects.toBeInstanceOf(SyncCryptoError)
  })

  it('rechaza un paquete corrupto o con otro formato', async () => {
    await expect(openPayload('x', 'esto-no-es-un-paquete')).rejects.toBeInstanceOf(
      SyncCryptoError,
    )
    await expect(openPayload('x', btoa('{"v":1}'))).rejects.toBeInstanceOf(SyncCryptoError)
  })

  it('usa sal e IV nuevos en cada sellado', async () => {
    const first = await sealPayload('misma frase', { a: 1 })
    const second = await sealPayload('misma frase', { a: 1 })

    expect(first).not.toBe(second)
    await expect(openPayload('misma frase', first)).resolves.toEqual({ a: 1 })
    await expect(openPayload('misma frase', second)).resolves.toEqual({ a: 1 })
  })

  it('normaliza la frase (espacios y acentos compuestos)', async () => {
    const blob = await sealPayload('contrase\u00f1a', { a: 1 })
    await expect(openPayload('contrasen\u0303a', blob)).resolves.toEqual({ a: 1 })
  })
})
