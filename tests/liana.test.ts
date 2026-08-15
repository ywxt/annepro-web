import { describe, expect, it } from 'vitest'
import { LianaFrameError, parseLianaFrame, tryParseLianaFrame } from '../src/protocol/liana.ts'

const legacyReadDeviceType = new Uint8Array([
  0x7b, 0x10, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x01,
])

describe('Liana frame parser', () => {
  it('parses the statically observed legacy readDeviceType frame', () => {
    expect(parseLianaFrame(legacyReadDeviceType)).toEqual({
      protocol: 0x10,
      route: 3,
      sequence: 1,
      packet: 0,
      payloadLength: 2,
      reserved: 0,
      command: 1,
      action: 1,
      payload: new Uint8Array(),
      trailing: new Uint8Array(),
    })
  })

  it('separates declared payload from 64-byte report padding', () => {
    const report = new Uint8Array(64)
    report.set([0x7b, 0x12, 0x31, 0x00, 0x04, 0x00, 0x00, 0x7d, 0x01, 0x01, 0xaa, 0xbb])
    const parsed = parseLianaFrame(report)
    expect(parsed.payload).toEqual(new Uint8Array([0xaa, 0xbb]))
    expect(parsed.trailing).toHaveLength(52)
  })

  it('rejects malformed or truncated frames', () => {
    expect(() => parseLianaFrame(new Uint8Array(9))).toThrow(LianaFrameError)
    expect(() => parseLianaFrame(new Uint8Array(10))).toThrow('Missing 0x7b')
    expect(tryParseLianaFrame(new Uint8Array(10))).toBeNull()

    const truncated = legacyReadDeviceType.slice()
    truncated[4] = 3
    expect(() => parseLianaFrame(truncated)).toThrow('declares 11 bytes')
  })
})
