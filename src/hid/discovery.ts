import { collectMetadata } from './device.ts'
import type { DeviceSelection } from './types.ts'

/** VID/PID table reproduced from ObinsKit 1.2.11's Electron HID discovery. */
export const OBINSKIT_DEVICE_FILTERS: HIDDeviceFilter[] = [
  { vendorId: 0x0483, productId: 0x5710 },
  { vendorId: 0x04d9, productId: 0xa293 },
  { vendorId: 0x04d9, productId: 0xa292 },
  { vendorId: 0x04d9, productId: 0x8008 },
  { vendorId: 0x04d9, productId: 0x8009 },
  ...[0xa294, 0xa295, 0xa296, 0xa297, 0xa298, 0xa299, 0xf000, 0xf001, 0xf002, 0xf003, 0xf005, 0xf006]
    .map(productId => ({ vendorId: 0x3311, productId })),
  { vendorId: 0x000d, productId: 0xf0e0 },
]

/** Public compatibility alias retained for callers of the original API. */
export const ANNE_PRO_FILTERS = OBINSKIT_DEVICE_FILTERS

export const ANNE_PRO_PROTOCOL_FILTERS: HIDDeviceFilter[] = ANNE_PRO_FILTERS.map(
  (filter) => ({ ...filter, usagePage: 0x0001, usage: 0x0000 }),
)

export function isWebHidSupported(): boolean {
  return 'hid' in navigator
}

const supportedDevices = new Set(OBINSKIT_DEVICE_FILTERS.map(({ vendorId, productId }) => `${vendorId}:${productId}`))

export function isAnneProDevice(device: Pick<HIDDevice, 'vendorId' | 'productId'>): boolean {
  return supportedDevices.has(`${device.vendorId}:${device.productId}`)
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
