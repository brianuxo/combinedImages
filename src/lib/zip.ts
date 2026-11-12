/**
 * Escritor de ZIP mínimo, sin compresión.
 *
 * Las imágenes (JPEG, PNG, WebP) ya vienen comprimidas, así que volver a
 * comprimirlas solo gastaría CPU. Guardarlas tal cual permite además armar el
 * ZIP sin dependencias y sin tener que cargar una librería entera en el
 * navegador.
 *
 * El formato está en la especificación PKWARE: cabecera local + datos por
 * archivo, directorio central y registro de fin de directorio.
 */

const encoder = new TextEncoder()

/** Firma de cada bloque del formato. */
const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_RECORD = 0x06054b50

/** Versión 2.0: es la que entienden todos los descompresores. */
const VERSION = 20

/** Bit 11: los nombres van en UTF-8 (acentos y paréntesis sin romperse). */
const FLAG_UTF8 = 0x0800

/** Sin compresión: el tamaño comprimido es el real. */
const METHOD_STORE = 0

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Fecha en el formato de MS-DOS que usa el ZIP (precisión de 2 segundos). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time:
      (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

interface Entry {
  name: Uint8Array
  crc: number
  size: number
  offset: number
  time: number
  date: number
}

export class ZipWriter {
  private parts: Uint8Array[] = []
  private entries: Entry[] = []
  private offset = 0

  /** Bytes de archivos añadidos hasta ahora (sin contar el directorio). */
  get size(): number {
    return this.offset
  }

  get count(): number {
    return this.entries.length
  }

  add(name: string, data: Uint8Array): void {
    const nameBytes = encoder.encode(name)
    const crc = crc32(data)
    const stamp = dosDateTime(new Date())

    const header = new Uint8Array(30 + nameBytes.length)
    const view = new DataView(header.buffer)
    view.setUint32(0, LOCAL_HEADER, true)
    view.setUint16(4, VERSION, true)
    view.setUint16(6, FLAG_UTF8, true)
    view.setUint16(8, METHOD_STORE, true)
    view.setUint16(10, stamp.time, true)
    view.setUint16(12, stamp.date, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, nameBytes.length, true)
    view.setUint16(28, 0, true)
    header.set(nameBytes, 30)

    this.entries.push({
      name: nameBytes,
      crc,
      size: data.length,
      offset: this.offset,
      time: stamp.time,
      date: stamp.date,
    })

    this.parts.push(header, data)
    this.offset += header.length + data.length
  }

  /** Cierra el ZIP: directorio central y registro final. */
  finish(): Blob {
    const centralStart = this.offset
    let centralSize = 0

    for (const entry of this.entries) {
      const header = new Uint8Array(46 + entry.name.length)
      const view = new DataView(header.buffer)
      view.setUint32(0, CENTRAL_HEADER, true)
      view.setUint16(4, VERSION, true)
      view.setUint16(6, VERSION, true)
      view.setUint16(8, FLAG_UTF8, true)
      view.setUint16(10, METHOD_STORE, true)
      view.setUint16(12, entry.time, true)
      view.setUint16(14, entry.date, true)
      view.setUint32(16, entry.crc, true)
      view.setUint32(20, entry.size, true)
      view.setUint32(24, entry.size, true)
      view.setUint16(28, entry.name.length, true)
      view.setUint16(30, 0, true)
      view.setUint16(32, 0, true)
      view.setUint16(34, 0, true)
      view.setUint16(36, 0, true)
      view.setUint32(38, 0, true)
      view.setUint32(42, entry.offset, true)
      header.set(entry.name, 46)

      this.parts.push(header)
      centralSize += header.length
    }

    const end = new Uint8Array(22)
    const view = new DataView(end.buffer)
    view.setUint32(0, END_RECORD, true)
    view.setUint16(4, 0, true)
    view.setUint16(6, 0, true)
    view.setUint16(8, this.entries.length, true)
    view.setUint16(10, this.entries.length, true)
    view.setUint32(12, centralSize, true)
    view.setUint32(16, centralStart, true)
    view.setUint16(20, 0, true)

    this.parts.push(end)
    return new Blob(this.parts as BlobPart[], { type: 'application/zip' })
  }
}
