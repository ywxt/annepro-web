import { describe, expect, it } from 'vitest'
import {
  createReadHardwareStateRequest,
  parseHardwareStateResponse,
} from '../src/protocol/hardware-state.ts'

describe('readHardwareState protocol', () => {
  it('creates the request directly identified in native dispatch', () => {
    expect(Array.from(createReadHardwareStateRequest())).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x09,
    ])
  })

  it('decodes the isolated modern response exactly like the renderer', () => {
    const response = new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x1a, 0x00, 0x00, 0x7d, 0x01, 0x09,
      0, 0, 0, 0, 1, 1, 1, 1, 0x57, 0x29, 0, 0,
      1, 1, 0, 1, 0x18, 7, 0, 1, 3, 0x71, 0, 0x7c,
    ])
    expect(parseHardwareStateResponse(response)).toMatchObject({
      format: 'modern', userLayout: 1, magicFn: 1, macroTrigger: 0,
      capslockLed: 1, indicatorBrightness: 24, backlightBrightness: 7,
      ledHold: 0, tapStatus: 1, tapActMode: 3, tapTimeoutValue: 113,
      sleepTimeoutRaw: 31744, trailingLength: 0,
    })
  })

  it('supports the renderer legacy six-byte format', () => {
    const response = new Uint8Array([
      0x7b, 0x12, 0x13, 0, 8, 0, 0, 0x7d, 1, 9, 2, 1, 2, 0, 1, 1,
    ])
    expect(parseHardwareStateResponse(response)).toMatchObject({
      format: 'legacy', userLayout: 2, tapStatus: 1, magicFn: 2,
      macroTrigger: 0, capslockLed: 1, ledHold: 1,
    })
  })
})
