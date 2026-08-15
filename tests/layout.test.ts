import { describe, expect, it } from 'vitest'
import {
  createReadKeyboardLayerRequest,
  parseKeyboardLayerResponse,
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

  it('rejects a truncated layer payload', () => {
    expect(() => parseKeyboardLayerResponse(0, [response(0x00, [1, 2])]))
      .toThrow('must be 61 bytes')
  })
})
