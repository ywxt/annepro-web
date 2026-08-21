import { collectMetadata } from './device.ts'
import type { DeviceSelection } from './types.ts'
import { isKnownObinsUsbDevice, OBINS_USB_DEVICES } from '../device-registry.ts'

/** VID/PID table reproduced from ObinsKit 1.2.11's Electron HID discovery. */
export const OBINSKIT_DEVICE_FILTERS: HIDDeviceFilter[] = OBINS_USB_DEVICES.map(
  ({ vendorId, productId }) => ({ vendorId, productId }),
)

/** Public compatibility alias retained for callers of the original API. */
export const ANNE_PRO_FILTERS = OBINSKIT_DEVICE_FILTERS

export const ANNE_PRO_PROTOCOL_FILTERS: HIDDeviceFilter[] = ANNE_PRO_FILTERS.map(
  (filter) => ({ ...filter, usagePage: 0x0001, usage: 0x0000 }),
)

export function isWebHidSupported(): boolean {
  return 'hid' in navigator
}

export function isAnneProDevice(device: Pick<HIDDevice, 'vendorId' | 'productId'>): boolean {
  return isKnownObinsUsbDevice(device.vendorId, device.productId)
}

function hasProtocolCollection(device: Pick<HIDDevice, 'collections'>): boolean {
  return collectMetadata(device.collections).some((collection) => collection.protocolCandidate)
}

export function selectPreferredDevice(devices: HIDDevice[]): HIDDevice | null {
  return devices.find(hasProtocolCollection)
    ?? devices.find((device) => device.collections.some((collection) =>
      (collection.inputReports?.length ?? 0)
      + (collection.outputReports?.length ?? 0)
      + (collection.featureReports?.length ?? 0) > 0,
    ))
    ?? devices[0]
    ?? null
}

export async function getGrantedAnneProDevices(): Promise<HIDDevice[]> {
  return (await navigator.hid.getDevices()).filter(isAnneProDevice)
}

export async function getPreferredGrantedAnneProDevice(): Promise<DeviceSelection> {
  const candidates = await getGrantedAnneProDevices()
  const device = selectPreferredDevice(candidates)
  return { device, candidates, hasProtocolCollection: device ? hasProtocolCollection(device) : false }
}

export async function requestAnneProDevice(): Promise<DeviceSelection> {
  // Keep permission discovery independent of OS-specific collection exposure.
  // Protected keyboard collections remain unavailable to WebHID; selection of
  // the 64-byte protocol collection happens from the granted metadata below.
  const requested = await navigator.hid.requestDevice({ filters: ANNE_PRO_FILTERS })
  const granted = await getGrantedAnneProDevices()
  const candidates = Array.from(new Set([...requested, ...granted]))
  const device = selectPreferredDevice(candidates)
  return {
    device,
    candidates,
    hasProtocolCollection: device ? hasProtocolCollection(device) : false,
  }
}
