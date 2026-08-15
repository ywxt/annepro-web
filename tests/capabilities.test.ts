import { describe, expect, it } from 'vitest'
import { deriveDeviceCapabilities } from '../src/protocol/capabilities.ts'
import type { DeviceTypeResponse } from '../src/protocol/device-info.ts'
import type { FirmwareVersions } from '../src/protocol/firmware-info.ts'

const device = { model: 5, modelName: 'AnnePro2C18', type: 1, typeName: 'Keyboard', rawFrame: new Uint8Array(), trailingLength: 0 } satisfies DeviceTypeResponse
const firmware = { key: '2.36', led: '2.33', ble: '2.05', rawFrame: new Uint8Array(), trailingLength: 0 } satisfies FirmwareVersions

describe('ObinsKit capability gates', () => {
  it('derives the captured C18 feature set', () => {
    expect(deriveDeviceCapabilities(device, firmware)).toEqual({
      profileKnown: true, hasLed: true, hasIndicatorLed: false, hasBattery: true,
      audioVisualization: true, modernTapSettings: true, sleepTimeout: true,
      ledPowerMode: true,
    })
  })

  it('waits for firmware before applying version gates', () => {
    expect(deriveDeviceCapabilities(device, null)).toMatchObject({
      modernTapSettings: null, sleepTimeout: null, ledPowerMode: null,
    })
  })

  it('does not invent capabilities for unknown models', () => {
    expect(deriveDeviceCapabilities({ ...device, model: 99 }, firmware)).toMatchObject({
      profileKnown: false, hasLed: null, hasIndicatorLed: null, hasBattery: null,
    })
  })
})
