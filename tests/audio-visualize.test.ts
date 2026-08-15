import { describe, expect, it } from 'vitest'
import { audioRgbFromFrequencyData, createAudioVisualizeRequests, parseAudioVisualizeAck } from '../src/protocol/audio-visualize.ts'

describe('audio visualization protocol', () => {
  it('encodes the physically confirmed three-byte pure-color frame', () => {
    expect(Array.from(createAudioVisualizeRequests(new Uint8Array([255, 0, 0]))[0])).toEqual([
      0x7b,0x10,0x41,0x10,7,0,0,0x7d,0x20,0x11,0xff,1,255,0,0,
    ])
  })
  it('splits 64 colorful LEDs into bounded multipart reports', () => {
    const requests = createAudioVisualizeRequests(new Uint8Array(192))
    expect(requests).toHaveLength(4)
    expect(requests.map(request => request[3])).toEqual([0x40, 0x41, 0x42, 0x43])
    expect(requests.map(request => request.byteLength)).toEqual([63, 63, 63, 51])
    expect(requests.every(request => request[10] === 0xff && request[11] === 2)).toBe(true)
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
  it('requires the native success acknowledgement', () => {
    const ack = new Uint8Array([0x7b,0x10,0x14,0x10,3,0,0,0x7d,0x20,0x11,0])
    expect(parseAudioVisualizeAck(ack)).toBeUndefined()
    ack[10] = 1
    expect(() => parseAudioVisualizeAck(ack)).toThrow('success status')
  })
})
