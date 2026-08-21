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
    expect(getObinsModel(5)).toMatchObject({ family: 'Anne Pro 2', traits: ['61-key', 'RGB', 'BLE'] })
    expect(getObinsModel(12)).toMatchObject({ family: 'Tenet 70', traits: ['73-key', 'OLED', '16-bit keycodes'] })
    expect(hasConfigurationProfile(5)).toBe(true)
    expect(hasConfigurationProfile(12)).toBe(false)
    expect(getObinsModel(16)).toBeNull()
  })

  it('reproduces official non-C18 hardware profiles', () => {
    expect(getObinsModel(4)?.hardware).toMatchObject({ keycapCount: 62, rowLengths: [14, 14, 13, 13, 8] })
    expect(getObinsModel(6)?.hardware).toMatchObject({ keycapCount: 67, rowLengths: [15, 15, 14, 14, 9] })
    expect(getObinsModel(7)?.hardware).toMatchObject({ keycapCount: 87, mcuLed: false })
    expect(getObinsModel(9)?.hardware).toMatchObject({ keycapCount: 80, mcuLed: true })
    expect(getObinsModel(11)?.hardware).toMatchObject({ keycapCount: 66, bottomLightCount: 16, rgbLed: true })
    expect(getObinsModel(12)?.hardware).toMatchObject({ keycapCount: 73, keycodeWidth: 16 })
    expect(getObinsModel(14)?.hardware).toMatchObject({ mcuLed: false, mcuBle: true })
    expect(getObinsModel(33)?.hardware).toEqual(getObinsModel(7)?.hardware)
  })
})
