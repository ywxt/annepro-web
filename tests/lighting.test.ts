import { describe, expect, it } from 'vitest'
import { createDownloadLightRequests, createPreviewLightRequests, createWriteLightListRequest, encodeLightRgb, parseLightWriteAck, parseWriteLightListAck } from '../src/protocol/lighting.ts'

describe('lighting protocol', () => {
  it('encodes a single-color preview exactly', () => {
    expect(Array.from(createPreviewLightRequests({ name: 'Green', type: 1, colors: ['#00ff00'] })[0])).toEqual([
      0x7b, 0x10, 0x41, 0x10, 7, 0, 0, 0x7d, 0x20, 0x03, 0xff, 1, 0, 255, 0,
    ])
  })

  it('inserts nine C18 blank LEDs into per-key static RGB', () => {
    const rgb = encodeLightRgb({ name: 'Keys', type: 2, colors: Array(61).fill('#112233') })
    expect(rgb).toHaveLength(70 * 3)
    expect(Array.from(rgb.slice(41 * 3, 42 * 3))).toEqual([0, 0, 0])
  })

  it('splits a per-key download like the native five-packet queue', () => {
    const requests = createDownloadLightRequests(2, { name: 'Keys', type: 2, colors: Array(61).fill('#ffffff') })
    expect(requests.map(request => request.length)).toEqual([63, 63, 63, 63, 18])
    expect(requests.map(request => request[3])).toEqual([0x50, 0x51, 0x52, 0x53, 0x54])
    expect(requests.every(request => request[1] === 0x10 && request[2] === 0x31
      && request[8] === 0x20 && request[9] === 0x02
      && request[10] === 2 && request[11] === 2)).toBe(true)
  })

  it('validates list count and dynamic palette length', () => {
    expect(Array.from(createWriteLightListRequest(3))).toEqual([
      0x7b, 0x10, 0x31, 0x10, 3, 0, 0, 0x7d, 0x20, 0x04, 3,
    ])
    expect(() => createWriteLightListRequest(33)).toThrow(RangeError)
    expect(() => encodeLightRgb({ name: 'Bad', type: 3, colors: ['#ffffff'] })).toThrow('requires 12 colors')
  })

  it('accepts native success status instead of treating it as a packet index', () => {
    const previewAck = new Uint8Array([0x7b, 0x10, 0x14, 0x10, 3, 0, 0, 0x7d, 0x20, 0x03, 0])
    expect(parseLightWriteAck(0x03, 4, previewAck)).toMatchObject({ packet: 4 })
    expect(parseWriteLightListAck(new Uint8Array([
      0x7b, 0x10, 0x13, 0x10, 3, 0, 0, 0x7d, 0x20, 0x04, 0,
    ]))).toEqual(new Uint8Array([0]))
    const failed = previewAck.slice()
    failed[10] = 1
    expect(() => parseLightWriteAck(0x03, 0, failed)).toThrow('is not successful')
  })
})
