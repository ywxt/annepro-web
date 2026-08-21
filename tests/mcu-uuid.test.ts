import { describe, expect, it } from 'vitest'
import { createReadMcuUuidRequest, parseMcuUuidResponse } from '../src/protocol/mcu-uuid.ts'

describe('native MCU UUID read protocol', () => {
  it('encodes the native 01/04 no-argument request', () => {
    expect(Array.from(createReadMcuUuidRequest())).toEqual([0x7b, 0x10, 0x31, 0x10, 2, 0, 0, 0x7d, 0x01, 0x04])
  })

  it('preserves an opaque identifier and ignores trailing report bytes', () => {
    const response = parseMcuUuidResponse(new Uint8Array([0x7b, 0x12, 0x13, 0, 6, 0, 0, 0x7d, 0x01, 0x04, 0xaa, 0xbb, 0xcc, 0xdd, 0xff]))
    expect(Array.from(response.bytes)).toEqual([0xaa, 0xbb, 0xcc, 0xdd])
    expect(response.trailingLength).toBe(1)
  })

  it('rejects mismatched and empty responses', () => {
    expect(() => parseMcuUuidResponse(new Uint8Array([0x7b, 0x12, 0x13, 0, 2, 0, 0, 0x7d, 0x01, 0x04]))).toThrow('empty')
    expect(() => parseMcuUuidResponse(new Uint8Array([0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x01, 0x05, 1]))).toThrow('01/04')
  })
})
