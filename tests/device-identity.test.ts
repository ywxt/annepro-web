import { describe, expect, it } from 'vitest'
import {
  createDeleteBleHostRequest,
  createReadBleMacRequest,
  createReadUdidRequest,
  parseBleMacResponse,
  parseDeleteBleHostAck,
  parseUdidResponse,
} from '../src/protocol/device-identity.ts'

describe('device identity and BLE protocol', () => {
  it('uses the main and BLE MCU routes identified in ObinsKit', () => {
    expect(Array.from(createReadUdidRequest())).toEqual([0x7b,0x12,0x31,0,2,0,0,0x7d,1,0x0d])
    expect(Array.from(createReadBleMacRequest())).toEqual([0x7b,0x12,0x51,0,2,0,0,0x7d,0x40,0x30])
    expect(Array.from(createDeleteBleHostRequest()).slice(-2)).toEqual([0x40,0x05])
  })

  it('parses a masked physical C18 UDID fixture', () => {
    const payload = new Uint8Array([1,0,2,3,4,5,6,7,8,9,10,11,12,13,0xc5,0xb7])
    const parsed = parseUdidResponse(new Uint8Array([0x7b,0x12,0x13,0,18,0,0,0x7d,1,0x0d,...payload,0xaa]))
    expect(parsed.bytes).toEqual(payload)
    expect(parsed.trailingLength).toBe(1)
  })

  it('parses only the declared BLE frame and formats its first six bytes', () => {
    const parsed = parseBleMacResponse(new Uint8Array([0x7b,0x12,0x15,0,8,0,0,0x7d,0x40,0x30,0xf8,0x33,0x31,0xb7,0xb3,0xb3,0xaa]))
    expect(parsed.formatted).toBe('F8:33:31:B7:B3:B3')
    expect(parsed.rawFrame.byteLength).toBe(16)
    expect(parsed.trailingLength).toBe(1)
  })

  it('strictly validates destructive-operation acknowledgement', () => {
    expect(parseDeleteBleHostAck(new Uint8Array([0x7b,0x12,0x15,0,3,0,0,0x7d,0x40,5,0]))).toBeUndefined()
    expect(() => parseDeleteBleHostAck(new Uint8Array([0x7b,0x12,0x15,0,3,0,0,0x7d,0x40,5,1]))).toThrow('status 1')
  })
})
