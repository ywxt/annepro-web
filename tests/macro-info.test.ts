import { describe, expect, it } from 'vitest'
import {
  createReadMacroConfigRequest,
  createReadMacroMapRequest,
  createReadMacroActiveListRequest,
  createReadMacroRequest,
  parseMacroActiveListResponse,
  parseMacroConfigResponse,
  parseMacroMapResponse,
  parseStoredMacro,
  crc32,
  macroUuid,
  decodeMacroEvents,
  encodeMacroEvents,
  serializeMacroImage,
  createPrepareMacroImageRequest,
  createDownloadMacroRequests,
  parseMacroWriteAck,
} from '../src/protocol/macro-info.ts'

function response(action: number, payload: number[]): Uint8Array {
  return new Uint8Array([
    0x7b, 0x12, 0x13, 0x00, payload.length + 2, 0x00, 0x00, 0x7d,
    0x30, action, ...payload,
  ])
}

describe('readMacroConfig protocol', () => {
  it('creates the statically identified and physically confirmed request', () => {
    expect(Array.from(createReadMacroConfigRequest())).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x30, 0x06,
    ])
  })

  it('decodes the isolated empty-macro response and ignores HID trailing bytes', () => {
    const frame = new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x04, 0x00, 0x00, 0x7d, 0x30, 0x06, 0x00, 0x00,
    ])
    expect(parseMacroConfigResponse(new Uint8Array([...frame, 0xaa]))).toEqual({
      storedMacroCount: 0,
      unknownByte: 0,
      hasMacros: false,
      rawFrame: frame,
      trailingLength: 1,
    })
  })

  it('encodes event records and ObinsKit-compatible CRC identifiers', () => {
    const events = encodeMacroEvents([{ type: 2, value: 4 }, { type: 3, value: 10 }, { type: 1, value: 4 }])
    expect(Array.from(events)).toEqual([2, 4, 0, 3, 10, 0, 1, 4, 0])
    expect(decodeMacroEvents(events)).toEqual([{ type: 2, value: 4 }, { type: 3, value: 10 }, { type: 1, value: 4 }])
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(macroUuid(events)).toBe(crc32(new TextEncoder().encode('[2,4,0,3,10,0,1,4,0]')))
  })

  it('serializes the active list, map, content, alias and trailing CRC', () => {
    const events = new Uint8Array([2, 4, 0, 1, 4, 0])
    const image = serializeMacroImage(
      [{ icon: 2, name: 'A人', events }],
      [{ layer: 1, matrixPosition: 9, macroIndex: 0 }],
    )
    expect(Array.from(image.slice(0, 5))).toEqual([1, 1, 1, 9, 0])
    const map = image.slice(5, 19)
    expect(Array.from(map.slice(4, 8))).toEqual([19, 0, 0, 0])
    expect(Array.from(map.slice(8))).toEqual([9, 0, 4, 0, 2, 0])
    expect(Array.from(image.slice(19, -4))).toEqual([2, 4, 0, 1, 4, 0, 0, 0, 0, 0, 65, 78, 186])
    expect(Array.from(image.slice(-4))).toEqual(Array.from(new Uint8Array(new Uint32Array([crc32(image.slice(2, -4))]).buffer)))
  })

  it('prepares and chunks a macro image using ObinsKit USB block size', () => {
    expect(Array.from(createPrepareMacroImageRequest(53).slice(-4))).toEqual([53, 0, 0, 0])
    const requests = createDownloadMacroRequests(new Uint8Array(50).map((_, index) => index))
    expect(requests).toHaveLength(2)
    expect(Array.from(requests[0].slice(10, 14))).toEqual([0, 0, 0, 0])
    expect(Array.from(requests[1].slice(10, 14))).toEqual([49, 0, 0, 0])
    expect(requests[0].byteLength).toBe(63)
    expect(requests[1].byteLength).toBe(15)
    expect(Array.from(parseMacroWriteAck(0x05, response(0x05, [0])))).toEqual([0])
    expect(() => parseMacroWriteAck(0x05, response(0x05, [1]))).toThrow('not success')
  })

  it('rejects unbound on-device macros like the ObinsKit serializer', () => {
    expect(() => serializeMacroImage(
      [{ icon: 0, name: 'orphan', events: new Uint8Array() }],
      [],
    )).toThrow('both be empty or both be present')
  })

  it('rejects unrelated or malformed responses', () => {
    expect(() => parseMacroConfigResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x04, 0x00, 0x00, 0x7d, 0x30, 0x07, 0, 0,
    ]))).toThrow('not readMacroConfig')
    expect(() => parseMacroConfigResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x30, 0x06, 0,
    ]))).toThrow('must be 2 bytes')
  })

  it('builds the remaining read-only macro requests', () => {
    expect(Array.from(createReadMacroActiveListRequest()).slice(-2)).toEqual([0x30, 0x07])
    expect(Array.from(createReadMacroMapRequest()).slice(-2)).toEqual([0x30, 0x08])
    expect(Array.from(createReadMacroRequest(2)).slice(-3)).toEqual([0x30, 0x09, 0x02])
    expect(() => createReadMacroRequest(256)).toThrow(RangeError)
  })

  it('parses 14-byte map entries and preserves unknown addresses', () => {
    const entries = parseMacroMapResponse([response(0x08, [
      0x78, 0x56, 0x34, 0x12, 0x20, 0x00, 0x00, 0x00,
      0x09, 0x00, 0x04, 0x00, 0x02, 0x00,
    ])])
    expect(entries[0]).toMatchObject({
      index: 0, uuid: '12345678', address: 32, macroLength: 9, aliasLength: 4, icon: 2,
    })
    expect(() => parseMacroMapResponse([response(0x08, [1])])).toThrow('divisible by 14')
  })

  it('parses macro events, separator, and UTF-16BE alias', () => {
    const entry = parseMacroMapResponse([response(0x08, [
      1, 0, 0, 0, 0, 0, 0, 0, 9, 0, 4, 0, 0, 0,
    ])])[0]
    const macro = parseStoredMacro(entry, [response(0x09, [
      2, 4, 1, 3, 10, 0, 0, 0, 0, 0x00, 0x41, 0x4e, 0xba,
    ])])
    expect(Array.from(macro.events)).toEqual([2, 4, 1, 3, 10, 0])
    expect(Array.from(macro.separator)).toEqual([0, 0, 0])
    expect(macro.name).toBe('A人')
  })

  it('parses three-byte active macro bindings', () => {
    expect(parseMacroActiveListResponse([response(0x07, [0, 12, 2, 1, 9, 3])]))
      .toEqual([
        { layer: 0, matrixPosition: 12, macroIndex: 2 },
        { layer: 1, matrixPosition: 9, macroIndex: 3 },
      ])
    expect(() => parseMacroActiveListResponse([response(0x07, [1])]))
      .toThrow('divisible by 3')
  })
})
