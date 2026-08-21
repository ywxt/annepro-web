import { decodeMacroEvents, type ActiveMacroBinding, type StoredMacro } from './macro-info.ts'
import { lightingProfileForModel, normalizeLightEffects, type LightEffect } from './lighting.ts'
import { createWriteHardwareSettingRequest, type HardwareSettingKey } from './settings-write.ts'
import { hasConfigurationProfile, isKnownObinsUsbDevice } from '../device-registry.ts'

type RequiredSetting = Exclude<HardwareSettingKey, 'ledPowerMode' | 'sleepTimeoutRaw'>

const SETTINGS: readonly RequiredSetting[] = [
  'userLayout', 'magicFn', 'macroTrigger', 'capslockLed', 'backlightBrightness',
  'ledHold', 'tapStatus', 'tapActMode', 'tapTimeoutValue',
]

type FullBackupSettings = Record<RequiredSetting, number> & {
  sleepTimeoutRaw?: number
  ledPowerMode?: number
  indicatorColor?: string
}

export interface ParsedFullBackup {
  device: { vendorId: number; productId: number; model: number; type: number }
  settings: FullBackupSettings
  layers: Uint8Array[]
  macros: StoredMacro[]
  bindings: ActiveMacroBinding[]
  lights: LightEffect[]
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`)
  return value as number
}

function byteArray(value: unknown, length: number | null, label: string): Uint8Array {
  if (!Array.isArray(value) || (length !== null && value.length !== length)
    || !value.every(item => Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 255)) {
    throw new Error(`${label} must be ${length ?? 'an'} byte array${length === null ? '' : ` of length ${length}`}`)
  }
  return new Uint8Array(value as number[])
}

export function parseFullBackup(value: unknown): ParsedFullBackup {
  const root = object(value, 'Backup')
  if (root.format !== 'annepro-web-full-backup' || root.version !== 1) throw new Error('Unsupported full backup format or version')
  const sourceDevice = object(root.device, 'device')
  const device = {
    vendorId: integer(sourceDevice.vendorId, 'device.vendorId'),
    productId: integer(sourceDevice.productId, 'device.productId'),
    model: integer(sourceDevice.model, 'device.model'),
    type: integer(sourceDevice.type, 'device.type'),
  }
  if (!isKnownObinsUsbDevice(device.vendorId, device.productId)
    || !hasConfigurationProfile(device.model) || device.type !== 1) {
    throw new Error('Backup is not from a supported Obins keyboard profile')
  }

  const sourceSettings = object(root.settings, 'settings')
  const settings = {} as ParsedFullBackup['settings']
  for (const key of SETTINGS) {
    const setting = integer(sourceSettings[key], `settings.${key}`)
    createWriteHardwareSettingRequest(key, setting)
    settings[key] = setting
  }
  if (sourceSettings.ledPowerMode !== undefined) {
    const mode = integer(sourceSettings.ledPowerMode, 'settings.ledPowerMode')
    createWriteHardwareSettingRequest('ledPowerMode', mode)
    settings.ledPowerMode = mode
  }
  if (sourceSettings.sleepTimeoutRaw !== undefined) {
    const timeout = integer(sourceSettings.sleepTimeoutRaw, 'settings.sleepTimeoutRaw')
    createWriteHardwareSettingRequest('sleepTimeoutRaw', timeout)
    settings.sleepTimeoutRaw = timeout
  }
  if (sourceSettings.indicatorColor !== undefined) {
    if (typeof sourceSettings.indicatorColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(sourceSettings.indicatorColor)) throw new Error('settings.indicatorColor must be #RRGGBB')
    settings.indicatorColor = sourceSettings.indicatorColor.toLowerCase()
  }

  if (!Array.isArray(root.layers) || root.layers.length !== 4) throw new Error('Backup must contain exactly four layers')
  const sourceLayers = root.layers
  const layers = Array.from({ length: 4 }, (_, index) => {
    const layer = sourceLayers.map(item => object(item, 'layer')).find(item => item.index === index)
    if (!layer) throw new Error(`Layer ${index} is missing`)
    return byteArray(layer.keycodes, 61, `Layer ${index}`)
  })

  const sourceMacros = object(root.macros, 'macros')
  if (!Array.isArray(sourceMacros.items) || sourceMacros.items.length > 16) throw new Error('macros.items must contain at most 16 macros')
  const macros = sourceMacros.items.map((item, index): StoredMacro => {
    const macro = object(item, `Macro ${index}`)
    const events = byteArray(macro.events, null, `Macro ${index} events`)
    decodeMacroEvents(events)
    const name = typeof macro.name === 'string' ? macro.name : ''
    const icon = integer(macro.icon, `Macro ${index} icon`)
    if (name.length > 64 || icon < 0 || icon > 0xffff) throw new Error(`Macro ${index} metadata is out of range`)
    return { id: index, uuid: typeof macro.uuid === 'string' ? macro.uuid : '0', name, icon, events, separator: new Uint8Array([0, 0, 0]) }
  })
  if (!Array.isArray(sourceMacros.activeList) || sourceMacros.activeList.length > 64) throw new Error('macros.activeList must contain at most 64 bindings')
  const bindings = sourceMacros.activeList.map((item, index): ActiveMacroBinding => {
    const binding = object(item, `Binding ${index}`)
    const result = { layer: integer(binding.layer, `Binding ${index} layer`), matrixPosition: integer(binding.matrixPosition, `Binding ${index} matrixPosition`), macroIndex: integer(binding.macroIndex, `Binding ${index} macroIndex`) }
    if (result.layer < 0 || result.layer > 3 || result.matrixPosition < 0 || result.matrixPosition > 255 || result.macroIndex < 0 || result.macroIndex >= macros.length) throw new Error(`Binding ${index} is out of range`)
    return result
  })
  if (macros.some((_, index) => !bindings.some(binding => binding.macroIndex === index))) throw new Error('Every stored macro must have at least one binding')

  const lights = normalizeLightEffects(root.lights, lightingProfileForModel(device.model))
  return { device, settings, layers, macros, bindings, lights }
}
