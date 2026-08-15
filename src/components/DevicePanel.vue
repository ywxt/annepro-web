<script setup lang="ts">
import type { DeviceTypeResponse } from '../protocol/device-info.ts'
import type { FirmwareVersions } from '../protocol/firmware-info.ts'
import type { IapModeResponse } from '../protocol/iap-info.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'

defineProps<{ device: HIDDevice; deviceType: DeviceTypeResponse | null; firmware: FirmwareVersions | null; iap: IapModeResponse | null; busy: string | null; protocolReady: boolean }>()
defineEmits<{ readDeviceType: []; readFirmware: []; readIap: []; readLayer: [layer: number] }>()
</script>

<template>
  <section class="card">
    <div class="section-heading"><h2>裝置</h2><div v-if="protocolReady" class="actions">
      <button class="secondary" :disabled="busy !== null" @click="$emit('readDeviceType')">讀取裝置類型</button>
      <button class="secondary" :disabled="busy !== null" @click="$emit('readFirmware')">讀取韌體版本</button>
      <button class="secondary" :disabled="busy !== null" @click="$emit('readIap')">讀取 IAP 狀態</button>
      <button v-for="layer in 4" :key="layer" class="secondary" :disabled="busy !== null" @click="$emit('readLayer', layer - 1)">讀取 Layer {{ layer - 1 }}</button>
    </div></div>
    <dl><div><dt>Vendor ID</dt><dd>{{ formatHex(device.vendorId) }}</dd></div><div><dt>Product ID</dt><dd>{{ formatHex(device.productId) }}</dd></div><div><dt>Product name</dt><dd>{{ device.productName || '—' }}</dd></div><div><dt>Opened</dt><dd>{{ device.opened ? 'Yes' : 'No' }}</dd></div></dl>
    <p v-if="deviceType" class="decoded">Model {{ deviceType.model }} ({{ deviceType.modelName }}) · Type {{ deviceType.type }} ({{ deviceType.typeName }}) · Frame {{ bytesToHex(deviceType.rawFrame) }} · Ignored {{ deviceType.trailingLength }} trailing bytes</p>
    <p v-if="firmware" class="decoded">Firmware · Key {{ firmware.key }} · LED {{ firmware.led }} · BLE {{ firmware.ble }} · Frame {{ bytesToHex(firmware.rawFrame) }} · Ignored {{ firmware.trailingLength }} trailing bytes</p>
    <p v-if="iap" class="decoded">IAP state code {{ iap.mode }} · Frame {{ bytesToHex(iap.rawFrame) }} · Ignored {{ iap.trailingLength }} trailing bytes</p>
  </section>
</template>
