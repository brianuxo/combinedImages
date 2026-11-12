/*
 * Cifrado del paquete de sincronización.
 *
 * La instancia guarda un texto cifrado y nunca ve las claves API ni los
 * favoritos en claro. La frase que se escribe en cada dispositivo se
 * convierte en una clave con PBKDF2 (sal aleatoria por paquete) y el
 * contenido se sella con AES-GCM, que también detecta una frase incorrecta.
 *
 * Formato del blob: base64(JSON({ v, salt, iv, data })). Todo son datos
 * públicos salvo `data`.
 */

const VERSION = 1
const ITERATIONS = 210_000
const SALT_BYTES = 16
const IV_BYTES = 12

/*
 * Credencial de conexión: se deriva de la frase con PBKDF2 y sal fija (pública,
 * no guarda secretos) y viaja como Bearer. El servidor solo guarda su hash
 * SHA-256, así que la frase nunca llega ni en claro ni descifrable.
 */
const AUTH_ITERATIONS = 100_000
const AUTH_SALT = new TextEncoder().encode('combined-sync-auth-v1')

interface SealedPayload {
  v: number
  salt: string
  iv: string
  data: string
}

export class SyncCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncCryptoError'
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Deriva la credencial Bearer que autoriza la conexión con la instancia. */
export async function deriveAuthToken(passphrase: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: AUTH_SALT as unknown as BufferSource,
      iterations: AUTH_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    256,
  )

  let hex = ''
  for (const byte of new Uint8Array(bits)) hex += byte.toString(16).padStart(2, '0')
  return hex
}

/** Cifra un valor JSON y devuelve el blob listo para guardar. */
export async function sealPayload(passphrase: string, value: unknown): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext,
  )

  const sealed: SealedPayload = {
    v: VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  }

  return toBase64(new TextEncoder().encode(JSON.stringify(sealed)))
}

/** Descifra un blob; lanza `SyncCryptoError` si no se puede. */
export async function openPayload<T = unknown>(
  passphrase: string,
  blob: string,
): Promise<T> {
  let sealed: SealedPayload
  try {
    sealed = JSON.parse(new TextDecoder().decode(fromBase64(blob))) as SealedPayload
  } catch {
    throw new SyncCryptoError('El paquete guardado no tiene el formato esperado.')
  }

  if (sealed.v !== VERSION || !sealed.salt || !sealed.iv || !sealed.data) {
    throw new SyncCryptoError('El paquete guardado no tiene el formato esperado.')
  }

  try {
    const key = await deriveKey(passphrase, fromBase64(sealed.salt))
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv) as unknown as BufferSource },
      key,
      fromBase64(sealed.data) as unknown as BufferSource,
    )
    return JSON.parse(new TextDecoder().decode(plaintext)) as T
  } catch {
    throw new SyncCryptoError('La frase de sincronización no coincide.')
  }
}
