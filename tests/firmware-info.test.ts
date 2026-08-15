import { describe, expect, it } from 'vitest'
import {
  createReadFirmwareVersionRequest,
  parseFirmwareVersionResponse,
} from '../src/protocol/firmware-info.ts'

describe('readFirmwareVersion protocol', () => {
  it('creates only the request observed in the controlled capture', () => {
    expect(Array.from(createReadFirmwareVersionRequest())).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x03,
    ])
  })

  it('decodes the captured six-byte version response', () => {
    const frame = new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x08, 0x00, 0x00, 0x7d,
      0x01, 0x03, 0x24, 0x02, 0x21, 0x02, 0x05, 0x02,
    ])
    const response = new Uint8Array([...frame, 0xaa])
    expect(parseFirmwareVersionResponse(response)).toEqual({
      key: '2.36',
      led: '2.33',
      ble: '2.05',
      rawFrame: frame,
      trailingLength: 1,
    })
  })

  it('supports the three-byte legacy format used by the renderer', () => {
    const response = new Uint8Array([
      0x7b, 0x10, 0x31, 0x00, 0x05, 0x00, 0x00, 0x7d,
      0x01, 0x03, 0x24, 0x0f, 0x10,
    ])
    expect(parseFirmwareVersionResponse(response)).toMatchObject({
      key: '2.04',
      led: '0.15',
      ble: '1.00',
    })
  })

  it('rejects unrelated commands and invalid lengths', () => {
    expect(() => parseFirmwareVersionResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x02,
    ]))).toThrow('not readFirmwareVersion')
    expect(() => parseFirmwareVersionResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x04, 0x00, 0x00, 0x7d, 0x01, 0x03, 1, 2,
    ]))).toThrow('must be 3 or 6 bytes')
  })
})
