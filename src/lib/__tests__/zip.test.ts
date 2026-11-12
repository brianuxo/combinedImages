import { describe, expect, it } from 'vitest'
import { ZipWriter, crc32 } from '../zip'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function uint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}

function uint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true)
}

interface LocalEntry {
  name: string
  data: Uint8Array
  crc: number
  flags: number
  method: number
}

/** Lee las cabeceras locales hasta el directorio central. */
function readLocalEntries(bytes: Uint8Array): LocalEntry[] {
  const entries: LocalEntry[] = []
  let offset = 0

  while (offset + 4 <= bytes.length && uint32(bytes, offset) === 0x04034b50) {
    const flags = uint16(bytes, offset + 6)
    const method = uint16(bytes, offset + 8)
    const crc = uint32(bytes, offset + 14)
    const size = uint32(bytes, offset + 18)
    const nameLength = uint16(bytes, offset + 26)
    const extraLength = uint16(bytes, offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength

    entries.push({
      name: decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)),
      data: bytes.subarray(dataStart, dataStart + size),
      crc,
      flags,
      method,
    })

    offset = dataStart + size
  }

  return entries
}

interface EndRecord {
  count: number
  size: number
  offset: number
}

function readEndRecord(bytes: Uint8Array): EndRecord {
  const start = bytes.length - 22
  expect(uint32(bytes, start)).toBe(0x06054b50)
  return {
    count: uint16(bytes, start + 10),
    size: uint32(bytes, start + 12),
    offset: uint32(bytes, start + 16),
  }
}

describe('crc32', () => {
  it('coincide con el valor de referencia del estándar', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926)
  })

  it('el vacío da 0', () => {
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('ZipWriter', () => {
  it('arma un ZIP sin compresión con todos los archivos', async () => {
    const writer = new ZipWriter()
    writer.add('konachan-1.png', encoder.encode('imagen uno'))
    writer.add('yandere-2.jpeg', encoder.encode('imagen dos'))

    const blob = writer.finish()
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const entries = readLocalEntries(bytes)
    const end = readEndRecord(bytes)

    expect(blob.type).toBe('application/zip')
    expect(entries).toHaveLength(2)
    expect(entries[0].name).toBe('konachan-1.png')
    expect(decoder.decode(entries[0]?.data)).toBe('imagen uno')
    expect(entries[0]?.crc).toBe(crc32(encoder.encode('imagen uno')))
    expect(entries[0]?.method).toBe(0)
    expect(entries[1].name).toBe('yandere-2.jpeg')
    expect(decoder.decode(entries[1]?.data)).toBe('imagen dos')

    expect(end.count).toBe(2)
    expect(end.offset).toBe(writer.size)
    expect(bytes.length).toBe(writer.size + end.size + 22)
  })

  it('marca los nombres como UTF-8', async () => {
    const writer = new ZipWriter()
    writer.add('kanachan-ñandú.png', encoder.encode('x'))

    const bytes = new Uint8Array(await writer.finish().arrayBuffer())
    const entries = readLocalEntries(bytes)

    expect(entries[0]?.flags).toBe(0x0800)
    expect(entries[0]?.name).toBe('kanachan-ñandú.png')
  })

  it('un ZIP vacío es solo el registro final', async () => {
    const writer = new ZipWriter()
    const bytes = new Uint8Array(await writer.finish().arrayBuffer())

    expect(writer.count).toBe(0)
    expect(writer.size).toBe(0)
    expect(bytes).toHaveLength(22)
    expect(readEndRecord(bytes)).toEqual({ count: 0, size: 0, offset: 0 })
  })

  it('suma los tamaños de cabecera, datos y directorio', async () => {
    const writer = new ZipWriter()
    writer.add('a.txt', encoder.encode('hola'))
    writer.add('b.txt', encoder.encode('mundo'))

    const headerSize = (name: string) => 30 + encoder.encode(name).length
    const expected = headerSize('a.txt') + 4 + headerSize('b.txt') + 5

    expect(writer.size).toBe(expected)
  })
})
