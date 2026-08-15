import { describe, expect, it } from 'vitest'
import { bytesToHex, formatHex } from '../src/protocol/packet.ts'

describe('packet formatting', () => {
  it('converts bytes to lowercase, padded hexadecimal', () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00 01 0f 10 ff')
  })

  it('honors typed-array offsets', () => {
    const source = new Uint8Array([0xaa, 0xbb, 0xcc])
    expect(bytesToHex(source.subarray(1, 2))).toBe('bb')
  })

  it('formats identifiers with a 0x prefix', () => {
    expect(formatHex(0x4d9)).toBe('0x04d9')
  })
})
