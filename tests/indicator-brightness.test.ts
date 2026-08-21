import { describe, expect, it } from 'vitest'
import { createWriteIndicatorBrightnessRequest, parseWriteIndicatorBrightnessAck } from '../src/protocol/indicator-brightness.ts'

describe('D87 indicator brightness protocol', () => {
  it('encodes native writeIndicatorBrightness 20/14', () => {
    expect(Array.from(createWriteIndicatorBrightnessRequest(7))).toEqual([0x7b, 0x10, 0x31, 0x10, 3, 0, 0, 0x7d, 0x20, 0x14, 7])
    expect(() => createWriteIndicatorBrightnessRequest(0)).toThrow('1 to 10')
  })

  it('accepts status or echo ACK and rejects other values', () => {
    const ack = new Uint8Array([0x7b, 0x10, 0x13, 0x10, 3, 0, 0, 0x7d, 0x20, 0x14, 0])
    expect(parseWriteIndicatorBrightnessAck(7, ack)).toBeUndefined()
    ack[10] = 7
    expect(parseWriteIndicatorBrightnessAck(7, ack)).toBeUndefined()
    ack[10] = 6
    expect(() => parseWriteIndicatorBrightnessAck(7, ack)).toThrow('0 or 7')
  })
})
