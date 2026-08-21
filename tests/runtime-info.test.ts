import { describe, expect, it } from 'vitest'
import { batteryPercent, createReadBatteryPercentageRequest, createReadBatteryRequest, createReadPowerOnTimeRequest, parseBatteryPercentageResponse, parseBatteryResponse, parsePowerOnTimeResponse } from '../src/protocol/runtime-info.ts'

describe('runtime information protocol', () => {
  it('creates the statically identified requests', () => {
    expect(Array.from(createReadPowerOnTimeRequest()).slice(-2)).toEqual([1, 2])
    expect(Array.from(createReadBatteryRequest()).slice(-2)).toEqual([1, 5])
    expect(Array.from(createReadBatteryPercentageRequest()).slice(-2)).toEqual([1, 0x11])
  })
  it('parses the physical C18 power-on-time capture', () => {
    const parsed = parsePowerOnTimeResponse(new Uint8Array([0x7b,0x12,0x13,0,6,0,0,0x7d,1,2,0x58,0x29,0,0,0xaa]))
    expect(parsed.hours).toBe(10584)
    expect(parsed.trailingLength).toBe(1)
  })
  it('parses ADC voltage using the exact ObinsKit curve', () => {
    const parsed = parseBatteryResponse(new Uint8Array([0x7b,0x12,0x13,0,6,0,0,0x7d,1,5,0x78,0x0a,0,0]))
    expect(parsed.adc).toBe(2680)
    expect(parsed.voltage).toBeCloseTo(4.05763, 5)
    expect(parsed.percent).toBe(94)
    expect(batteryPercent(4.1)).toBe(100)
    expect(batteryPercent(3.3)).toBe(0)
  })
  it('parses the official Discovery direct-percentage variant', () => {
    const parsed = parseBatteryPercentageResponse(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,1,0x11,87]))
    expect(parsed).toMatchObject({ source: 'percentage', percent: 87, adc: null, voltage: null })
    expect(() => parseBatteryPercentageResponse(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,1,0x11,101]))).toThrow('out of range')
  })
  it('rejects wrong actions and lengths', () => {
    expect(() => parseBatteryResponse(new Uint8Array([0x7b,0x12,0x13,0,2,0,0,0x7d,1,2]))).toThrow('expected runtime')
    expect(() => parsePowerOnTimeResponse(new Uint8Array([0x7b,0x12,0x13,0,3,0,0,0x7d,1,2,0]))).toThrow('must be 4 bytes')
  })
})
