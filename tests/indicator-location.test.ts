import { describe, expect, it } from 'vitest'
import { createReadIndicatorLocationRequest, createWriteIndicatorLocationRequest, parseIndicatorLocationResponse, parseWriteIndicatorLocationAck } from '../src/protocol/indicator-location.ts'

describe('D87 indicator location protocol', () => {
  it('encodes the native 20/18 and 20/19 operations', () => {
    expect(Array.from(createReadIndicatorLocationRequest()).slice(-2)).toEqual([0x20, 0x18])
    expect(Array.from(createWriteIndicatorLocationRequest(7)).slice(-3)).toEqual([0x20, 0x19, 7])
    expect(() => createWriteIndicatorLocationRequest(256)).toThrow('Invalid indicator location')
  })
  it('parses readback and requires a successful write status', () => {
    expect(parseIndicatorLocationResponse(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,0x20,0x18,7])).location).toBe(7)
    expect(parseWriteIndicatorLocationAck(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,0x20,0x19,0]))).toBeUndefined()
    expect(() => parseWriteIndicatorLocationAck(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,0x20,0x19,1]))).toThrow('success status')
  })
})
