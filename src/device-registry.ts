export type DeviceProfile = 'anne-pro-2' | 'identify-only'

export interface MacroMatrixOffset { key: number; offset: number }
export interface ObinsHardwareProfile {
  label: string
  keycapCount: number
  rowLengths: readonly number[]
  blankRgb: readonly number[]
  macroMatrixOffsets: readonly MacroMatrixOffset[]
  mcuLed: boolean
  mcuBle: boolean
  rgbLed: boolean
  keycodeWidth: 8 | 16
  bottomLightCount?: number
  bottomLightBlank?: readonly number[]
}
export interface ObinsModel { id: number; name: string; profile: DeviceProfile; family: string; traits: readonly string[]; hardware: ObinsHardwareProfile }
export interface ObinsUsbDevice { vendorId: number; productId: number; family: string }

const ANSI_61 = {
  keycapCount: 61, rowLengths: [14, 14, 13, 12, 8],
  blankRgb: [41, 43, 55, 57, 60, 61, 63, 64, 69],
  macroMatrixOffsets: [{ key: 40, offset: 1 }, { key: 41, offset: 2 }, { key: 52, offset: 3 }, { key: 53, offset: 4 }, { key: 55, offset: 6 }, { key: 56, offset: 8 }, { key: 60, offset: 9 }],
  keycodeWidth: 8,
} as const

const profiles = {
  anne: { ...ANSI_61, label: 'ANNE PRO', blankRgb: [40, 53, 54, 59, 60, 62, 63, 64, 65], mcuLed: true, mcuBle: true, rgbLed: true },
  annePro2: { ...ANSI_61, label: 'ANNE PRO 2', mcuLed: true, mcuBle: true, rgbLed: true },
  discovery: { ...ANSI_61, label: 'ANNE PRO 2 DISCOVERY', mcuLed: false, mcuBle: true, rgbLed: false },
  f61: { ...ANSI_61, label: 'APX-F61', blankRgb: [41, 43, 55, 57, 60, 61, 63, 64, 65], macroMatrixOffsets: ANSI_61.macroMatrixOffsets.slice(0, 6), mcuLed: true, mcuBle: false, rgbLed: false },
  f61v2: { ...ANSI_61, label: 'APX-F61', blankRgb: [41, 43, 55, 57, 60, 61, 63, 64, 65], macroMatrixOffsets: ANSI_61.macroMatrixOffsets.slice(0, 6), mcuLed: false, mcuBle: false, rgbLed: false },
  slim: { ...ANSI_61, label: 'ANNE PRO 2 SLIM', mcuLed: true, mcuBle: true, rgbLed: false },
  iso62: { label: 'ANNE PRO 2 ISO', keycapCount: 62, rowLengths: [14, 14, 13, 13, 8], blankRgb: [41, 55, 57, 60, 61, 63, 64, 69], macroMatrixOffsets: [{ key: 40, offset: 1 }, { key: 53, offset: 2 }, { key: 54, offset: 3 }, { key: 56, offset: 5 }, { key: 57, offset: 7 }, { key: 61, offset: 8 }], mcuLed: true, mcuBle: true, rgbLed: false, keycodeWidth: 8 },
  param68: { label: 'PARAM', keycapCount: 67, rowLengths: [15, 15, 14, 14, 9], blankRgb: [43, 46, 61, 64, 65, 67, 68, 69], macroMatrixOffsets: [{ key: 42, offset: 1 }, { key: 44, offset: 2 }, { key: 58, offset: 3 }, { key: 60, offset: 5 }, { key: 61, offset: 8 }, { key: 66, offset: 8 }], mcuLed: true, mcuBle: false, rgbLed: false, keycodeWidth: 8 },
  d87: { label: 'ANNE CLASSIC D87 RGB', keycapCount: 87, rowLengths: [16, 17, 17, 13, 13, 11], blankRgb: [1, 64, 65, 66, 67, 69, 81, 82, 84, 86, 89, 90, 92, 93, 98], macroMatrixOffsets: [{ key: 0, offset: 1 }, { key: 62, offset: 5 }, { key: 63, offset: 6 }, { key: 74, offset: 8 }, { key: 75, offset: 9 }, { key: 76, offset: 10 }, { key: 78, offset: 12 }, { key: 79, offset: 14 }, { key: 83, offset: 15 }, { key: 87, offset: 15 }], mcuLed: false, mcuBle: false, rgbLed: false, keycodeWidth: 8 },
  returnedWing: { label: 'Returned Wing', keycapCount: 80, rowLengths: [15, 16, 14, 13, 13, 9], blankRgb: [1, 46, 47, 61, 62, 63, 65, 77, 79, 81, 83, 84, 85, 87, 88, 92], macroMatrixOffsets: [{ key: 0, offset: 1 }, { key: 44, offset: 3 }, { key: 57, offset: 6 }, { key: 58, offset: 7 }, { key: 69, offset: 8 }, { key: 70, offset: 9 }, { key: 71, offset: 10 }, { key: 72, offset: 13 }, { key: 76, offset: 16 }, { key: 79, offset: 16 }], mcuLed: true, mcuBle: false, rgbLed: false, keycodeWidth: 8 },
  fuji65: { label: 'Fuji65', keycapCount: 66, rowLengths: [14, 15, 14, 14, 9], blankRgb: [14, 43, 46, 63, 64, 65, 67, 68, 69], macroMatrixOffsets: [{ key: 13, offset: 1 }, { key: 41, offset: 2 }, { key: 43, offset: 3 }, { key: 59, offset: 6 }, { key: 60, offset: 9 }, { key: 65, offset: 9 }], mcuLed: false, mcuBle: false, rgbLed: true, keycodeWidth: 8, bottomLightCount: 16, bottomLightBlank: [0, 7, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 24, 31] },
  fuji65Rgb: { label: 'Fuji65 RGB', keycapCount: 66, rowLengths: [14, 15, 14, 14, 9], blankRgb: [14, 43, 46, 63, 64, 65, 67, 68, 69], macroMatrixOffsets: [{ key: 13, offset: 1 }, { key: 41, offset: 2 }, { key: 43, offset: 3 }, { key: 59, offset: 6 }, { key: 60, offset: 9 }, { key: 65, offset: 9 }], mcuLed: false, mcuBle: false, rgbLed: false, keycodeWidth: 8, bottomLightCount: 16, bottomLightBlank: [0, 7, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 24, 31] },
  tenet70: { label: 'TENET 70', keycapCount: 73, rowLengths: [17, 17, 13, 16, 10], blankRgb: [46, 48, 49, 50, 62, 71, 72, 73, 75, 76, 77, 79], macroMatrixOffsets: [{ key: 46, offset: 4 }, { key: 47, offset: 5 }, { key: 65, offset: 6 }, { key: 66, offset: 7 }, { key: 69, offset: 12 }, { key: 72, offset: 12 }], mcuLed: false, mcuBle: false, rgbLed: false, keycodeWidth: 16 },
} as const satisfies Record<string, ObinsHardwareProfile>

/** Official model enum plus the lazy hardware profiles loaded by ObinsKit 1.2.11. */
export const OBINS_MODELS: readonly ObinsModel[] = [
  { id: 1, name: 'Anne', profile: 'identify-only', family: 'Anne legacy', traits: ['61-key', 'RGB', 'BLE'], hardware: profiles.anne },
  { id: 2, name: 'AnnePro', profile: 'identify-only', family: 'Anne Pro 1', traits: ['61-key', 'RGB', 'BLE'], hardware: profiles.anne },
  { id: 3, name: 'AnnePro2', profile: 'anne-pro-2', family: 'Anne Pro 2', traits: ['61-key', 'RGB', 'BLE'], hardware: profiles.annePro2 },
  { id: 4, name: 'AnneProISO', profile: 'identify-only', family: 'Anne Pro 2 ISO', traits: ['62-key', 'ISO', 'RGB', 'BLE'], hardware: profiles.iso62 },
  { id: 5, name: 'AnnePro2C18', profile: 'anne-pro-2', family: 'Anne Pro 2', traits: ['61-key', 'RGB', 'BLE'], hardware: profiles.annePro2 },
  { id: 6, name: 'Param68', profile: 'identify-only', family: 'Param68', traits: ['67-key', 'RGB'], hardware: profiles.param68 },
  { id: 7, name: 'AnneClassicD87', profile: 'identify-only', family: 'D87', traits: ['87-key', 'indicator LED'], hardware: profiles.d87 },
  { id: 8, name: 'ApxF61', profile: 'identify-only', family: 'F61', traits: ['61-key', 'MCU LED'], hardware: profiles.f61 },
  { id: 9, name: 'ReturnedWing', profile: 'identify-only', family: 'Returned Wing', traits: ['80-key', 'MCU LED'], hardware: profiles.returnedWing },
  { id: 10, name: 'AnnePro2Slim', profile: 'identify-only', family: 'Anne Pro 2 Slim', traits: ['61-key', 'BLE'], hardware: profiles.slim },
  { id: 11, name: 'ApxFuji65', profile: 'identify-only', family: 'Fuji65', traits: ['66-key', 'bottom light'], hardware: profiles.fuji65 },
  { id: 12, name: 'ApxTenet70', profile: 'identify-only', family: 'Tenet 70', traits: ['73-key', 'OLED', '16-bit keycodes'], hardware: profiles.tenet70 },
  { id: 13, name: 'ApxFuji65Rgb', profile: 'identify-only', family: 'Fuji65 RGB', traits: ['66-key', 'RGB', 'bottom light'], hardware: profiles.fuji65Rgb },
  { id: 14, name: 'AnnePro2Discovery', profile: 'identify-only', family: 'Anne Pro 2 Discovery', traits: ['61-key', 'BLE', 'battery variant'], hardware: profiles.discovery },
  { id: 17, name: 'ApxF61V2', profile: 'identify-only', family: 'F61 V2', traits: ['61-key'], hardware: profiles.f61v2 },
  { id: 33, name: 'W800', profile: 'identify-only', family: 'W800', traits: ['87-key', 'D87 profile'], hardware: profiles.d87 },
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
