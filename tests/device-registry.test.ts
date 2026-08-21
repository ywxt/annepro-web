import { describe, expect, it } from 'vitest'
import { getObinsModel, hasConfigurationProfile, isKnownObinsUsbDevice, isKnownObinsVendor, OBINS_USB_DEVICES } from '../src/device-registry.ts'

describe('device registry', () => {
  it('derives vendor and USB-pair membership from one registry', () => {
    expect(OBINS_USB_DEVICES).toHaveLength(18)
    expect(isKnownObinsVendor(0x3311)).toBe(true)
    expect(isKnownObinsUsbDevice(0x3311, 0xf005)).toBe(true)
    expect(isKnownObinsUsbDevice(0x3311, 0xffff)).toBe(false)
  })

  it('keeps model naming and configuration profiles together', () => {
    expect(getObinsModel(5)?.name).toBe('AnnePro2C18')
    expect(hasConfigurationProfile(5)).toBe(true)
    expect(hasConfigurationProfile(12)).toBe(false)
    expect(getObinsModel(16)).toBeNull()
  })
})
