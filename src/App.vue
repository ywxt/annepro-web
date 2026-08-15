<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import CollectionsView from './components/CollectionsView.vue'
import DevicePanel from './components/DevicePanel.vue'
import KeyboardLayout from './components/KeyboardLayout.vue'
import LightingPanel from './components/LightingPanel.vue'
import MacroPanel from './components/MacroPanel.vue'
import ReportsView from './components/ReportsView.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { collectMetadata } from './hid/device.ts'
import { isWebHidSupported, requestAnneProDevice } from './hid/discovery.ts'
import { ReadonlyHidTransport } from './hid/transport.ts'
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

const supported = isWebHidSupported()
const connecting = ref(false)
const message = ref(supported ? '' : '此瀏覽器不支援 WebHID')
const device = shallowRef<HIDDevice | null>(null)
const transport = shallowRef<ReadonlyHidTransport | null>(null)
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
const settingsBackup = ref<{ state: HardwareState; ledPowerMode: LedPowerModeResponse | null } | null>(null)
const layers = shallowRef<Array<KeyboardLayerResponse | null>>([null, null, null, null])
const layerBackups = shallowRef<Array<Uint8Array | null>>([null, null, null, null])
const LIGHT_STORAGE_KEY = 'annepro-web-light-effects-v1'
const lightEffects = ref<LightEffect[]>(loadLightEffects())
const collections = computed(() => device.value ? collectMetadata(device.value.collections) : [])
const loadedLayers = computed(() => layers.value.filter((layer): layer is KeyboardLayerResponse => layer !== null))
const allLayersLoaded = computed(() => loadedLayers.value.length === 4)
const capabilities = computed(() => deriveDeviceCapabilities(deviceType.value, firmware.value))
let stopListening: (() => void) | null = null

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
    const selection = await requestAnneProDevice()
    if (!selection.device) { message.value = '未選擇裝置。'; return }
    const nextTransport = new ReadonlyHidTransport(selection.device)
    await nextTransport.open()
    stopListening?.()
    device.value = selection.device
    transport.value = nextTransport
    protocolReady.value = selection.hasProtocolCollection
    stopListening = nextTransport.listen((record) => records.value.unshift(record))
    message.value = selection.hasProtocolCollection
      ? `已從 ${selection.candidates.length} 個候選介面中連接協議 collection。`
      : `找到 ${selection.candidates.length} 個候選，但未選到 64-byte 協議介面。`
  } catch (error) {
    message.value = `連接失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { connecting.value = false }
}

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
</script>

<template>
  <header><p class="eyebrow">WEBHID CONFIGURATOR</p><h1>Anne Pro Web Configurator</h1><p class="lede">讀取、備份與設定 Anne Pro 2。一般寫入都有範圍檢查、明確確認及裝置回讀驗證；韌體與 IAP 寫入永遠停用。</p></header>
  <section class="card status"><div><span class="dot"></span>{{ supported ? 'WebHID 可用' : '此瀏覽器不支援 WebHID' }}</div><button :disabled="!supported || connecting" @click="connect">連接 Anne Pro 2</button></section>
  <p id="message" role="status" aria-live="polite">{{ message }}</p>
  <DevicePanel v-if="device" :device="device" :device-type="deviceType" :firmware="firmware" :iap="iap" :capabilities="capabilities" :busy="busy" :protocol-ready="protocolReady" @read-device-type="readDeviceType" @read-firmware="readFirmware" @read-iap="readIap" @read-layer="readLayer" />
  <section v-if="loadedLayers.length" class="section-heading"><h2>鍵位層</h2><button class="secondary" :disabled="!allLayersLoaded" @click="exportLayers">匯出完整備份</button></section>
  <KeyboardLayout v-for="layer in loadedLayers" :key="layer.layer" :layer="layer" :busy="busy !== null" :has-backup="layerBackups[layer.layer] !== null" @apply="applyLayer" @restore="restoreLayer" />
  <LightingPanel v-if="device && protocolReady && capabilities?.hasLed" :effects="lightEffects" :busy="busy !== null" @update="lightEffects = $event" @preview="previewLight" @install="installLights" @export="exportLights" @import="importLights" />
  <MacroPanel v-if="device && protocolReady" :backup="macroBackup" :busy="busy !== null" :has-backup="originalMacroBackup !== null" @read-backup="readMacroBackup" @export-backup="exportMacros" @apply="applyMacros" @restore="restoreMacros" />
  <SettingsPanel v-if="device && protocolReady" :state="hardwareState" :led-power-mode="ledPowerMode" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @apply-setting="applySetting" @restore-settings="restoreSettings" />
  <CollectionsView v-if="device" :collections="collections" @export-metadata="exportMetadata" />
  <ReportsView v-if="device" :records="records" @clear="records = []" @export-reports="exportReports" />
  <footer>安全模式：不提供任意封包；一般設定寫入需確認及回讀驗證；IAP、韌體與 flash erase 永遠停用</footer>
</template>
