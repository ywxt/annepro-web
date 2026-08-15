import { describe, expect, it } from 'vitest'
import {
  createReadDeviceTypeRequest,
  parseDeviceTypeResponse,
} from '../src/protocol/device-info.ts'

describe('readDeviceType protocol', () => {
  it('creates only the exact request observed in the controlled capture', () => {
    expect(Array.from(createReadDeviceTypeRequest())).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x01,
    ])
  })

  it('decodes the captured Anne Pro 2 response', () => {
    const frame = new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x04, 0x00, 0x00, 0x7d, 0x01, 0x01, 0x05, 0x01,
    ])
    const response = new Uint8Array([...frame, 0x2c, 0x01])
    expect(parseDeviceTypeResponse(response)).toEqual({
      model: 5,
      modelName: 'AnnePro2C18',
      type: 1,
      typeName: 'Keyboard',
      rawFrame: frame,
      trailingLength: 2,
    })
  })

  it('rejects other commands and invalid payload lengths', () => {
    expect(() => parseDeviceTypeResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x02,
    ]))).toThrow('not readDeviceType')
    expect(() => parseDeviceTypeResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x01, 0x01, 0x05,
    ]))).toThrow('must be 2 bytes')
  })
})
