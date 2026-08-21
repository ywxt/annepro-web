import { describe, expect, it } from 'vitest'
import {
  OLED_PACKED_BYTES,
  createOledCharacterRequests,
  createOledDateTimeRequest,
  createOledImageRequests,
  createOledMonitorRequest,
  createOledScrollRequest,
  oledDateTimeFromDate,
  packOledRgba,
  parseOledAck,
} from '../src/protocol/oled.ts'

describe('Tenet 70 OLED protocol', () => {
  it('encodes the native date/time and scroll actions', () => {
    expect(Array.from(createOledDateTimeRequest({ month: 8, day: 22, weekday: 6, hour: 13, minute: 4, second: 9 }))).toEqual([
      0x7b, 0x10, 0x31, 0x10, 8, 0, 0, 0x7d, 0x70, 0x07, 8, 22, 6, 13, 4, 9,
    ])
    expect(Array.from(createOledScrollRequest(true))).toEqual([
      0x7b, 0x10, 0x31, 0x10, 3, 0, 0, 0x7d, 0x70, 0x05, 1,
    ])
  })

  it('uses Sunday as weekday 7 like the official renderer', () => {
    const sunday = new Date(2026, 7, 23, 9, 8, 7)
    expect(oledDateTimeFromDate(sunday)).toMatchObject({ month: 8, day: 23, weekday: 7, hour: 9, minute: 8, second: 7 })
  })

  it('packs two grayscale pixels per byte and vertically flips renderer rows', () => {
    const rgba = new Uint8ClampedArray(256 * 32 * 4)
    const lastRow = 31 * 256 * 4
    rgba.set([255, 255, 255, 255, 128, 128, 128, 255], lastRow)
    const packed = packOledRgba(rgba)
    expect(packed.byteLength).toBe(OLED_PACKED_BYTES)
    expect(packed[0]).toBe(0xf7)
    expect(packed[packed.length - 1]).toBe(0)
  })

  it('creates the official 128 indexed image or character reports', () => {
    const packed = new Uint8Array(OLED_PACKED_BYTES)
    packed[0] = 0xab
    packed[OLED_PACKED_BYTES - 1] = 0xcd
    const image = createOledImageRequests(packed)
    const character = createOledCharacterRequests(packed)
    expect(image).toHaveLength(128)
    expect(image[0].byteLength).toBe(43)
    expect(Array.from(image[0].slice(8, 12))).toEqual([0x70, 0x01, 0, 0xab])
    expect(Array.from(image[127].slice(-2))).toEqual([0, 0xcd])
    expect(character[0][9]).toBe(0x08)
  })

  it('bounds monitor data and validates acknowledgements', () => {
    expect(createOledMonitorRequest(new Uint8Array([40, 50, 60]))[9]).toBe(0x09)
    expect(() => createOledMonitorRequest(new Uint8Array(54))).toThrow('exceeds')
    const ack = new Uint8Array([0x7b, 0x10, 0x13, 0x10, 3, 0, 0, 0x7d, 0x70, 0x07, 0])
    expect(parseOledAck(0x07, ack)).toBeUndefined()
    ack[10] = 1
    expect(() => parseOledAck(0x07, ack)).toThrow('success status')
  })
})
