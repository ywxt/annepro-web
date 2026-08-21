import { describe, expect, it } from 'vitest'
import { createReadCapslockColorRequest, createReadIndicatorColorRequest, createWriteCapslockColorRequest, createWriteIndicatorColorRequest, parseCapslockColorResponse, parseIndicatorColorResponse, parseWriteCapslockColorAck, parseWriteIndicatorColorAck } from '../src/protocol/indicator-color.ts'

describe('indicator color protocol', () => {
  it('encodes the physically verified C18 commands', () => {
    expect(Array.from(createReadIndicatorColorRequest()).slice(-2)).toEqual([0x20, 0x1a])
    expect(Array.from(createWriteIndicatorColorRequest('#ff9800'))).toEqual([0x7b,0x10,0x31,0x10,5,0,0,0x7d,0x20,0x1b,0xff,0x98,0])
  })
  it('encodes the native D87/Discovery CapsLock-color branch', () => {
    expect(Array.from(createReadCapslockColorRequest()).slice(-2)).toEqual([0x20, 0x1d])
    expect(Array.from(createWriteCapslockColorRequest('#123456')).slice(-5)).toEqual([0x20, 0x1c, 0x12, 0x34, 0x56])
    expect(parseCapslockColorResponse(new Uint8Array([0x7b,0x12,0x13,0,5,0,0,0x7d,0x20,0x1d,0x12,0x34,0x56])).hex).toBe('#123456')
    expect(parseWriteCapslockColorAck(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,0x20,0x1c,0]))).toBeUndefined()
  })
  it('parses the physical read response', () => {
    const parsed = parseIndicatorColorResponse(new Uint8Array([0x7b,0x12,0x13,0,5,0,0,0x7d,0x20,0x1a,0xff,0x98,0,0xaa]))
    expect(parsed.hex).toBe('#ff9800')
    expect(parsed.trailingLength).toBe(1)
  })
  it('requires a successful write acknowledgement', () => {
    expect(parseWriteIndicatorColorAck(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,0x20,0x1b,0]))).toBeUndefined()
    expect(() => parseWriteIndicatorColorAck(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,0x20,0x1b,1]))).toThrow('success status')
  })
})
