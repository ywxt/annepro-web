import { describe, expect, it } from 'vitest'
import { createWriteHardwareSettingRequest, parseWriteHardwareSettingResponse } from '../src/protocol/settings-write.ts'

describe('hardware setting writes', () => {
  it('encodes fixed one-byte setting commands', () => {
    expect(Array.from(createWriteHardwareSettingRequest('magicFn', 1))).toEqual([
      0x7b, 0x12, 0x31, 0, 3, 0, 0, 0x7d, 0x10, 0x03, 1,
    ])
    expect(Array.from(createWriteHardwareSettingRequest('backlightBrightness', 7))).toEqual([
      0x7b, 0x12, 0x31, 0, 3, 0, 0, 0x7d, 0x20, 0x15, 7,
    ])
  })

  it('encodes sleep timeout as UInt16LE', () => {
    expect(Array.from(createWriteHardwareSettingRequest('sleepTimeoutRaw', 600))).toEqual([
      0x7b, 0x12, 0x31, 0, 4, 0, 0, 0x7d, 0x01, 0x0f, 0x58, 0x02,
    ])
  })

  it('retains operation-specific acknowledgement payloads', () => {
    const ack = new Uint8Array([0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x10, 0x03, 0, 0xaa])
    expect(parseWriteHardwareSettingResponse('magicFn', 1, ack)).toMatchObject({
      key: 'magicFn', value: 1, ackPayload: new Uint8Array([0]), trailingLength: 1,
    })
    const echoed = ack.slice()
    echoed[10] = 2
    expect(parseWriteHardwareSettingResponse('magicFn', 1, echoed).ackPayload).toEqual(new Uint8Array([2]))
  })

  it('rejects out-of-range values before transmission', () => {
    expect(() => createWriteHardwareSettingRequest('magicFn', 3)).toThrow(RangeError)
    expect(() => createWriteHardwareSettingRequest('backlightBrightness', 0)).toThrow(RangeError)
    expect(() => createWriteHardwareSettingRequest('sleepTimeoutRaw', 3601)).toThrow(RangeError)
  })
})
