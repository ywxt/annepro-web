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
