import { describe, expect, it } from 'vitest'
import { assembleLianaPayload } from '../src/protocol/multipart.ts'

function frame(packet: number, payload: number[]): Uint8Array {
  const declaredLength = payload.length + 2
  return new Uint8Array([
    0x7b, 0x12, 0x13, packet,
    declaredLength & 0xff, declaredLength >> 8, 0x00, 0x7d,
    0x10, 0x02, ...payload,
  ])
}

describe('Liana protocol-0x12 multipart assembly', () => {
  it('joins the observed continuation/index form into one payload', () => {
    const first = frame(0x80, Array.from({ length: 54 }, (_, index) => index))
    const final = frame(0x01, Array.from({ length: 7 }, (_, index) => index + 54))
    const result = assembleLianaPayload([final, first])
    expect(result.command).toBe(0x10)
    expect(result.action).toBe(0x02)
    expect(result.packetCount).toBe(2)
    expect(Array.from(result.payload)).toEqual(Array.from({ length: 61 }, (_, index) => index))
  })

  it('rejects missing packets and invalid continuation flags', () => {
    expect(() => assembleLianaPayload([frame(0x81, [1]), frame(0x02, [2])]))
      .toThrow('Missing multipart packet index 0')
    expect(() => assembleLianaPayload([frame(0x00, [1]), frame(0x01, [2])]))
      .toThrow('Invalid continuation flag')
  })

  it('rejects mixed commands', () => {
    const first = frame(0x80, [1])
    const final = frame(0x01, [2])
    final[9] = 0x03
    expect(() => assembleLianaPayload([first, final])).toThrow('do not share')
  })
})
