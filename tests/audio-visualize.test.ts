import { describe, expect, it } from 'vitest'
import { audioRgbFromFrequencyData, createAudioVisualizeRequests } from '../src/protocol/audio-visualize.ts'

describe('audio visualization protocol', () => {
  it('encodes the physically confirmed three-byte pure-color frame', () => {
    expect(Array.from(createAudioVisualizeRequests(new Uint8Array([255, 0, 0]))[0])).toEqual([
      0x7b,0x12,0x31,0,7,0,0,0x7d,0x20,0x11,0xff,1,255,0,0,
    ])
  })
  it('splits 64 colorful LEDs into bounded multipart reports', () => {
    const requests = createAudioVisualizeRequests(new Uint8Array(192))
    expect(requests).toHaveLength(4)
    expect(requests.map(request => request[3])).toEqual([0x80, 0x81, 0x82, 0x03])
    expect(requests.every(request => request.byteLength <= 64)).toBe(true)
    expect(Array.from(requests[0].slice(10, 12))).toEqual([0xff, 2])
  })
  it('maps analyser data to pure and colorful RGB', () => {
    expect(Array.from(audioRgbFromFrequencyData('pure', new Uint8Array([0, 255]), [200, 100, 50])))
      .toEqual([100, 50, 25])
    const colorful = audioRgbFromFrequencyData('colorful', new Uint8Array([255]), [0, 0, 0])
    expect(colorful.byteLength).toBe(192)
    expect(Array.from(colorful.slice(0, 3))).toEqual([255, 0, 0])
  })
  it('rejects unsupported frame lengths', () => {
    expect(() => createAudioVisualizeRequests(new Uint8Array(4))).toThrow('3 or 192')
  })
})
