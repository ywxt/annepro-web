import { describe, expect, it } from 'vitest'
import { createDownloadLightRequests, createPreviewLightRequests, createWriteLightListRequest, encodeLightEffect, encodeLightRgb, lightingProfileForModel, normalizeLightEffect, parseLightWriteAck, parseWriteLightListAck, type LightEffect } from '../src/protocol/lighting.ts'

const light = (type: number, staticColors = Array(61).fill('#112233'), dynamicColors = ['#ff0000']): LightEffect => ({ name: 'Test', type, staticColors, dynamicColors })

describe('lighting protocol', () => {
  it('encodes a single-color preview exactly', () => {
    expect(Array.from(createPreviewLightRequests(light(1, Array(61).fill('#00ff00')))[0])).toEqual([
      0x7b, 0x10, 0x41, 0x10, 7, 0, 0, 0x7d, 0x20, 0x03, 0xff, 1, 0, 255, 0,
    ])
  })

  it('inserts nine C18 blank LEDs into per-key static RGB', () => {
    const colors = Array(61).fill('#112233'); colors[1] = '#445566'
    const rgb = encodeLightRgb(light(2, colors))
    expect(rgb).toHaveLength(70 * 3)
    expect(Array.from(rgb.slice(41 * 3, 42 * 3))).toEqual([0, 0, 0])
  })

  it('splits a per-key download like the native five-packet queue', () => {
    const colors = Array(61).fill('#ffffff'); colors[1] = '#000000'
    const requests = createDownloadLightRequests(2, light(2, colors))
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
    expect(() => createWriteLightListRequest(17)).toThrow(RangeError)
    expect(() => encodeLightRgb(light(3, undefined, []))).toThrow('requires 1–16 colors')
    expect(() => encodeLightRgb(light(3, undefined, Array(17).fill('#ffffff')))).toThrow('requires 1–16 colors')
  })

  it('derives the native static wire type and migrates old profiles', () => {
    expect(encodeLightEffect(light(2, Array(61).fill('#ffffff'))).type).toBe(1)
    const migrated = normalizeLightEffect({ name: 'Legacy', type: 3, colors: ['#123456'] })
    expect(migrated.staticColors).toHaveLength(61)
    expect(migrated.dynamicColors).toEqual(['#123456'])
  })

  it('maps Fuji65 RGB bottom lighting as 16 LEDs in the official 32-position strip', () => {
    const profile = lightingProfileForModel(13)
    expect(profile).toMatchObject({ keycapCount: 16, rowLengths: [16], maxEffects: 16, surface: 'bottom' })
    expect(profile.blankRgb).toHaveLength(16)
    const colors = Array(16).fill('#112233'); colors[1] = '#445566'
    const encoded = encodeLightEffect(light(2, colors), profile)
    expect(encoded.type).toBe(2)
    expect(encoded.rgb).toHaveLength(32 * 3)
    expect(Array.from(encoded.rgb.slice(0, 3))).toEqual([0, 0, 0])
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
