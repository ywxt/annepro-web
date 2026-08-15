import { describe, expect, it } from 'vitest'
import { createReadIapModeRequest, parseIapModeResponse } from '../src/protocol/iap-info.ts'

describe('readIapMode protocol', () => {
  it('creates only the exact request used in the isolated capture', () => {
    expect(Array.from(createReadIapModeRequest())).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x02, 0x02,
    ])
  })

  it('decodes the captured single-byte IAP state and ignores trailing data', () => {
    const frame = new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x02, 0x02, 0x02,
    ])
    expect(parseIapModeResponse(new Uint8Array([...frame, 0xaa, 0xbb]))).toEqual({
      mode: 2,
      rawFrame: frame,
      trailingLength: 2,
    })
  })

  it('rejects other commands and payload sizes', () => {
    expect(() => parseIapModeResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x02, 0x03, 0x02,
    ]))).toThrow('not readIapMode')
    expect(() => parseIapModeResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x02, 0x02,
    ]))).toThrow('must be 1 byte')
  })
})
