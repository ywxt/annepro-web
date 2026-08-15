import { describe, expect, it } from 'vitest'
import {
  createReadMacroConfigRequest,
  parseMacroConfigResponse,
} from '../src/protocol/macro-info.ts'

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
})
