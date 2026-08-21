import { describe, expect, it } from 'vitest'
import { createReadCombinationModeRequest, parseCombinationModeResponse } from '../src/protocol/combination-mode.ts'

describe('Tenet combination mode', () => {
  it('encodes native getCombinationMode 01/f1', () => {
    expect(Array.from(createReadCombinationModeRequest())).toEqual([
      0x7b, 0x10, 0x31, 0x10, 2, 0, 0, 0x7d, 0x01, 0xf1,
    ])
  })

  it('preserves the raw one-byte mode while exposing renderer truthiness', () => {
    const response = parseCombinationModeResponse(new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 3, 0, 0, 0x7d, 0x01, 0xf1, 2, 0, 0,
    ]))
    expect(response).toMatchObject({ enabled: true, rawValue: 2, trailingLength: 2 })
  })

  it('rejects mismatched and malformed replies', () => {
    const response = new Uint8Array([0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x01, 0xf1, 0])
    response[9] = 0xf0
    expect(() => parseCombinationModeResponse(response)).toThrow('01/f1')
  })
})
