import type { DeviceTypeResponse } from './device-info.ts'
import type { FirmwareVersions } from './firmware-info.ts'

export interface DeviceCapabilities {
  profileKnown: boolean
  keyboardLayers: boolean
  macros: boolean
  generalSettings: boolean
  bluetooth: boolean
  factoryReset: boolean
  hasLed: boolean | null
  hasIndicatorLed: boolean | null
  hasBattery: boolean | null
  audioVisualization: boolean | null
  modernTapSettings: boolean | null
  sleepTimeout: boolean | null
  ledPowerMode: boolean | null
  capslockColor: boolean | null
}

function compareVersion(left: string, right: string): number {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/** Capability gates reproduced from ObinsKit's model store, without probing HID. */
export function deriveDeviceCapabilities(
  deviceType: DeviceTypeResponse | null,
  firmware: FirmwareVersions | null,
): DeviceCapabilities | null {
  if (!deviceType) return null
  const isAnnePro2 = deviceType.model === 3 || deviceType.model === 5
  const keyVersion = firmware?.key
  return {
    profileKnown: isAnnePro2,
    keyboardLayers: isAnnePro2,
    macros: isAnnePro2,
    generalSettings: isAnnePro2,
    bluetooth: isAnnePro2,
    factoryReset: isAnnePro2,
    hasLed: isAnnePro2 ? true : null,
    hasIndicatorLed: isAnnePro2 ? false : null,
    hasBattery: isAnnePro2 ? true : null,
    audioVisualization: isAnnePro2 ? true : null,
    modernTapSettings: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.11') >= 0 : null,
    sleepTimeout: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.14') > 0 : null,
    ledPowerMode: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.35') > 0 : null,
    capslockColor: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.35') > 0 : null,
  }
}
