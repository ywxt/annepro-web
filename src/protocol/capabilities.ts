import type { DeviceTypeResponse } from './device-info.ts'
import type { FirmwareVersions } from './firmware-info.ts'
import { getObinsModel, hasConfigurationProfile } from '../device-registry.ts'

export interface DeviceCapabilities {
  profileKnown: boolean
  keyboardLayers: boolean
  macros: boolean
  generalSettings: boolean
  bluetooth: boolean
  factoryReset: boolean
  hasLed: boolean | null
  hasIndicatorLed: boolean | null
  indicatorLocation: boolean | null
  hasBattery: boolean | null
  batteryPercentage: boolean | null
  audioVisualization: boolean | null
  advancedAudioProtocol: boolean | null
  oled: boolean | null
  combinationMode: boolean | null
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
  const isAnnePro2 = hasConfigurationProfile(deviceType.model)
  const model = getObinsModel(deviceType.model)
  const keyVersion = firmware?.key
  const usesAnnePro2Audio = model ? [3, 4, 5].includes(model.id) : false
  return {
    profileKnown: isAnnePro2,
    keyboardLayers: model !== null,
    macros: isAnnePro2,
    generalSettings: isAnnePro2,
    bluetooth: isAnnePro2,
    factoryReset: isAnnePro2,
    hasLed: isAnnePro2 ? true : null,
    hasIndicatorLed: isAnnePro2 ? false : null,
    indicatorLocation: model ? model.id === 7 || model.id === 12 : null,
    hasBattery: model ? model.hardware.mcuBle : null,
    batteryPercentage: model ? model.id === 14 : null,
    audioVisualization: isAnnePro2 ? true : null,
    advancedAudioProtocol: model ? model.hardware.mcuLed && !usesAnnePro2Audio : null,
    oled: model ? model.id === 12 : null,
    combinationMode: model ? model.id === 12 : null,
    modernTapSettings: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.11') >= 0 : null,
    sleepTimeout: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.14') > 0 : null,
    ledPowerMode: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.35') > 0 : null,
    capslockColor: isAnnePro2 && keyVersion ? compareVersion(keyVersion, '2.35') > 0 : null,
  }
}
