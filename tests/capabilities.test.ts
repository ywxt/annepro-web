import { describe, expect, it } from 'vitest'
import { deriveDeviceCapabilities } from '../src/protocol/capabilities.ts'
import type { DeviceTypeResponse } from '../src/protocol/device-info.ts'
import type { FirmwareVersions } from '../src/protocol/firmware-info.ts'

const device = { model: 5, modelName: 'AnnePro2C18', type: 1, typeName: 'Keyboard', rawFrame: new Uint8Array(), trailingLength: 0 } satisfies DeviceTypeResponse
const firmware = { key: '2.36', led: '2.33', ble: '2.05', rawFrame: new Uint8Array(), trailingLength: 0 } satisfies FirmwareVersions

describe('ObinsKit capability gates', () => {
  it('derives the captured C18 feature set', () => {
    expect(deriveDeviceCapabilities(device, firmware)).toEqual({
      profileKnown: true, keyboardLayers: true, macros: true, generalSettings: true,
      bluetooth: true, factoryReset: true, hasLed: true, hasIndicatorLed: false, indicatorLocation: false, hasBattery: true,
      batteryPercentage: false,
      audioVisualization: true, advancedAudioProtocol: false, modernTapSettings: true, sleepTimeout: true,
      ledPowerMode: true, capslockColor: true,
    })
  })

  it('waits for firmware before applying version gates', () => {
    expect(deriveDeviceCapabilities(device, null)).toMatchObject({
      modernTapSettings: null, sleepTimeout: null, ledPowerMode: null,
    })
  })

  it('does not invent capabilities for unknown models', () => {
    expect(deriveDeviceCapabilities({ ...device, model: 99 }, firmware)).toEqual({
      profileKnown: false, keyboardLayers: false, macros: false, generalSettings: false,
      bluetooth: false, factoryReset: false, hasLed: null, hasIndicatorLed: null, indicatorLocation: null, hasBattery: null,
      batteryPercentage: null,
      audioVisualization: null, advancedAudioProtocol: null, modernTapSettings: null, sleepTimeout: null,
      ledPowerMode: null, capslockColor: null,
    })
  })

  it('selects the static advanced MCU-LED route only for matching non-AP2 models', () => {
    expect(deriveDeviceCapabilities({ ...device, model: 8 }, firmware)).toMatchObject({ advancedAudioProtocol: true })
    expect(deriveDeviceCapabilities({ ...device, model: 6 }, firmware)).toMatchObject({ advancedAudioProtocol: true })
    expect(deriveDeviceCapabilities({ ...device, model: 7 }, firmware)).toMatchObject({ advancedAudioProtocol: false })
    expect(deriveDeviceCapabilities({ ...device, model: 4 }, firmware)).toMatchObject({ advancedAudioProtocol: false })
  })

  it('selects the direct battery-percentage route for Discovery', () => {
    expect(deriveDeviceCapabilities({ ...device, model: 14 }, firmware)).toMatchObject({
      profileKnown: false, hasBattery: true, batteryPercentage: true,
    })
    expect(deriveDeviceCapabilities({ ...device, model: 12 }, firmware)).toMatchObject({
      hasBattery: false, batteryPercentage: false,
    })
  })

  it('gates the native indicator-location route to D87', () => {
    expect(deriveDeviceCapabilities({ ...device, model: 7 }, firmware)).toMatchObject({ keyboardLayers: true, indicatorLocation: true })
    expect(deriveDeviceCapabilities({ ...device, model: 33 }, firmware)).toMatchObject({ indicatorLocation: false })
    expect(deriveDeviceCapabilities({ ...device, model: 12 }, firmware)).toMatchObject({ indicatorLocation: true })
  })

  it('gates firmware-dependent controls on older Anne Pro 2 firmware', () => {
    expect(deriveDeviceCapabilities(device, { ...firmware, key: '2.10' })).toMatchObject({
      keyboardLayers: true, macros: true, generalSettings: true, bluetooth: true,
      modernTapSettings: false, sleepTimeout: false, ledPowerMode: false, capslockColor: false,
    })
  })
})
