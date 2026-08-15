<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
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

const supported = isWebHidSupported()
const connecting = ref(false)
const message = ref(supported ? '' : '此瀏覽器不支援 WebHID')
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
const settingsBackup = ref<{ state: HardwareState; ledPowerMode: LedPowerModeResponse | null } | null>(null)
const layers = shallowRef<Array<KeyboardLayerResponse | null>>([null, null, null, null])
const layerBackups = shallowRef<Array<Uint8Array | null>>([null, null, null, null])
const LIGHT_STORAGE_KEY = 'annepro-web-light-effects-v1'
const lightEffects = ref<LightEffect[]>(loadLightEffects())
const collections = computed(() => device.value ? collectMetadata(device.value.collections) : [])
const loadedLayers = computed(() => layers.value.filter((layer): layer is KeyboardLayerResponse => layer !== null))
const allLayersLoaded = computed(() => loadedLayers.value.length === 4)
const fullBackupReady = computed(() => Boolean(
  deviceType.value && firmware.value && hardwareState.value && macroBackup.value && allLayersLoaded.value,
))
const capabilities = computed(() => deriveDeviceCapabilities(deviceType.value, firmware.value))
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
  message.value = '等待選擇裝置…'
  try {
    await useSelection(await requestAnneProDevice())
  } catch (error) {
    message.value = `連接失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { connecting.value = false }
}

async function useSelection(selection: DeviceSelection): Promise<void> {
  if (!selection.device) { message.value = '沒有可用的 Anne Pro 2 協議介面。'; return }
  const previous = transport.value
  const nextTransport = new AnneProHidTransport(selection.device)
  await nextTransport.open()
  stopListening?.()
  if (previous && previous.device !== selection.device) await previous.close().catch(() => undefined)
  device.value = selection.device
  transport.value = nextTransport
  protocolReady.value = selection.hasProtocolCollection
  stopListening = nextTransport.listen((record) => records.value.unshift(record))
  message.value = selection.hasProtocolCollection
    ? `已從 ${selection.candidates.length} 個候選介面中連接協議 collection。`
    : `找到 ${selection.candidates.length} 個候選，但未選到 64-byte 協議介面。`
}

async function reconnectGranted(): Promise<void> {
  connecting.value = true
  message.value = '正在尋找已授權的 Anne Pro 2…'
  try { await useSelection(await getPreferredGrantedAnneProDevice()) }
  catch (error) { message.value = `快速重連失敗：${error instanceof Error ? error.message : String(error)}` }
  finally { connecting.value = false }
}

function onHidDisconnect(event: HIDConnectionEvent): void {
  if (event.device !== device.value) return
  void stopAudioVisualize(false)
  stopListening?.()
  stopListening = null
  transport.value = null
  protocolReady.value = false
  message.value = 'Anne Pro 2 已斷線。重新插入後可使用「快速重連」。'
}

function onHidConnect(event: HIDConnectionEvent): void {
  if (event.device.vendorId === 0x04d9) message.value = '偵測到 HID 裝置重新接入；可使用「快速重連」。'
}

onMounted(() => {
  if (!supported) return
  navigator.hid.addEventListener('disconnect', onHidDisconnect)
  navigator.hid.addEventListener('connect', onHidConnect)
})

async function confirmedRead<T>(name: string, prompt: string, read: () => Promise<T>, assign: (value: T) => void): Promise<void> {
  if (!window.confirm(prompt)) return
  busy.value = name
  message.value = `等待 ${name} 回應…`
  try { assign(await read()); message.value = `${name} 完成。` }
  catch (error) { message.value = `${name} 失敗：${error instanceof Error ? error.message : String(error)}` }
  finally { busy.value = null }
}

const readDeviceType = () => transport.value && confirmedRead('readDeviceType', '傳送一次已確認的唯讀封包：\n7b 12 31 00 02 00 00 7d 01 01', () => transport.value!.readDeviceType(), value => { deviceType.value = value })
const readFirmware = () => transport.value && confirmedRead('readFirmwareVersion', '傳送一次已確認的唯讀封包：\n7b 12 31 00 02 00 00 7d 01 03', () => transport.value!.readFirmwareVersion(), value => { firmware.value = value })
const readIap = () => transport.value && confirmedRead('readIapMode（不切換模式）', '只讀取 IAP 狀態，不切換模式：\n7b 12 31 00 02 00 00 7d 02 02', () => transport.value!.readIapMode(), value => { iap.value = value })
async function readAll(): Promise<void> {
  if (!transport.value || !window.confirm('將依序執行所有 Anne Pro 2 已確認唯讀命令，包含身份、版本、運行資訊、設定、四層鍵位與完整巨集備份。全程單飛且不修改鍵盤。')) return
  busy.value = 'read all'
  try {
    deviceType.value = await transport.value.readDeviceType()
    firmware.value = await transport.value.readFirmwareVersion()
    iap.value = await transport.value.readIapMode()
    powerOnTime.value = await transport.value.readPowerOnTime()
    battery.value = await transport.value.readBattery()
    hardwareState.value = await transport.value.readHardwareState()
    udid.value = await transport.value.readUdid()
    bleMac.value = await transport.value.readBleMac()
    if (capabilities.value?.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode()
    if (capabilities.value?.capslockColor) indicatorColor.value = await transport.value.readIndicatorColor()
    const nextLayers: KeyboardLayerResponse[] = []
    for (let layer = 0; layer < 4; layer += 1) nextLayers.push(await transport.value.readKeyboardLayer(layer))
    layers.value = nextLayers
    macroBackup.value = await transport.value.readMacroBackup()
    message.value = '所有可讀資訊與配置已完成讀取；鍵位與巨集現在可匯出備份。'
  } catch (error) {
    message.value = `完整讀取在 ${busy.value} 階段失敗：${error instanceof Error ? error.message : String(error)}；先前已完成的資料仍保留。`
  } finally { busy.value = null }
}
const readLayer = (layer: number) => transport.value && confirmedRead(
  `Layer ${layer}`,
  `傳送一次已確認的唯讀 Layer ${layer} 查詢：\n7b 12 31 00 03 00 00 7d 10 02 0${layer}`,
  () => transport.value!.readKeyboardLayer(layer),
  value => {
    const next = layers.value.slice()
    next[layer] = value
    layers.value = next
  },
)
const readMacroBackup = () => transport.value && confirmedRead(
  'macro backup',
  '讀取鍵盤巨集備份。首先傳送固定的 config 查詢；若有巨集，再依 map 宣告的有限數量讀取內容與 active list。所有命令均為 ObinsKit 的唯讀 30/06–09，不會寫入巨集。',
  () => transport.value!.readMacroBackup(),
  value => { macroBackup.value = value },
)
const readHardwareState = () => transport.value && confirmedRead(
  'readHardwareState',
  '傳送一次 ObinsKit 的唯讀硬體狀態查詢：\n7b 12 31 00 02 00 00 7d 01 09',
  () => transport.value!.readHardwareState(),
  value => { hardwareState.value = value },
)
const readLedPowerMode = () => transport.value && confirmedRead(
  'readLedPowerMode',
  '傳送一次已確認的唯讀 LED 功率模式查詢：\n7b 12 31 00 02 00 00 7d 20 1e',
  () => transport.value!.readLedPowerMode(),
  value => { ledPowerMode.value = value },
)
const readIndicatorColor = () => transport.value && confirmedRead(
  'readLedIndicatorColor',
  '傳送一次已確認的唯讀 CapsLock 指示顏色查詢：\n7b 12 31 00 02 00 00 7d 20 1a',
  () => transport.value!.readIndicatorColor(),
  value => { indicatorColor.value = value },
)
async function applyIndicatorColor(hex: string): Promise<void> {
  if (!transport.value || !indicatorColor.value || !window.confirm(`修改 CapsLock 指示顏色：${indicatorColor.value.hex} → ${hex}\n\n寫入後會立即回讀驗證。`)) return
  indicatorColorBackup.value ??= indicatorColor.value.hex
  busy.value = 'write indicator color'
  try { indicatorColor.value = await transport.value.writeIndicatorColor(hex); message.value = 'CapsLock 指示顏色已寫入並回讀驗證。' }
  catch (error) { message.value = `指示顏色寫入失敗：${error instanceof Error ? error.message : String(error)}` }
  finally { busy.value = null }
}
async function restoreIndicatorColor(): Promise<void> {
  if (!transport.value || !indicatorColorBackup.value || !window.confirm(`復原 CapsLock 指示顏色為 ${indicatorColorBackup.value}？`)) return
  busy.value = 'restore indicator color'
  try { indicatorColor.value = await transport.value.writeIndicatorColor(indicatorColorBackup.value); indicatorColorBackup.value = null; message.value = 'CapsLock 指示顏色已復原並驗證。' }
  catch (error) { message.value = `指示顏色復原失敗：${error instanceof Error ? error.message : String(error)}` }
  finally { busy.value = null }
}
async function readRuntimeInfo(): Promise<void> {
  if (!transport.value || !window.confirm('依序傳送兩個已確認的唯讀資訊查詢：\n01/02 readPowerOnTime\n01/05 readBattery')) return
  busy.value = 'runtime info'
  try {
    powerOnTime.value = await transport.value.readPowerOnTime()
    battery.value = await transport.value.readBattery()
    message.value = '電池與運行時間讀取完成。'
  } catch (error) {
    message.value = `執行期資訊讀取失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function readIdentity(): Promise<void> {
  if (!transport.value || !window.confirm('依序讀取裝置 UDID 與 BLE MAC。UDID 僅在目前頁面記憶體中保存，不會自動匯出。')) return
  busy.value = 'identity info'
  try {
    udid.value = await transport.value.readUdid()
    bleMac.value = await transport.value.readBleMac()
    message.value = '裝置識別與 BLE MAC 讀取完成。'
  } catch (error) {
    message.value = `識別資訊讀取失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function deleteBleHosts(): Promise<void> {
  if (!transport.value) return
  const confirmation = window.prompt('此操作會刪除鍵盤記住的所有藍牙主機，且無法由本工具復原。\n\n請輸入 DELETE BLE 繼續：')
  if (confirmation !== 'DELETE BLE') return
  busy.value = 'delete BLE hosts'
  try {
    await transport.value.deleteBleHosts()
    message.value = '鍵盤已確認清除所有藍牙配對；請在作業系統中重新配對。'
  } catch (error) {
    message.value = `清除藍牙配對失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function factoryReset(): Promise<void> {
  if (!transport.value || !hardwareState.value || !capabilities.value?.profileKnown) return
  const confirmation = window.prompt('這會覆寫一般設定與燈效、清空所有巨集及 BLE 配對。燈效與 BLE 配對無法自動復原。\n\n請輸入 FACTORY RESET 繼續：')
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
    message.value = '已恢復 ObinsKit Anne Pro 2 原廠設定並回讀一般設定；BLE 配對已清除。'
  } catch (error) {
    message.value = `原廠重設中斷：${error instanceof Error ? error.message : String(error)}。已完成的步驟不會自動回滾，請使用各區塊的復原按鈕。`
  } finally { busy.value = null }
}

const STATE_KEYS: readonly Exclude<HardwareSettingKey, 'ledPowerMode'>[] = [
  'userLayout', 'magicFn', 'macroTrigger', 'capslockLed', 'backlightBrightness',
  'ledHold', 'tapStatus', 'tapActMode', 'tapTimeoutValue', 'sleepTimeoutRaw',
]

async function applySetting(key: HardwareSettingKey, value: number): Promise<void> {
  if (!transport.value || !hardwareState.value) return
  const current = key === 'ledPowerMode' ? ledPowerMode.value?.mode : hardwareState.value[key]
  if (!window.confirm(`修改 ${key}：${current ?? '未知'} → ${value}\n\n寫入後會立即回讀驗證。`)) return
  settingsBackup.value ??= { state: hardwareState.value, ledPowerMode: ledPowerMode.value }
  busy.value = `write ${key}`
  try {
    await transport.value.writeHardwareSetting(key, value)
    if (key === 'ledPowerMode') {
      const readback = await transport.value.readLedPowerMode()
      if (readback.mode !== value) throw new Error(`回讀值 ${readback.mode} 不符合 ${value}`)
      ledPowerMode.value = readback
    } else {
      const readback = await transport.value.readHardwareState()
      if (readback[key] !== value) throw new Error(`回讀值 ${readback[key]} 不符合 ${value}`)
      hardwareState.value = readback
    }
    message.value = `${key} 已寫入並回讀驗證。`
  } catch (error) {
    message.value = `${key} 寫入失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function restoreSettings(): Promise<void> {
  if (!transport.value || !settingsBackup.value) return
  if (!window.confirm('將逐項寫回首次修改前的一般設定快照，然後完整回讀驗證。確定復原？')) return
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
      if (readback[key] !== backup.state[key]) throw new Error(`${key} 回讀不一致`)
    }
    hardwareState.value = readback
    if (backup.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode()
    settingsBackup.value = null
    message.value = '一般設定已復原並完成回讀驗證。'
  } catch (error) {
    message.value = `設定復原失敗：${error instanceof Error ? error.message : String(error)}`
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
    settings: { ...hardwareState.value, rawFrame: bytesToHex(hardwareState.value.rawFrame), ledPowerMode: ledPowerMode.value?.mode, indicatorColor: indicatorColor.value?.hex },
    layers: loadedLayers.value.map(layer => ({ index: layer.layer, keycodes: Array.from(layer.data) })),
    macros: {
      map: macroBackup.value.map.map(entry => ({ ...entry, raw: bytesToHex(entry.raw) })),
      items: macroBackup.value.macros.map(macro => ({ ...macro, events: Array.from(macro.events), separator: Array.from(macro.separator) })),
      activeList: macroBackup.value.activeList,
    },
    privacy: { udidExcluded: true, bleMacExcluded: true },
  })
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
  if (!window.confirm(`將覆寫鍵盤巨集映像：${macros.length} 個巨集、${bindings.length} 個鍵位綁定。\n\n會先保留目前完整備份，完成後重新讀取並逐項驗證。`)) return
  originalMacroBackup.value ??= cloneMacroBackup(macroBackup.value)
  busy.value = 'write macros'
  try {
    macroBackup.value = await transport.value.writeMacros(macros, bindings)
    hardwareState.value = await transport.value.readHardwareState()
    message.value = '巨集映像已寫入並完成逐項回讀驗證。'
  } catch (error) {
    message.value = `巨集寫入失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function restoreMacros(): Promise<void> {
  if (!transport.value || !originalMacroBackup.value || !window.confirm('寫回首次修改前的完整巨集映像，並重新讀取驗證？')) return
  busy.value = 'restore macros'
  try {
    const backup = originalMacroBackup.value
    macroBackup.value = await transport.value.writeMacros(backup.macros, backup.activeList)
    hardwareState.value = await transport.value.readHardwareState()
    originalMacroBackup.value = null
    message.value = '巨集已復原並完成回讀驗證。'
  } catch (error) {
    message.value = `巨集復原失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function importMacros(file: File): Promise<void> {
  if (!transport.value) return
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; macros?: Array<Record<string, unknown>>; activeList?: ActiveMacroBinding[] }
    if (parsed.format !== 'annepro-web-macro-backup' || !Array.isArray(parsed.macros) || !Array.isArray(parsed.activeList)) throw new Error('檔案格式不符')
    if (parsed.macros.length > 16 || parsed.activeList.length > 64) throw new Error('巨集或綁定數量超出裝置限制')
    const macros: StoredMacro[] = parsed.macros.map((item, index) => {
      if (!Array.isArray(item.events) || !item.events.every(value => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255)) throw new Error(`Macro ${index} events 無效`)
      const name = String(item.name ?? '')
      const icon = Number(item.icon ?? 0)
      if (name.length > 64 || !Number.isInteger(icon) || icon < 0 || icon > 65535) throw new Error(`Macro ${index} metadata 無效`)
      return { id: index, uuid: String(item.uuid ?? '0'), name, icon, events: new Uint8Array(item.events as number[]), separator: new Uint8Array([0, 0, 0]) }
    })
    const bindings = parsed.activeList.map((binding, index) => {
      if (![binding.layer, binding.matrixPosition, binding.macroIndex].every(Number.isInteger)
        || binding.layer < 0 || binding.layer > 3 || binding.matrixPosition < 0 || binding.matrixPosition > 255
        || binding.macroIndex < 0 || binding.macroIndex >= macros.length) throw new Error(`Binding ${index} 無效`)
      return { ...binding }
    })
    if (!window.confirm(`從 ${file.name} 寫入 ${macros.length} 個巨集與 ${bindings.length} 個綁定？目前裝置巨集會先備份。`)) return
    if (!macroBackup.value) macroBackup.value = await transport.value.readMacroBackup()
    await applyMacros(macros, bindings)
  } catch (error) { message.value = `巨集匯入失敗：${error instanceof Error ? error.message : String(error)}` }
}

async function importLayout(file: File): Promise<void> {
  if (!transport.value || !allLayersLoaded.value) return
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; layers?: Array<{ index?: number; keycodes?: number[] }> }
    if (parsed.format !== 'annepro-web-layout-backup' || !Array.isArray(parsed.layers) || parsed.layers.length !== 4) throw new Error('必須是含四層的 annepro-web layout backup')
    const imported = Array.from({ length: 4 }, (_, index) => {
      const layer = parsed.layers!.find(candidate => candidate.index === index)
      if (!layer || !Array.isArray(layer.keycodes) || layer.keycodes.length !== 61 || !layer.keycodes.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error(`Layer ${index} 無效`)
      return new Uint8Array(layer.keycodes)
    })
    if (!window.confirm(`從 ${file.name} 覆寫全部四層鍵位？每層會保留目前備份並逐 byte 回讀驗證。`)) return
    busy.value = 'import layout'
    for (let index = 0; index < 4; index += 1) {
      const backups = layerBackups.value.slice()
      backups[index] ??= layers.value[index]!.data.slice()
      layerBackups.value = backups
      const readback = await transport.value.writeKeyboardLayer(index, imported[index])
      const next = layers.value.slice(); next[index] = readback; layers.value = next
    }
    message.value = '四層鍵位備份已匯入並逐 byte 回讀驗證。'
  } catch (error) { message.value = `鍵位匯入失敗：${error instanceof Error ? error.message : String(error)}` }
  finally { busy.value = null }
}

function pickLayoutFile(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) void importLayout(file) }

async function applyLayer(layer: number, data: Uint8Array): Promise<void> {
  if (!transport.value || !layers.value[layer]) return
  const original = layers.value[layer]!
  const differences = data.reduce((count, value, index) => count + (value === original.data[index] ? 0 : 1), 0)
  if (!window.confirm(`將修改 Layer ${layer} 的 ${differences} 個鍵位。\n\n寫入前會保留原層，完成後逐 byte 回讀驗證。`)) return
  const backups = layerBackups.value.slice()
  backups[layer] ??= original.data.slice()
  layerBackups.value = backups
  busy.value = `write Layer ${layer}`
  try {
    const readback = await transport.value.writeKeyboardLayer(layer, data)
    const next = layers.value.slice()
    next[layer] = readback
    layers.value = next
    message.value = `Layer ${layer} 已寫入並逐 byte 驗證。`
  } catch (error) {
    message.value = `Layer ${layer} 寫入失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function restoreLayer(layer: number): Promise<void> {
  const backup = layerBackups.value[layer]
  if (!transport.value || !backup || !window.confirm(`寫回 Layer ${layer} 的原始備份？`)) return
  busy.value = `restore Layer ${layer}`
  try {
    const readback = await transport.value.writeKeyboardLayer(layer, backup)
    const next = layers.value.slice()
    next[layer] = readback
    layers.value = next
    const backups = layerBackups.value.slice()
    backups[layer] = null
    layerBackups.value = backups
    message.value = `Layer ${layer} 已復原並驗證。`
  } catch (error) {
    message.value = `Layer ${layer} 復原失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function previewLight(effect: LightEffect): Promise<void> {
  if (!transport.value) return
  busy.value = 'preview light'
  try {
    await transport.value.previewLight(effect)
    message.value = `已預覽燈效 ${effect.name}；此操作不改寫燈效清單。`
  } catch (error) {
    message.value = `燈效預覽失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { busy.value = null }
}

async function installLights(): Promise<void> {
  if (!transport.value || lightEffects.value.length === 0) return
  if (!window.confirm(`將以本機設定檔覆寫鍵盤的 ${lightEffects.value.length} 個燈效。\n\n鍵盤不支援讀回既有燈效，因此無法自動備份目前清單。確定繼續？`)) return
  busy.value = 'install lights'
  try {
    await transport.value.installLights(lightEffects.value)
    message.value = `已安裝 ${lightEffects.value.length} 個燈效。`
  } catch (error) {
    message.value = `燈效安裝失敗：${error instanceof Error ? error.message : String(error)}`
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
    if (parsed.format !== 'annepro-web-light-profile' || !Array.isArray(parsed.effects)) throw new Error('檔案格式不符')
    if (parsed.effects.length > 32) throw new Error('燈效不可超過 32 個')
    parsed.effects.forEach(encodeLightRgb)
    lightEffects.value = parsed.effects
    message.value = `已匯入 ${parsed.effects.length} 個本機燈效；尚未寫入鍵盤。`
  } catch (error) {
    message.value = `燈效匯入失敗：${error instanceof Error ? error.message : String(error)}`
  }
}

function selectedAudioColor(): [number, number, number] {
  return [1, 3, 5].map(offset => Number.parseInt(audioColor.value.slice(offset, offset + 2), 16)) as [number, number, number]
}

async function startAudioVisualize(): Promise<void> {
  if (!transport.value || audioRunning.value) return
  if (!window.confirm('開始後會取得麥克風音訊並以最多 20 FPS 向鍵盤傳送暫態燈效。音訊不會儲存或上傳。')) return
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
        .catch((error: unknown) => { message.value = `Audio Visualize 傳送失敗：${error instanceof Error ? error.message : String(error)}`; void stopAudioVisualize(false) })
        .finally(() => { audioSending = false })
    }, 50)
    message.value = 'Audio Visualize 已開始（最多 20 FPS）。'
  } catch (error) {
    message.value = `無法開始 Audio Visualize：${error instanceof Error ? error.message : String(error)}`
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
    try { await transport.value.previewLight(lightEffects.value[0]); message.value = 'Audio Visualize 已停止，並恢復第一個本機燈效。' }
    catch (error) { message.value = `Audio Visualize 已停止，但恢復燈效失敗：${error instanceof Error ? error.message : String(error)}` }
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
  <header><p class="eyebrow">WEBHID CONFIGURATOR</p><h1>Anne Pro Web Configurator</h1><p class="lede">讀取、備份與設定 Anne Pro 2。一般寫入都有範圍檢查、明確確認及裝置回讀驗證；韌體與 IAP 寫入永遠停用。</p></header>
  <section class="card status"><div><span class="dot"></span>{{ supported ? 'WebHID 可用' : '此瀏覽器不支援 WebHID' }}</div><div class="actions"><button class="secondary" :disabled="!supported || connecting" @click="reconnectGranted">快速重連</button><button :disabled="!supported || connecting" @click="connect">選擇 Anne Pro 2</button></div></section>
  <p id="message" role="status" aria-live="polite">{{ message }}</p>
  <DevicePanel v-if="device" :device="device" :device-type="deviceType" :firmware="firmware" :iap="iap" :capabilities="capabilities" :busy="busy" :protocol-ready="protocolReady" :full-backup-ready="fullBackupReady" @read-all="readAll" @export-full-backup="exportFullBackup" @read-device-type="readDeviceType" @read-firmware="readFirmware" @read-iap="readIap" @read-layer="readLayer" />
  <section v-if="loadedLayers.length" class="section-heading"><h2>鍵位層</h2><div class="actions"><label class="file-button">匯入四層備份<input type="file" accept="application/json" :disabled="!allLayersLoaded || busy !== null" @change="pickLayoutFile"></label><button class="secondary" :disabled="!allLayersLoaded" @click="exportLayers">匯出完整備份</button></div></section>
  <KeyboardLayout v-for="layer in loadedLayers" :key="layer.layer" :layer="layer" :busy="busy !== null" :has-backup="layerBackups[layer.layer] !== null" @apply="applyLayer" @restore="restoreLayer" />
  <LightingPanel v-if="device && protocolReady && capabilities?.hasLed" :effects="lightEffects" :busy="busy !== null" @update="lightEffects = $event" @preview="previewLight" @install="installLights" @export="exportLights" @import="importLights" />
  <AudioVisualizePanel v-if="device && protocolReady && capabilities?.hasLed" :running="audioRunning" :mode="audioMode" :color="audioColor" :busy="busy !== null" :frames="audioFrames" @start="startAudioVisualize" @stop="stopAudioVisualize" @update-mode="audioMode = $event" @update-color="audioColor = $event" />
  <RuntimeInfoPanel v-if="device && protocolReady" :battery="battery" :power-on-time="powerOnTime" :busy="busy !== null" @read="readRuntimeInfo" />
  <IdentityPanel v-if="device && protocolReady" :udid="udid" :ble-mac="bleMac" :busy="busy !== null" @read="readIdentity" @delete-ble-hosts="deleteBleHosts" />
  <FactoryResetPanel v-if="device && protocolReady" :busy="busy !== null" :ready="hardwareState !== null && capabilities?.profileKnown === true" @reset="factoryReset" />
  <MacroPanel v-if="device && protocolReady" :backup="macroBackup" :busy="busy !== null" :has-backup="originalMacroBackup !== null" @read-backup="readMacroBackup" @export-backup="exportMacros" @import-backup="importMacros" @apply="applyMacros" @restore="restoreMacros" />
  <SettingsPanel v-if="device && protocolReady" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-setting="applySetting" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" />
  <CollectionsView v-if="device" :collections="collections" @export-metadata="exportMetadata" />
  <ReportsView v-if="device" :records="records" @clear="records = []" @export-reports="exportReports" />
  <footer>安全模式：不提供任意封包；一般設定寫入需確認及回讀驗證；IAP、韌體與 flash erase 永遠停用</footer>
</template>
