<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import CollectionsView from './components/CollectionsView.vue'
import DevicePanel from './components/DevicePanel.vue'
import KeyboardLayout from './components/KeyboardLayout.vue'
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
import type { MacroBackup } from './protocol/macro-info.ts'
import type { LedPowerModeResponse } from './protocol/led-power.ts'
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
const ledPowerMode = ref<LedPowerModeResponse | null>(null)
const layers = shallowRef<Array<KeyboardLayerResponse | null>>([null, null, null, null])
const collections = computed(() => device.value ? collectMetadata(device.value.collections) : [])
const loadedLayers = computed(() => layers.value.filter((layer): layer is KeyboardLayerResponse => layer !== null))
const allLayersLoaded = computed(() => loadedLayers.value.length === 4)
const capabilities = computed(() => deriveDeviceCapabilities(deviceType.value, firmware.value))
let stopListening: (() => void) | null = null

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
</script>

<template>
  <header><p class="eyebrow">READ-ONLY WEBHID EXPLORER</p><h1>Anne Pro Web Configurator</h1><p class="lede">檢視 Anne Pro 2 的 HID collections、裝置資訊與唯讀鍵位層。所有查詢都固定、可核對並需要逐次確認。</p></header>
  <section class="card status"><div><span class="dot"></span>{{ supported ? 'WebHID 可用' : '此瀏覽器不支援 WebHID' }}</div><button :disabled="!supported || connecting" @click="connect">連接 Anne Pro 2</button></section>
  <p id="message" role="status" aria-live="polite">{{ message }}</p>
  <DevicePanel v-if="device" :device="device" :device-type="deviceType" :firmware="firmware" :iap="iap" :capabilities="capabilities" :busy="busy" :protocol-ready="protocolReady" @read-device-type="readDeviceType" @read-firmware="readFirmware" @read-iap="readIap" @read-layer="readLayer" />
  <section v-if="loadedLayers.length" class="section-heading"><h2>鍵位層</h2><button class="secondary" :disabled="!allLayersLoaded" @click="exportLayers">匯出完整備份</button></section>
  <KeyboardLayout v-for="layer in loadedLayers" :key="layer.layer" :layer="layer" />
  <MacroPanel v-if="device && protocolReady" :backup="macroBackup" :busy="busy !== null" @read-backup="readMacroBackup" @export-backup="exportMacros" />
  <SettingsPanel v-if="device && protocolReady" :state="hardwareState" :led-power-mode="ledPowerMode" :capabilities="capabilities" :busy="busy !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" />
  <CollectionsView v-if="device" :collections="collections" @export-metadata="exportMetadata" />
  <ReportsView v-if="device" :records="records" @clear="records = []" @export-reports="exportReports" />
  <footer>安全模式：只允許已捕獲驗證的固定唯讀查詢；不提供任意封包或設定寫入</footer>
</template>
