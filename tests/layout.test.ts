import { describe, expect, it } from 'vitest'
import {
  createWriteKeyboardLayerRequests,
  KEY_WIDTHS,
  createReadKeyboardLayerRequest,
  keyboardLayerRows,
  keycodeName,
  keycapLabel,
  keycodeOptions,
  parseKeyboardLayerResponse,
  parseWriteKeyboardLayerAck,
} from '../src/protocol/layout.ts'

function response(packet: number, payload: number[]): Uint8Array {
  const length = payload.length + 2
  return new Uint8Array([
    0x7b, 0x12, 0x13, packet, length, 0x00, 0x00, 0x7d,
    0x10, 0x02, ...payload,
  ])
}

describe('keyboard layout read protocol', () => {
  it.each([0, 1, 2, 3])('builds the observed layer %i request', (layer) => {
    expect(Array.from(createReadKeyboardLayerRequest(layer))).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x10, 0x02, layer,
    ])
  })

  it('rejects layer indices outside the four observed layers', () => {
    expect(() => createReadKeyboardLayerRequest(-1)).toThrow(RangeError)
    expect(() => createReadKeyboardLayerRequest(4)).toThrow(RangeError)
    expect(() => createReadKeyboardLayerRequest(1.5)).toThrow(RangeError)
  })

  it('encodes a 61-byte layer as the confirmed 54 + 8 write payloads', () => {
    const data = new Uint8Array(Array.from({ length: 61 }, (_, index) => index))
    const requests = createWriteKeyboardLayerRequests(2, data)
    expect(requests).toHaveLength(2)
    expect(Array.from(requests[0].slice(0, 11))).toEqual([
      0x7b, 0x12, 0x31, 0x80, 56, 0, 0, 0x7d, 0x10, 0x01, 2,
    ])
    expect(requests[0]).toHaveLength(64)
    expect(Array.from(requests[1])).toEqual([
      0x7b, 0x12, 0x31, 0x01, 10, 0, 0, 0x7d, 0x10, 0x01,
      ...Array.from(data.slice(53)),
    ])
  })

  it('validates per-packet layout write acknowledgements', () => {
    const ack = new Uint8Array([
      0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x10, 0x01, 1,
    ])
    expect(parseWriteKeyboardLayerAck(1, ack)).toMatchObject({ packet: 1 })
    expect(() => parseWriteKeyboardLayerAck(0, ack)).toThrow('does not match packet 0')
  })

  it('assembles and identifies a raw 61-byte layer', () => {
    const bytes = Array.from({ length: 61 }, (_, index) => index)
    const result = parseKeyboardLayerResponse(2, [
      response(0x01, bytes.slice(54)),
      response(0x80, bytes.slice(0, 54)),
    ])
    expect(result.layer).toBe(2)
    expect(result.packetCount).toBe(2)
    expect(Array.from(result.data)).toEqual(bytes)
  })

  it('recognizes the isolated Layer 0 capture as incomplete', () => {
    const first = new Uint8Array([
      0x7b, 0x12, 0x13, 0x80, 0x38, 0x00, 0x00, 0x7d, 0x10, 0x02,
      0x35, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
      0x2d, 0x2e, 0x2a, 0x2b, 0x14, 0x1a, 0x08, 0x15, 0x17, 0x1c, 0x18,
      0x0c, 0x12, 0x13, 0x2f, 0x30, 0x31, 0x29, 0x04, 0x16, 0x07, 0x09,
      0x0a, 0x0b, 0x0d, 0x0e, 0x0f, 0x33, 0x34, 0x28, 0xe1, 0x1d, 0x1b,
      0x06, 0x19, 0x05, 0x11, 0x10, 0x36, 0x37, 0x38, 0xe5, 0xe0,
    ])
    expect(() => parseKeyboardLayerResponse(0, [first]))
      .toThrow('Invalid continuation flag')
  })

  it('decodes the complete isolated Layer 0 capture', () => {
    const firstData = [
      0x35, 0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
      0x2d, 0x2e, 0x2a, 0x2b, 0x14, 0x1a, 0x08, 0x15, 0x17, 0x1c, 0x18,
      0x0c, 0x12, 0x13, 0x2f, 0x30, 0x31, 0x29, 0x04, 0x16, 0x07, 0x09,
      0x0a, 0x0b, 0x0d, 0x0e, 0x0f, 0x33, 0x34, 0x28, 0xe1, 0x1d, 0x1b,
      0x06, 0x19, 0x05, 0x11, 0x10, 0x36, 0x37, 0x38, 0xe5, 0xe0,
    ]
    const finalData = [0xe3, 0xe2, 0xc0, 0xe6, 0xc0, 0xc1, 0xe4]
    const result = parseKeyboardLayerResponse(0, [
      response(0x80, firstData),
      new Uint8Array([...response(0x01, finalData), 0x24, 0x25, 0x26]),
    ])
    expect(result.packetCount).toBe(2)
    expect(Array.from(result.data)).toEqual([...firstData, ...finalData])
  })

  it('rejects a truncated layer payload', () => {
    expect(() => parseKeyboardLayerResponse(0, [response(0x00, [1, 2])]))
      .toThrow('must be 61 bytes')
  })

  it('splits the C18 payload into its five physical rows', () => {
    const rows = keyboardLayerRows(new Uint8Array(61))
    expect(rows.map((row) => row.byteLength)).toEqual([14, 14, 13, 12, 8])
    expect(() => keyboardLayerRows(new Uint8Array(60))).toThrow('must be 61 bytes')
  })

  it('models the physical ANSI 60% key widths without changing matrix order', () => {
    expect(KEY_WIDTHS.map(row => row.length)).toEqual([14, 14, 13, 12, 8])
    expect(KEY_WIDTHS.map(row => row.reduce((sum, width) => sum + width, 0))).toEqual([15, 15, 15, 15, 15])
    expect(KEY_WIDTHS[0][13]).toBe(2)
    expect(KEY_WIDTHS[2][12]).toBe(2.25)
    expect(KEY_WIDTHS[4][3]).toBe(6.25)
  })

  it('offers known keycodes as choices and renders Transparent as a blank keycap', () => {
    expect(keycapLabel(0x01)).toBe('')
    expect(keycapLabel(0x04)).toBe('A')
    expect(keycodeOptions()).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 0x01, name: 'Transparent', group: 'Basic' }),
      expect.objectContaining({ value: 0xc0, name: 'Fn1', group: 'Anne Pro' }),
      expect.objectContaining({ value: 0xe1, name: 'LShift', group: 'Modifiers' }),
    ]))
  })

  it('labels standard HID and observed Anne Pro keycodes', () => {
    expect([
      0x01, 0x04, 0x1d, 0x1e, 0x27, 0x28, 0x3a, 0x45, 0x52,
      0xa8, 0xc0, 0xc8, 0xcf, 0xf0, 0xf6, 0xfb, 0xfe, 0xff,
    ].map(keycodeName)).toEqual([
      'Transparent', 'A', 'Z', '1', '0', 'Enter', 'F1', 'F12', 'Up',
      'Mute', 'Fn1', 'Bluetooth 1', 'Fn Wheel', 'Backlight Toggle',
      'Backlight Battery', 'Mouse Up', 'Mouse Right', '0xff',
    ])
  })
})
