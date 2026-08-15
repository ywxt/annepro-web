import { describe, expect, it } from 'vitest'
import { createReadLedPowerModeRequest, parseLedPowerModeResponse } from '../src/protocol/led-power.ts'

describe('readLedPowerMode protocol', () => {
  it('creates the native-dispatch request', () => {
    expect(Array.from(createReadLedPowerModeRequest())).toEqual([
      0x7b, 0x12, 0x31, 0, 2, 0, 0, 0x7d, 0x20, 0x1e,
    ])
  })

  it('decodes the isolated response and excludes stale trailing bytes', () => {
    const response = new Uint8Array([
      0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x20, 0x1e, 2,
      1, 0, 0, 1,
    ])
    expect(parseLedPowerModeResponse(response)).toMatchObject({
      mode: 2, modeName: 'High', trailingLength: 4,
      rawFrame: new Uint8Array([0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x20, 0x1e, 2]),
    })
  })

  it('rejects wrong operations and payload lengths', () => {
    expect(() => parseLedPowerModeResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x20, 0x1d, 2,
    ]))).toThrow('not readLedPowerMode')
    expect(() => parseLedPowerModeResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0, 4, 0, 0, 0x7d, 0x20, 0x1e, 2, 1,
    ]))).toThrow('must be 1 byte')
  })
})
