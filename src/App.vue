<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CollectionsView from './components/CollectionsView.vue'
import DevicePanel from './components/DevicePanel.vue'
import KeyboardLayout from './components/KeyboardLayout.vue'
import LightingPanel from './components/LightingPanel.vue'
import MacroPanel from './components/MacroPanel.vue'
import ReportsView from './components/ReportsView.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import RuntimeInfoPanel from './components/RuntimeInfoPanel.vue'
import AudioVisualizePanel from './components/AudioVisualizePanel.vue'
import IdentityPanel from './components/IdentityPanel.vue'
import FactoryResetPanel from './components/FactoryResetPanel.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import PlatformRequirements from './components/PlatformRequirements.vue'
import { appLocale } from './i18n.ts'
import { collectMetadata } from './hid/device.ts'
import { getPreferredGrantedAnneProDevice, isWebHidSupported, requestAnneProDevice } from './hid/discovery.ts'
import type { DeviceSelection } from './hid/types.ts'
import { AnneProHidTransport } from './hid/transport.ts'
import type { InputReportRecord } from './hid/types.ts'
import { deriveDeviceCapabilities } from './protocol/capabilities.ts'
import type { DeviceTypeResponse } from './protocol/device-info.ts'
import type { FirmwareVersions } from './protocol/firmware-info.ts'
import type { IapModeResponse } from './protocol/iap-info.ts'
import type { HardwareState } from './protocol/hardware-state.ts'
import type { KeyboardLayerResponse } from './protocol/layout.ts'
import type { ActiveMacroBinding, MacroBackup, StoredMacro } from './protocol/macro-info.ts'
import type { LedPowerModeResponse } from './protocol/led-power.ts'
import type { HardwareSettingKey } from './protocol/settings-write.ts'
import { encodeLightRgb, type LightEffect } from './protocol/lighting.ts'
import { bytesToHex } from './protocol/packet.ts'
import type { BatteryResponse, PowerOnTimeResponse } from './protocol/runtime-info.ts'
import { audioRgbFromFrequencyData, type AudioVisualizeMode } from './protocol/audio-visualize.ts'
import type { BleMacAddress, DeviceUdid } from './protocol/device-identity.ts'
import type { IndicatorColorResponse } from './protocol/indicator-color.ts'
import { annePro2FactoryLights, ANNE_PRO_2_FACTORY_SETTINGS } from './protocol/factory-defaults.ts'
import { parseFullBackup } from './protocol/full-backup.ts'

const supported = isWebHidSupported()
const { t } = useI18n({ useScope: 'global' })
const connecting = ref(false)
const message = ref(supported ? '' : t('app.unsupported'))
watch(appLocale, () => { message.value = supported ? '' : t('app.unsupported') })
const device = shallowRef<HIDDevice | null>(null)
const transport = shallowRef<AnneProHidTransport | null>(null)
const protocolReady = ref(false)
const busy = ref<string | null>(null)
const records = ref<InputReportRecord[]>([])
const deviceType = ref<DeviceTypeResponse | null>(null)
const firmware = ref<FirmwareVersions | null>(null)
const iap = ref<IapModeResponse | null>(null)
const hardwareState = ref<HardwareState | null>(null)
const macroBackup = ref<MacroBackup | null>(null)
const originalMacroBackup = ref<MacroBackup | null>(null)
const ledPowerMode = ref<LedPowerModeResponse | null>(null)
const battery = ref<BatteryResponse | null>(null)
const powerOnTime = ref<PowerOnTimeResponse | null>(null)
const udid = ref<DeviceUdid | null>(null)
const bleMac = ref<BleMacAddress | null>(null)
const indicatorColor = ref<IndicatorColorResponse | null>(null)
const indicatorColorBackup = ref<string | null>(null)
const audioRunning = ref(false)
const audioMode = ref<AudioVisualizeMode>('pure')
const audioColor = ref('#00ff80')
const audioFrames = ref(0)
type WorkspaceSection = 'device' | 'keys' | 'lighting' | 'macros'
const activeSection = ref<WorkspaceSection>('device')
const activeLayer = ref(0)
const settingsBackup = ref<{ state: HardwareState; ledPowerMode: LedPowerModeResponse | null } | null>(null)
const layers = shallowRef<Array<KeyboardLayerResponse | null>>([null, null, null, null])
const layerBackups = shallowRef<Array<Uint8Array | null>>([null, null, null, null])
const LIGHT_STORAGE_KEY = 'annepro-web-light-effects-v1'
const lightEffects = ref<LightEffect[]>(loadLightEffects())
const collections = computed(() => device.value ? collectMetadata(device.value.collections) : [])
const loadedLayers = computed(() => layers.value.filter((layer): layer is KeyboardLayerResponse => layer !== null))
const allLayersLoaded = computed(() => loadedLayers.value.length === 4)
const capabilities = computed(() => deriveDeviceCapabilities(deviceType.value, firmware.value))
const navigation = computed<Array<{ id: WorkspaceSection; label: string }>>(() => {
  const items: Array<{ id: WorkspaceSection; label: string }> = [{ id: 'device', label: t('nav.device') }]
  if (capabilities.value?.keyboardLayers) items.push({ id: 'keys', label: t('nav.keys') })
  if (capabilities.value?.hasLed) items.push({ id: 'lighting', label: t('nav.lighting') })
  if (capabilities.value?.macros) items.push({ id: 'macros', label: t('nav.macros') })
  return items
})
const fullBackupReady = computed(() => Boolean(
  deviceType.value && firmware.value && hardwareState.value && macroBackup.value && allLayersLoaded.value
  && (!capabilities.value?.ledPowerMode || ledPowerMode.value)
  && (!capabilities.value?.capslockColor || indicatorColor.value),
))
let stopListening: (() => void) | null = null
let audioStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let audioTimer: number | null = null
let audioSending = false

function loadLightEffects(): LightEffect[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LIGHT_STORAGE_KEY) ?? 'null')
    if (!Array.isArray(parsed)) throw new Error('not an array')
    const effects = parsed as LightEffect[]
    effects.forEach(encodeLightRgb)
    return effects.slice(0, 32)
  } catch {
    return [{ name: 'Red', type: 1, colors: ['#ff0000'] }]
  }
}

watch(lightEffects, effects => localStorage.setItem(LIGHT_STORAGE_KEY, JSON.stringify(effects)), { deep: true })
watch(navigation, items => {
  if (!items.some(item => item.id === activeSection.value)) activeSection.value = 'device'
})

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function connect(): Promise<void> {
  connecting.value = true
  message.value = t('notice.selecting')
  try {
    await useSelection(await requestAnneProDevice())
  } catch (error) {
    message.value = t('notice.failed', { name: t('app.connect'), error: error instanceof Error ? error.message : String(error) })
  } finally { connecting.value = false }
}

async function useSelection(selection: DeviceSelection): Promise<void> {
  if (!selection.device) { message.value = t('notice.noDevice'); return }
  const previous = transport.value
  const nextTransport = new AnneProHidTransport(selection.device)
  await nextTransport.open()
  stopListening?.()
  if (previous && previous.device !== selection.device) await previous.close().catch(() => undefined)
  device.value = selection.device
  transport.value = nextTransport
  protocolReady.value = selection.hasProtocolCollection
  stopListening = nextTransport.listen((record) => records.value.unshift(record))
  message.value = selection.hasProtocolCollection ? t('notice.connected') : t('notice.noProtocol')
  if (selection.hasProtocolCollection) await readAll()
}

async function reconnectGranted(): Promise<void> {
  connecting.value = true
  message.value = t('notice.connecting')
  try { await useSelection(await getPreferredGrantedAnneProDevice()) }
  catch (error) { message.value = t('notice.failed', { name: t('app.reconnect'), error: error instanceof Error ? error.message : String(error) }) }
  finally { connecting.value = false }
}

function onHidDisconnect(event: HIDConnectionEvent): void {
  if (event.device !== device.value) return
  void stopAudioVisualize(false)
  stopListening?.()
  stopListening = null
  transport.value = null
  protocolReady.value = false
  message.value = t('notice.disconnected')
}

function onHidConnect(event: HIDConnectionEvent): void {
  if (event.device.vendorId === 0x04d9) message.value = t('notice.reinserted')
}

onMounted(() => {
  if (!supported) return
  navigator.hid.addEventListener('disconnect', onHidDisconnect)
  navigator.hid.addEventListener('connect', onHidConnect)
})

async function confirmedRead<T>(name: string, read: () => Promise<T>, assign: (value: T) => void): Promise<void> {
  busy.value = name
  message.value = t('notice.waiting', { name })
  try { assign(await read()); message.value = t('notice.done', { name }) }
  catch (error) { message.value = t('notice.failed', { name, error: error instanceof Error ? error.message : String(error) }) }
  finally { busy.value = null }
}

const readDeviceType = () => transport.value && confirmedRead('readDeviceType', () => transport.value!.readDeviceType(), value => { deviceType.value = value })
const readFirmware = () => transport.value && confirmedRead('readFirmwareVersion', () => transport.value!.readFirmwareVersion(), value => { firmware.value = value })
const readIap = () => transport.value && confirmedRead('readIapMode', () => transport.value!.readIapMode(), value => { iap.value = value })
async function readAll(): Promise<void> {
  if (!transport.value) return
  busy.value = 'read all'
  try {
    deviceType.value = await transport.value.readDeviceType()
    firmware.value = await transport.value.readFirmwareVersion()
    iap.value = await transport.value.readIapMode()
    powerOnTime.value = await transport.value.readPowerOnTime()
    udid.value = await transport.value.readUdid()
    if (capabilities.value?.hasBattery) battery.value = await transport.value.readBattery()
    if (capabilities.value?.generalSettings) hardwareState.value = await transport.value.readHardwareState()
    if (capabilities.value?.bluetooth) bleMac.value = await transport.value.readBleMac()
    if (capabilities.value?.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode()
    if (capabilities.value?.capslockColor) indicatorColor.value = await transport.value.readIndicatorColor()
    if (capabilities.value?.keyboardLayers) {
      const nextLayers: KeyboardLayerResponse[] = []
      for (let layer = 0; layer < 4; layer += 1) nextLayers.push(await transport.value.readKeyboardLayer(layer))
      layers.value = nextLayers
    }
    if (capabilities.value?.macros) macroBackup.value = await transport.value.readMacroBackup()
    message.value = t('notice.loaded')
  } catch (error) {
    message.value = t('notice.failed', { name: t('device.refresh'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}
const readLayer = (layer: number) => transport.value && confirmedRead(
  t(`layer.${layer}`),
  () => transport.value!.readKeyboardLayer(layer),
  value => {
    const next = layers.value.slice()
    next[layer] = value
    layers.value = next
  },
)
const readMacroBackup = () => transport.value && confirmedRead(
  t('macro.title'),
  () => transport.value!.readMacroBackup(),
  value => { macroBackup.value = value },
)
const readHardwareState = () => transport.value && confirmedRead(
  t('settings.title'),
  () => transport.value!.readHardwareState(),
  value => { hardwareState.value = value },
)
const readLedPowerMode = () => transport.value && confirmedRead(
  t('settings.ledPower'),
  () => transport.value!.readLedPowerMode(),
  value => { ledPowerMode.value = value },
)
const readIndicatorColor = () => transport.value && confirmedRead(
  t('settings.capsColor'),
  () => transport.value!.readIndicatorColor(),
  value => { indicatorColor.value = value },
)
async function applyIndicatorColor(hex: string): Promise<void> {
  if (!transport.value || !indicatorColor.value) return
  indicatorColorBackup.value ??= indicatorColor.value.hex
  busy.value = 'write indicator color'
  try { indicatorColor.value = await transport.value.writeIndicatorColor(hex); message.value = t('notice.settingSaved', { name: t('settings.capsColor') }) }
  catch (error) { message.value = t('notice.failed', { name: t('settings.capsColor'), error: error instanceof Error ? error.message : String(error) }) }
  finally { busy.value = null }
}
async function restoreIndicatorColor(): Promise<void> {
  if (!transport.value || !indicatorColorBackup.value) return
  busy.value = 'restore indicator color'
  try { indicatorColor.value = await transport.value.writeIndicatorColor(indicatorColorBackup.value); indicatorColorBackup.value = null; message.value = t('notice.layerRestored', { name: t('settings.capsColor') }) }
  catch (error) { message.value = t('notice.failed', { name: t('settings.restoreColor'), error: error instanceof Error ? error.message : String(error) }) }
  finally { busy.value = null }
}
async function readRuntimeInfo(): Promise<void> {
  if (!transport.value) return
  busy.value = 'runtime info'
  try {
    powerOnTime.value = await transport.value.readPowerOnTime()
    battery.value = await transport.value.readBattery()
    message.value = t('notice.done', { name: t('runtime.title') })
  } catch (error) {
    message.value = t('notice.failed', { name: t('runtime.title'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function readIdentity(): Promise<void> {
  if (!transport.value) return
  busy.value = 'identity info'
  try {
    udid.value = await transport.value.readUdid()
    bleMac.value = await transport.value.readBleMac()
    message.value = t('notice.done', { name: t('identity.title') })
  } catch (error) {
    message.value = t('notice.failed', { name: t('identity.title'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function deleteBleHosts(): Promise<void> {
  if (!transport.value) return
  const confirmation = window.prompt(t('danger.clearBle'))
  if (confirmation !== 'DELETE BLE') return
  busy.value = 'delete BLE hosts'
  try {
    await transport.value.deleteBleHosts()
    message.value = t('notice.done', { name: t('identity.clear') })
  } catch (error) {
    message.value = t('notice.failed', { name: t('identity.clear'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function factoryReset(): Promise<void> {
  if (!transport.value || !hardwareState.value || !capabilities.value?.profileKnown) return
  const confirmation = window.prompt(t('danger.factory'))
  if (confirmation !== 'FACTORY RESET') return
  busy.value = 'factory reset'
  try {
    settingsBackup.value ??= { state: hardwareState.value, ledPowerMode: ledPowerMode.value }
    if (capabilities.value.capslockColor && !indicatorColor.value) indicatorColor.value = await transport.value.readIndicatorColor()
    if (indicatorColor.value) indicatorColorBackup.value ??= indicatorColor.value.hex
    const currentMacros = macroBackup.value ?? await transport.value.readMacroBackup()
    macroBackup.value = currentMacros
    originalMacroBackup.value ??= cloneMacroBackup(currentMacros)
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && !capabilities.value.sleepTimeout) continue
      await transport.value.writeHardwareSetting(key, ANNE_PRO_2_FACTORY_SETTINGS[key])
    }
    if (capabilities.value.ledPowerMode) await transport.value.writeHardwareSetting('ledPowerMode', ANNE_PRO_2_FACTORY_SETTINGS.ledPowerMode)
    if (capabilities.value.capslockColor) indicatorColor.value = await transport.value.writeIndicatorColor('#ff0000')
    macroBackup.value = await transport.value.writeMacros([], [])
    const defaults = annePro2FactoryLights()
    await transport.value.installLights(defaults)
    lightEffects.value = defaults
    await transport.value.deleteBleHosts()
    hardwareState.value = await transport.value.readHardwareState()
    if (capabilities.value.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode()
    message.value = t('notice.done', { name: t('factory.title') })
  } catch (error) {
    message.value = t('notice.failed', { name: t('factory.title'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

const STATE_KEYS: readonly Exclude<HardwareSettingKey, 'ledPowerMode'>[] = [
  'userLayout', 'magicFn', 'macroTrigger', 'capslockLed', 'backlightBrightness',
  'ledHold', 'tapStatus', 'tapActMode', 'tapTimeoutValue', 'sleepTimeoutRaw',
]
function settingName(key: HardwareSettingKey): string {
  const names: Record<HardwareSettingKey, string> = {
    userLayout: t('settings.layout'), magicFn: 'Magic Fn', macroTrigger: t('settings.macroTrigger'),
    capslockLed: t('settings.capsLed'), backlightBrightness: t('settings.backlight'), ledHold: t('settings.autoSleep'),
    tapStatus: 'Tap', tapActMode: t('settings.tapMode'), tapTimeoutValue: t('settings.tapTime'),
    sleepTimeoutRaw: t('settings.sleepTime'), ledPowerMode: t('settings.ledPower'),
  }
  return names[key]
}

async function applySettings(changes: Array<{ key: HardwareSettingKey; value: number }>): Promise<void> {
  if (!transport.value || !hardwareState.value || changes.length === 0) return
  settingsBackup.value ??= { state: hardwareState.value, ledPowerMode: ledPowerMode.value }
  busy.value = 'write settings'
  try {
    for (const { key, value } of changes) await transport.value.writeHardwareSetting(key, value)
    const stateChanges = changes.filter(({ key }) => key !== 'ledPowerMode')
    const powerChange = changes.find(({ key }) => key === 'ledPowerMode')
    if (stateChanges.length) {
      const readback = await transport.value.readHardwareState()
      for (const { key, value } of stateChanges) {
        if (key === 'ledPowerMode') continue
        if (readback[key] !== value) throw new Error(t('validation.readback', { name: settingName(key), actual: readback[key], expected: value }))
      }
      hardwareState.value = readback
    }
    if (powerChange) {
      const readback = await transport.value.readLedPowerMode()
      if (readback.mode !== powerChange.value) throw new Error(t('validation.readback', { name: settingName(powerChange.key), actual: readback.mode, expected: powerChange.value }))
      ledPowerMode.value = readback
    }
    message.value = t('notice.settingsSaved', { count: changes.length })
  } catch (error) {
    message.value = t('notice.failed', { name: t('settings.edit'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function restoreSettings(): Promise<void> {
  if (!transport.value || !settingsBackup.value) return
  busy.value = 'restore settings'
  const backup = settingsBackup.value
  try {
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && (
        !capabilities.value?.sleepTimeout
        || backup.state.sleepTimeoutRaw < 10
        || backup.state.sleepTimeoutRaw > 3600
      )) continue
      await transport.value.writeHardwareSetting(key, backup.state[key])
    }
    if (backup.ledPowerMode && capabilities.value?.ledPowerMode) {
      await transport.value.writeHardwareSetting('ledPowerMode', backup.ledPowerMode.mode)
    }
    const readback = await transport.value.readHardwareState()
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && (
        !capabilities.value?.sleepTimeout
        || backup.state.sleepTimeoutRaw < 10
        || backup.state.sleepTimeoutRaw > 3600
      )) continue
      if (readback[key] !== backup.state[key]) throw new Error(t('validation.readback', { name: settingName(key), actual: readback[key], expected: backup.state[key] }))
    }
    hardwareState.value = readback
    if (backup.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode()
    settingsBackup.value = null
    message.value = t('notice.settingsRestored')
  } catch (error) {
    message.value = t('notice.failed', { name: t('settings.restore'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

function exportMetadata(): void {
  if (!device.value) return
  downloadJson(`annepro-hid-metadata-${Date.now()}.json`, { capturedAt: new Date().toISOString(), vendorId: device.value.vendorId, productId: device.value.productId, productName: device.value.productName, opened: device.value.opened, collections: collections.value })
}
function exportReports(): void {
  downloadJson(`annepro-input-reports-${Date.now()}.json`, records.value.map(record => ({ ...record, bytes: bytesToHex(record.bytes), length: record.bytes.byteLength })))
}
function exportLayers(): void {
  if (!allLayersLoaded.value) return
  downloadJson(`annepro-layout-backup-${Date.now()}.json`, {
    format: 'annepro-web-layout-backup',
    version: 1,
    capturedAt: new Date().toISOString(),
    device: device.value ? { vendorId: device.value.vendorId, productId: device.value.productId, productName: device.value.productName } : null,
    layers: loadedLayers.value.map(layer => ({ index: layer.layer, keycodes: Array.from(layer.data), rawHex: bytesToHex(layer.data) })),
  })
}
function exportMacros(): void {
  if (!macroBackup.value) return
  downloadJson(`annepro-macro-backup-${Date.now()}.json`, {
    format: 'annepro-web-macro-backup',
    version: 1,
    capturedAt: new Date().toISOString(),
    config: { ...macroBackup.value.config, rawFrame: bytesToHex(macroBackup.value.config.rawFrame) },
    map: macroBackup.value.map.map(entry => ({ ...entry, raw: bytesToHex(entry.raw) })),
    macros: macroBackup.value.macros.map(macro => ({ ...macro, events: Array.from(macro.events), separator: Array.from(macro.separator) })),
    activeList: macroBackup.value.activeList,
  })
}

function exportFullBackup(): void {
  if (!fullBackupReady.value || !device.value || !deviceType.value || !firmware.value || !hardwareState.value || !macroBackup.value) return
  downloadJson(`annepro-full-backup-${Date.now()}.json`, {
    format: 'annepro-web-full-backup', version: 1, capturedAt: new Date().toISOString(),
    device: { vendorId: device.value.vendorId, productId: device.value.productId, productName: device.value.productName, model: deviceType.value.model, type: deviceType.value.type },
    firmware: { key: firmware.value.key, led: firmware.value.led, ble: firmware.value.ble },
    runtime: { batteryPercent: battery.value?.percent, batteryVoltage: battery.value?.voltage, powerOnHours: powerOnTime.value?.hours },
    settings: {
      ...hardwareState.value,
      rawFrame: bytesToHex(hardwareState.value.rawFrame),
      sleepTimeoutRaw: capabilities.value?.sleepTimeout && hardwareState.value.sleepTimeoutRaw >= 10 && hardwareState.value.sleepTimeoutRaw <= 3600 ? hardwareState.value.sleepTimeoutRaw : undefined,
      sleepTimeoutRawObserved: hardwareState.value.sleepTimeoutRaw,
      ledPowerMode: ledPowerMode.value?.mode,
      indicatorColor: indicatorColor.value?.hex,
    },
    layers: loadedLayers.value.map(layer => ({ index: layer.layer, keycodes: Array.from(layer.data) })),
    macros: {
      map: macroBackup.value.map.map(entry => ({ ...entry, raw: bytesToHex(entry.raw) })),
      items: macroBackup.value.macros.map(macro => ({ ...macro, events: Array.from(macro.events), separator: Array.from(macro.separator) })),
      activeList: macroBackup.value.activeList,
    },
    lights: lightEffects.value,
    privacy: { udidExcluded: true, bleMacExcluded: true },
  })
}

async function importFullBackup(file: File): Promise<void> {
  if (!transport.value || !device.value || !deviceType.value || !hardwareState.value || !macroBackup.value || !allLayersLoaded.value) return
  let stage = t('backup.parse')
  try {
    const backup = parseFullBackup(JSON.parse(await file.text()) as unknown)
    if (backup.device.model !== deviceType.value.model) throw new Error(t('backup.modelMismatch', { source: backup.device.model, current: deviceType.value.model }))
    const productWarning = backup.device.productId === device.value.productId ? '' : t('danger.pidWarning', { source: `0x${backup.device.productId.toString(16)}`, current: `0x${device.value.productId.toString(16)}` })
    const confirmation = window.prompt(t('danger.fullRestore', { count: backup.lights.length, warning: productWarning }))
    if (confirmation !== 'RESTORE FULL BACKUP') return

    settingsBackup.value ??= { state: hardwareState.value, ledPowerMode: ledPowerMode.value }
    if (indicatorColor.value) indicatorColorBackup.value ??= indicatorColor.value.hex
    originalMacroBackup.value ??= cloneMacroBackup(macroBackup.value)
    const savedLayers = layerBackups.value.slice()
    for (let index = 0; index < 4; index += 1) savedLayers[index] ??= layers.value[index]!.data.slice()
    layerBackups.value = savedLayers
    busy.value = 'restore full backup'

    stage = t('backup.layers')
    for (let index = 0; index < 4; index += 1) {
      const current = layers.value[index]!.data
      if (current.every((value, offset) => value === backup.layers[index][offset])) continue
      const readback = await transport.value.writeKeyboardLayer(index, backup.layers[index])
      const next = layers.value.slice(); next[index] = readback; layers.value = next
    }

    stage = t('backup.macros')
    macroBackup.value = await transport.value.writeMacros(backup.macros, backup.bindings)

    stage = t('backup.lights')
    await transport.value.installLights(backup.lights)
    lightEffects.value = backup.lights

    stage = t('backup.settings')
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && (!capabilities.value?.sleepTimeout || backup.settings.sleepTimeoutRaw === undefined)) continue
      const value = backup.settings[key]
      if (value === undefined) continue
      await transport.value.writeHardwareSetting(key, value)
    }
    if (capabilities.value?.ledPowerMode && backup.settings.ledPowerMode !== undefined) {
      await transport.value.writeHardwareSetting('ledPowerMode', backup.settings.ledPowerMode)
    }
    if (capabilities.value?.capslockColor && backup.settings.indicatorColor) {
      indicatorColor.value = await transport.value.writeIndicatorColor(backup.settings.indicatorColor)
    }

    stage = t('backup.verify')
    const readback = await transport.value.readHardwareState()
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && (!capabilities.value?.sleepTimeout || backup.settings.sleepTimeoutRaw === undefined)) continue
      if (readback[key] !== backup.settings[key]) throw new Error(t('validation.readback', { name: settingName(key), actual: readback[key], expected: backup.settings[key] }))
    }
    hardwareState.value = readback
    if (capabilities.value?.ledPowerMode && backup.settings.ledPowerMode !== undefined) {
      ledPowerMode.value = await transport.value.readLedPowerMode()
      if (ledPowerMode.value.mode !== backup.settings.ledPowerMode) throw new Error(t('validation.readback', { name: t('settings.ledPower'), actual: ledPowerMode.value.mode, expected: backup.settings.ledPowerMode }))
    }
    message.value = t('backup.restored', { file: file.name, macros: backup.macros.length, lights: backup.lights.length })
  } catch (error) {
    message.value = t('backup.failed', { stage, error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

function cloneMacroBackup(backup: MacroBackup): MacroBackup {
  return {
    config: { ...backup.config, rawFrame: backup.config.rawFrame.slice() },
    map: backup.map.map(entry => ({ ...entry, raw: entry.raw.slice() })),
    macros: backup.macros.map(macro => ({ ...macro, events: macro.events.slice(), separator: macro.separator.slice() })),
    activeList: backup.activeList.map(binding => ({ ...binding })),
  }
}

async function applyMacros(macros: StoredMacro[], bindings: ActiveMacroBinding[]): Promise<void> {
  if (!transport.value || !macroBackup.value) return
  originalMacroBackup.value ??= cloneMacroBackup(macroBackup.value)
  busy.value = 'write macros'
  try {
    macroBackup.value = await transport.value.writeMacros(macros, bindings)
    hardwareState.value = await transport.value.readHardwareState()
    message.value = t('notice.macroSaved')
  } catch (error) {
    message.value = t('notice.failed', { name: t('macro.apply'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function restoreMacros(): Promise<void> {
  if (!transport.value || !originalMacroBackup.value) return
  busy.value = 'restore macros'
  try {
    const backup = originalMacroBackup.value
    macroBackup.value = await transport.value.writeMacros(backup.macros, backup.activeList)
    hardwareState.value = await transport.value.readHardwareState()
    originalMacroBackup.value = null
    message.value = t('notice.macroRestored')
  } catch (error) {
    message.value = t('notice.failed', { name: t('macro.restore'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function importMacros(file: File): Promise<void> {
  if (!transport.value) return
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; macros?: Array<Record<string, unknown>>; activeList?: ActiveMacroBinding[] }
    if (parsed.format !== 'annepro-web-macro-backup' || !Array.isArray(parsed.macros) || !Array.isArray(parsed.activeList)) throw new Error(t('validation.format'))
    if (parsed.macros.length > 16 || parsed.activeList.length > 64) throw new Error(t('validation.macroLimit'))
    const macros: StoredMacro[] = parsed.macros.map((item, index) => {
      if (!Array.isArray(item.events) || !item.events.every(value => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255)) throw new Error(t('validation.macroEvents', { index: index + 1 }))
      const name = String(item.name ?? '')
      const icon = Number(item.icon ?? 0)
      if (name.length > 64 || !Number.isInteger(icon) || icon < 0 || icon > 65535) throw new Error(t('validation.macroMetadata', { index: index + 1 }))
      return { id: index, uuid: String(item.uuid ?? '0'), name, icon, events: new Uint8Array(item.events as number[]), separator: new Uint8Array([0, 0, 0]) }
    })
    const bindings = parsed.activeList.map((binding, index) => {
      if (![binding.layer, binding.matrixPosition, binding.macroIndex].every(Number.isInteger)
        || binding.layer < 0 || binding.layer > 3 || binding.matrixPosition < 0 || binding.matrixPosition > 255
        || binding.macroIndex < 0 || binding.macroIndex >= macros.length) throw new Error(t('validation.binding', { index: index + 1 }))
      return { ...binding }
    })
    if (!macroBackup.value) macroBackup.value = await transport.value.readMacroBackup()
    await applyMacros(macros, bindings)
  } catch (error) { message.value = t('notice.failed', { name: t('macro.import'), error: error instanceof Error ? error.message : String(error) }) }
}

async function importLayout(file: File): Promise<void> {
  if (!transport.value || !allLayersLoaded.value) return
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; layers?: Array<{ index?: number; keycodes?: number[] }> }
    if (parsed.format !== 'annepro-web-layout-backup' || !Array.isArray(parsed.layers) || parsed.layers.length !== 4) throw new Error(t('validation.layout'))
    const imported = Array.from({ length: 4 }, (_, index) => {
      const layer = parsed.layers!.find(candidate => candidate.index === index)
      if (!layer || !Array.isArray(layer.keycodes) || layer.keycodes.length !== 61 || !layer.keycodes.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error(t('validation.layer', { name: t(`layer.${index}`) }))
      return new Uint8Array(layer.keycodes)
    })
    busy.value = 'import layout'
    for (let index = 0; index < 4; index += 1) {
      const backups = layerBackups.value.slice()
      backups[index] ??= layers.value[index]!.data.slice()
      layerBackups.value = backups
      const readback = await transport.value.writeKeyboardLayer(index, imported[index])
      const next = layers.value.slice(); next[index] = readback; layers.value = next
    }
    message.value = t('notice.done', { name: t('app.importLayers') })
  } catch (error) { message.value = t('notice.failed', { name: t('app.importLayers'), error: error instanceof Error ? error.message : String(error) }) }
  finally { busy.value = null }
}

function pickLayoutFile(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) void importLayout(file) }

async function applyLayer(layer: number, data: Uint8Array): Promise<void> {
  if (!transport.value || !layers.value[layer]) return
  const original = layers.value[layer]!
  const backups = layerBackups.value.slice()
  backups[layer] ??= original.data.slice()
  layerBackups.value = backups
  busy.value = `write Layer ${layer}`
  try {
    const readback = await transport.value.writeKeyboardLayer(layer, data)
    const next = layers.value.slice()
    next[layer] = readback
    layers.value = next
    message.value = t('notice.layerSaved', { name: t(`layer.${layer}`) })
  } catch (error) {
    message.value = t('notice.failed', { name: t(`layer.${layer}`), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function restoreLayer(layer: number): Promise<void> {
  const backup = layerBackups.value[layer]
  if (!transport.value || !backup) return
  busy.value = `restore Layer ${layer}`
  try {
    const readback = await transport.value.writeKeyboardLayer(layer, backup)
    const next = layers.value.slice()
    next[layer] = readback
    layers.value = next
    const backups = layerBackups.value.slice()
    backups[layer] = null
    layerBackups.value = backups
    message.value = t('notice.layerRestored', { name: t(`layer.${layer}`) })
  } catch (error) {
    message.value = t('notice.failed', { name: t(`layer.${layer}`), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function previewLight(effect: LightEffect): Promise<void> {
  if (!transport.value) return
  busy.value = 'preview light'
  try {
    await transport.value.previewLight(effect)
    message.value = t('notice.previewed', { name: effect.name })
  } catch (error) {
    message.value = t('notice.failed', { name: t('lighting.preview'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function installLights(): Promise<void> {
  if (!transport.value || lightEffects.value.length === 0) return
  if (!window.confirm(t('danger.lights', { count: lightEffects.value.length }))) return
  busy.value = 'install lights'
  try {
    await transport.value.installLights(lightEffects.value)
    message.value = t('notice.lightsInstalled', { count: lightEffects.value.length })
  } catch (error) {
    message.value = t('notice.failed', { name: t('lighting.install', { count: lightEffects.value.length }), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

function exportLights(): void {
  downloadJson(`annepro-light-profile-${Date.now()}.json`, {
    format: 'annepro-web-light-profile', version: 1, effects: lightEffects.value,
  })
}

async function importLights(file: File): Promise<void> {
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; effects?: LightEffect[] }
    if (parsed.format !== 'annepro-web-light-profile' || !Array.isArray(parsed.effects)) throw new Error(t('validation.format'))
    if (parsed.effects.length > 32) throw new Error(t('validation.lightLimit'))
    parsed.effects.forEach(encodeLightRgb)
    lightEffects.value = parsed.effects
    message.value = t('notice.lightsImported', { count: parsed.effects.length })
  } catch (error) {
    message.value = t('notice.failed', { name: t('lighting.import'), error: error instanceof Error ? error.message : String(error) })
  }
}

function selectedAudioColor(): [number, number, number] {
  return [1, 3, 5].map(offset => Number.parseInt(audioColor.value.slice(offset, offset + 2), 16)) as [number, number, number]
}

async function startAudioVisualize(): Promise<void> {
  if (!transport.value || audioRunning.value) return
  busy.value = 'start audio visualize'
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(audioStream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    const frequencies = new Uint8Array(analyser.frequencyBinCount)
    audioFrames.value = 0
    audioRunning.value = true
    audioTimer = window.setInterval(() => {
      if (!audioRunning.value || audioSending || !transport.value) return
      analyser.getByteFrequencyData(frequencies)
      const rgb = audioRgbFromFrequencyData(audioMode.value, frequencies, selectedAudioColor())
      audioSending = true
      transport.value.sendAudioVisualizeFrame(rgb)
        .then(() => { audioFrames.value += 1 })
        .catch((error: unknown) => { message.value = t('notice.failed', { name: t('audio.title'), error: error instanceof Error ? error.message : String(error) }); void stopAudioVisualize(false) })
        .finally(() => { audioSending = false })
    }, 50)
    message.value = t('notice.audioStarted')
  } catch (error) {
    message.value = t('notice.failed', { name: t('audio.start'), error: error instanceof Error ? error.message : String(error) })
    await stopAudioVisualize(false)
  } finally { busy.value = null }
}

async function stopAudioVisualize(restore = true): Promise<void> {
  audioRunning.value = false
  if (audioTimer !== null) window.clearInterval(audioTimer)
  audioTimer = null
  audioStream?.getTracks().forEach(track => track.stop())
  audioStream = null
  if (audioContext) await audioContext.close().catch(() => undefined)
  audioContext = null
  if (restore && transport.value && lightEffects.value[0]) {
    try { await transport.value.previewLight(lightEffects.value[0]); message.value = t('notice.audioStopped') }
    catch (error) { message.value = t('notice.failed', { name: t('audio.stop'), error: error instanceof Error ? error.message : String(error) }) }
  }
}

onBeforeUnmount(() => {
  void stopAudioVisualize(false)
  stopListening?.()
  if (supported) {
    navigator.hid.removeEventListener('disconnect', onHidDisconnect)
    navigator.hid.removeEventListener('connect', onHidConnect)
  }
  void transport.value?.close()
})
</script>

<template>
  <div :key="appLocale" class="app-shell">
    <div class="topbar"><header><p class="eyebrow">WEBHID CONFIGURATOR</p><h1>{{ t('app.title') }}</h1><p class="lede">{{ t('app.subtitle') }}</p></header><LanguageSwitcher /></div>
    <PlatformRequirements v-if="!device" />
    <section class="card status"><div><span class="dot"></span>{{ supported ? t('app.available') : t('app.unsupported') }}</div><div class="actions"><button class="secondary" :disabled="!supported || connecting" @click="reconnectGranted">{{ t('app.reconnect') }}</button><button :disabled="!supported || connecting" @click="connect">{{ t('app.connect') }}</button></div></section>
    <p id="message" role="status" aria-live="polite">{{ message }}</p>
    <nav v-if="device && protocolReady" class="workspace-nav" :aria-label="t('app.title')"><button v-for="item in navigation" :key="item.id" class="nav-button" :class="{ active: activeSection === item.id }" @click="activeSection = item.id">{{ item.label }}</button></nav>
    <template v-if="device && activeSection === 'device'"><DevicePanel :device="device" :device-type="deviceType" :firmware="firmware" :iap="iap" :capabilities="capabilities" :busy="busy" :protocol-ready="protocolReady" :full-backup-ready="fullBackupReady" @read-all="readAll" @export-full-backup="exportFullBackup" @import-full-backup="importFullBackup" @read-device-type="readDeviceType" @read-firmware="readFirmware" @read-iap="readIap" @read-layer="readLayer" /><SettingsPanel v-if="protocolReady && capabilities?.generalSettings" section="device" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><RuntimeInfoPanel v-if="protocolReady && capabilities?.hasBattery" :battery="battery" :power-on-time="powerOnTime" :busy="busy !== null" @read="readRuntimeInfo" /><IdentityPanel v-if="protocolReady && capabilities?.bluetooth" :udid="udid" :ble-mac="bleMac" :busy="busy !== null" @read="readIdentity" @delete-ble-hosts="deleteBleHosts" /><FactoryResetPanel v-if="protocolReady && capabilities?.factoryReset" :busy="busy !== null" :ready="hardwareState !== null" @reset="factoryReset" /></template>
    <template v-if="activeSection === 'keys'"><SettingsPanel v-if="protocolReady && capabilities?.generalSettings" section="keys" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><section v-if="loadedLayers.length" class="card layer-toolbar"><div class="section-heading"><div><h2>{{ t('app.keyboardLayers') }}</h2><div class="layer-tabs"><button v-for="index in 4" :key="index" class="secondary" :class="{ active: activeLayer === index - 1 }" @click="activeLayer = index - 1">{{ t(`layer.${index - 1}`) }}</button></div></div><div class="actions"><label class="file-button">{{ t('app.importLayers') }}<input type="file" accept="application/json" :disabled="!allLayersLoaded || busy !== null" @change="pickLayoutFile"></label><button class="secondary" :disabled="!allLayersLoaded" @click="exportLayers">{{ t('app.exportLayers') }}</button></div></div></section><KeyboardLayout v-if="layers[activeLayer]" :key="activeLayer" :layer="layers[activeLayer]!" :busy="busy !== null" :has-backup="layerBackups[activeLayer] !== null" @apply="applyLayer" @restore="restoreLayer" /></template>
    <template v-if="device && protocolReady && activeSection === 'lighting'"><SettingsPanel v-if="capabilities?.generalSettings" section="lighting" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><LightingPanel v-if="capabilities?.hasLed" :effects="lightEffects" :busy="busy !== null" @update="lightEffects = $event" @preview="previewLight" @install="installLights" @export="exportLights" @import="importLights" /><AudioVisualizePanel v-if="capabilities?.audioVisualization" :running="audioRunning" :mode="audioMode" :color="audioColor" :busy="busy !== null" :frames="audioFrames" @start="startAudioVisualize" @stop="stopAudioVisualize" @update-mode="audioMode = $event" @update-color="audioColor = $event" /></template>
    <template v-if="device && protocolReady && activeSection === 'macros' && capabilities?.macros"><SettingsPanel v-if="capabilities?.generalSettings" section="macros" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><MacroPanel :backup="macroBackup" :busy="busy !== null" :has-backup="originalMacroBackup !== null" @read-backup="readMacroBackup" @export-backup="exportMacros" @import-backup="importMacros" @apply="applyMacros" @restore="restoreMacros" /></template>
    <details v-if="device" class="developer-tools"><summary><strong>{{ t('app.developerTools') }}</strong> · {{ t('app.developerHint') }}</summary><CollectionsView :collections="collections" @export-metadata="exportMetadata" /><ReportsView :records="records" @clear="records = []" @export-reports="exportReports" /></details>
    <footer>{{ t('app.footer') }}</footer>
  </div>
</template>
