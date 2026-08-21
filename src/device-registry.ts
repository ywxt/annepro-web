export type DeviceProfile = 'anne-pro-2' | 'identify-only'
export interface ObinsModel { id: number; name: string; profile: DeviceProfile }
export interface ObinsUsbDevice { vendorId: number; productId: number; family: string }

/** Model enum from ObinsKit 1.2.11 module 46733. */
export const OBINS_MODELS: readonly ObinsModel[] = [
  { id: 1, name: 'Anne', profile: 'identify-only' }, { id: 2, name: 'AnnePro', profile: 'identify-only' },
  { id: 3, name: 'AnnePro2', profile: 'anne-pro-2' }, { id: 4, name: 'AnneProISO', profile: 'identify-only' },
  { id: 5, name: 'AnnePro2C18', profile: 'anne-pro-2' }, { id: 6, name: 'Param68', profile: 'identify-only' },
  { id: 7, name: 'AnneClassicD87', profile: 'identify-only' }, { id: 8, name: 'ApxF61', profile: 'identify-only' },
  { id: 9, name: 'ReturnedWing', profile: 'identify-only' }, { id: 10, name: 'AnnePro2Slim', profile: 'identify-only' },
  { id: 11, name: 'ApxFuji65', profile: 'identify-only' }, { id: 12, name: 'ApxTenet70', profile: 'identify-only' },
  { id: 13, name: 'ApxFuji65Rgb', profile: 'identify-only' }, { id: 14, name: 'AnnePro2Discovery', profile: 'identify-only' },
  { id: 17, name: 'ApxF61V2', profile: 'identify-only' }, { id: 33, name: 'W800', profile: 'identify-only' },
]

/** Exact VID/PID discovery table from ObinsKit 1.2.11's Electron main process. */
export const OBINS_USB_DEVICES: readonly ObinsUsbDevice[] = [
  { vendorId: 0x0483, productId: 0x5710, family: 'Anne Pro 1' },
  ...[0x8008, 0x8009, 0xa292, 0xa293].map(productId => ({ vendorId: 0x04d9, productId, family: 'Anne Pro 2' })),
  ...[0xa294, 0xa295, 0xa296, 0xa297, 0xa298, 0xa299, 0xf000, 0xf001, 0xf002, 0xf003, 0xf005, 0xf006].map(productId => ({ vendorId: 0x3311, productId, family: 'ObinsLab extended' })),
  { vendorId: 0x000d, productId: 0xf0e0, family: 'Anne Pro 2 special' },
]

const modelsById = new Map(OBINS_MODELS.map(model => [model.id, model]))
const usbDeviceKeys = new Set(OBINS_USB_DEVICES.map(device => `${device.vendorId}:${device.productId}`))
const vendorIds = new Set(OBINS_USB_DEVICES.map(device => device.vendorId))

export function getObinsModel(modelId: number): ObinsModel | null { return modelsById.get(modelId) ?? null }
export function hasConfigurationProfile(modelId: number): boolean { return getObinsModel(modelId)?.profile === 'anne-pro-2' }
export function isKnownObinsUsbDevice(vendorId: number, productId: number): boolean { return usbDeviceKeys.has(`${vendorId}:${productId}`) }
export function isKnownObinsVendor(vendorId: number): boolean { return vendorIds.has(vendorId) }
