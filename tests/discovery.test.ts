import { describe, expect, it } from 'vitest'
import {
  ANNE_PRO_PROTOCOL_FILTERS,
  isAnneProDevice,
  selectPreferredDevice,
} from '../src/hid/discovery.ts'

function device(usagePage: number, vendorId = 0x04d9, productId = 0xa293): HIDDevice {
  return {
    vendorId,
    productId,
    collections: [{ usagePage, usage: 1, children: [] }],
  } as unknown as HIDDevice
}

function protocolDevice(): HIDDevice {
  const report = { reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }
  return {
    vendorId: 0x04d9,
    productId: 0xa293,
    collections: [{
      usagePage: 1,
      usage: 0,
      inputReports: [report],
      outputReports: [report],
      children: [],
    }],
  } as unknown as HIDDevice
}

describe('Anne Pro discovery', () => {
  it('narrows every supported product filter to the observed protocol usage', () => {
    expect(ANNE_PRO_PROTOCOL_FILTERS).toHaveLength(4)
    expect(ANNE_PRO_PROTOCOL_FILTERS.every(
      ({ vendorId, usagePage, usage }) => vendorId === 0x04d9
        && usagePage === 0x0001
        && usage === 0x0000,
    )).toBe(true)
  })

  it('accepts only known Anne Pro vendor/product pairs', () => {
    expect(isAnneProDevice(device(1))).toBe(true)
    expect(isAnneProDevice(device(1, 0x1234))).toBe(false)
    expect(isAnneProDevice(device(1, 0x04d9, 0xffff))).toBe(false)
  })

  it('prefers the vendor-defined interface over a protected keyboard collection', () => {
    const keyboard = device(0x0001)
    const vendor = device(0xff00)
    expect(selectPreferredDevice([keyboard, vendor])).toBe(vendor)
  })

  it('recognizes the observed Anne Pro 2 64-byte protocol interface', () => {
    const keyboard = device(0x0001)
    const protocol = protocolDevice()
    expect(selectPreferredDevice([keyboard, protocol])).toBe(protocol)
  })

  it('falls back to the first candidate when descriptors expose no reports', () => {
    const keyboard = device(0x0001)
    expect(selectPreferredDevice([keyboard])).toBe(keyboard)
    expect(selectPreferredDevice([])).toBeNull()
  })
})
