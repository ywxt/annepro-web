<script setup lang="ts">
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { DeviceTypeResponse } from '../protocol/device-info.ts'
import type { FirmwareVersions } from '../protocol/firmware-info.ts'
import type { IapModeResponse } from '../protocol/iap-info.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'

defineProps<{ device: HIDDevice; deviceType: DeviceTypeResponse | null; firmware: FirmwareVersions | null; iap: IapModeResponse | null; capabilities: DeviceCapabilities | null; busy: string | null; protocolReady: boolean; fullBackupReady: boolean }>()
const emit = defineEmits<{ readAll: []; exportFullBackup: []; importFullBackup: [file: File]; readDeviceType: []; readFirmware: []; readIap: []; readLayer: [layer: number] }>()
function pickFullBackup(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) emit('importFullBackup', file) }
</script>

<template>
  <section class="card">
    <div class="section-heading"><h2>裝置</h2><div v-if="protocolReady" class="actions">
      <button :disabled="busy !== null" @click="$emit('readAll')">讀取全部／建立備份</button>
      <button class="secondary" :disabled="busy !== null || !fullBackupReady" @click="$emit('exportFullBackup')">匯出完整備份</button>
      <label class="file-button">還原完整備份<input type="file" accept="application/json" :disabled="busy !== null || !fullBackupReady" @change="pickFullBackup"></label>
      <button class="secondary" :disabled="busy !== null" @click="$emit('readDeviceType')">讀取裝置類型</button>
      <button class="secondary" :disabled="busy !== null" @click="$emit('readFirmware')">讀取韌體版本</button>
      <button class="secondary" :disabled="busy !== null" @click="$emit('readIap')">讀取 IAP 狀態</button>
      <button v-for="layer in 4" :key="layer" class="secondary" :disabled="busy !== null" @click="$emit('readLayer', layer - 1)">讀取 Layer {{ layer - 1 }}</button>
    </div></div>
    <dl><div><dt>Vendor ID</dt><dd>{{ formatHex(device.vendorId) }}</dd></div><div><dt>Product ID</dt><dd>{{ formatHex(device.productId) }}</dd></div><div><dt>Product name</dt><dd>{{ device.productName || '—' }}</dd></div><div><dt>Opened</dt><dd>{{ device.opened ? 'Yes' : 'No' }}</dd></div></dl>
    <p v-if="deviceType" class="decoded">Model {{ deviceType.model }} ({{ deviceType.modelName }}) · Type {{ deviceType.type }} ({{ deviceType.typeName }}) · Frame {{ bytesToHex(deviceType.rawFrame) }} · Ignored {{ deviceType.trailingLength }} trailing bytes</p>
    <p v-if="firmware" class="decoded">Firmware · Key {{ firmware.key }} · LED {{ firmware.led }} · BLE {{ firmware.ble }} · Frame {{ bytesToHex(firmware.rawFrame) }} · Ignored {{ firmware.trailingLength }} trailing bytes</p>
    <p v-if="iap" class="decoded">IAP state code {{ iap.mode }} · Frame {{ bytesToHex(iap.rawFrame) }} · Ignored {{ iap.trailingLength }} trailing bytes</p>
    <div v-if="capabilities" class="decoded">
      <strong>ObinsKit 能力摘要</strong> ·
      RGB {{ capabilities.hasLed ? '支援' : '不支援' }} ·
      獨立指示燈 {{ capabilities.hasIndicatorLed ? '支援' : '不支援' }} ·
      電池／休眠 {{ capabilities.hasBattery ? '支援' : '不支援' }} ·
      音訊燈效 {{ capabilities.audioVisualization ? '支援' : '不支援' }} ·
      Tap 進階設定 {{ capabilities.modernTapSettings === null ? '等待韌體版本' : capabilities.modernTapSettings ? '支援' : '不支援' }} ·
      LED 功率模式 {{ capabilities.ledPowerMode === null ? '等待韌體版本' : capabilities.ledPowerMode ? '支援' : '不支援' }}
    </div>
  </section>
</template>
