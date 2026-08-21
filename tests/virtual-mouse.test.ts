import { describe, expect, it } from 'vitest'
import {
  createReadVirtualMouseConfigRequest,
  createWriteVirtualMouseCursorSpeedRequest,
  createWriteVirtualMousePanSpeedRequest,
  createWriteVirtualMouseWheelSpeedRequest,
  parseVirtualMouseConfigResponse,
  parseVirtualMouseWriteAck,
} from '../src/protocol/virtual-mouse.ts'

describe('native virtual mouse protocol', () => {
  it('encodes the four native command-60 actions', () => {
    expect(Array.from(createReadVirtualMouseConfigRequest())).toEqual([0x7b,0x10,0x31,0x10,2,0,0,0x7d,0x60,0x05])
    expect(Array.from(createWriteVirtualMouseCursorSpeedRequest(new Uint8Array([1, 8, 16])).slice(8))).toEqual([0x60,0x01,1,8,16])
    expect(Array.from(createWriteVirtualMouseWheelSpeedRequest(4)).slice(8)).toEqual([0x60,0x02,4])
    expect(Array.from(createWriteVirtualMousePanSpeedRequest(5)).slice(8)).toEqual([0x60,0x03,5])
  })

  it('bounds native buffer and byte arguments', () => {
    expect(() => createWriteVirtualMouseCursorSpeedRequest(new Uint8Array())).toThrow('cannot be empty')
    expect(() => createWriteVirtualMouseCursorSpeedRequest(new Uint8Array(54))).toThrow('exceeds')
    expect(() => createWriteVirtualMouseWheelSpeedRequest(256)).toThrow('0 to 255')
  })

  it('preserves unknown config bytes until matching hardware is captured', () => {
    const response = parseVirtualMouseConfigResponse(new Uint8Array([
      0x7b,0x12,0x13,0,6,0,0,0x7d,0x60,0x05,1,2,3,4,0xff,
    ]))
    expect(Array.from(response.rawConfig)).toEqual([1,2,3,4])
    expect(response.trailingLength).toBe(1)
  })

  it('requires matching success acknowledgements', () => {
    const ack = new Uint8Array([0x7b,0x10,0x13,0x10,3,0,0,0x7d,0x60,0x02,0])
    expect(parseVirtualMouseWriteAck(0x02, ack)).toBeUndefined()
    ack[10] = 1
    expect(() => parseVirtualMouseWriteAck(0x02, ack)).toThrow('success status')
  })
})
