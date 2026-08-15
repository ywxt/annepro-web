import { describe, expect, it } from 'vitest'
import { createDownloadLightRequests, createPreviewLightRequests, createWriteLightListRequest, encodeLightRgb } from '../src/protocol/lighting.ts'

describe('lighting protocol', () => {
  it('encodes a single-color preview exactly', () => {
    expect(Array.from(createPreviewLightRequests({ name: 'Green', type: 1, colors: ['#00ff00'] })[0])).toEqual([
      0x7b, 0x12, 0x31, 0, 7, 0, 0, 0x7d, 0x20, 0x04, 0xff, 1, 0, 255, 0,
    ])
  })

  it('inserts nine C18 blank LEDs into per-key static RGB', () => {
    const rgb = encodeLightRgb({ name: 'Keys', type: 2, colors: Array(61).fill('#112233') })
    expect(rgb).toHaveLength(70 * 3)
    expect(Array.from(rgb.slice(41 * 3, 42 * 3))).toEqual([0, 0, 0])
  })

  it('splits a per-key download into four bounded reports', () => {
    const requests = createDownloadLightRequests(2, { name: 'Keys', type: 2, colors: Array(61).fill('#ffffff') })
    expect(requests.map(request => request.length)).toEqual([64, 64, 64, 60])
    expect(requests.map(request => request[3])).toEqual([0x80, 0x81, 0x82, 0x03])
    expect(requests.every(request => request[8] === 0x20 && request[9] === 0x03)).toBe(true)
  })

  it('validates list count and dynamic palette length', () => {
    expect(Array.from(createWriteLightListRequest(3))).toEqual([
      0x7b, 0x12, 0x31, 0, 3, 0, 0, 0x7d, 0x20, 0x04, 3,
    ])
    expect(() => createWriteLightListRequest(33)).toThrow(RangeError)
    expect(() => encodeLightRgb({ name: 'Bad', type: 3, colors: ['#ffffff'] })).toThrow('requires 12 colors')
  })
})
