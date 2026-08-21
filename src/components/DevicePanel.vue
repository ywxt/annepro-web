<script setup lang="ts">
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { DeviceTypeResponse } from '../protocol/device-info.ts'
import type { FirmwareVersions } from '../protocol/firmware-info.ts'
import type { IapModeResponse } from '../protocol/iap-info.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
import { getObinsModel } from '../device-registry.ts'
import { computed } from 'vue'

const props = defineProps<{ device: HIDDevice; deviceType: DeviceTypeResponse | null; firmware: FirmwareVersions | null; iap: IapModeResponse | null; capabilities: DeviceCapabilities | null; busy: string | null; protocolReady: boolean; fullBackupReady: boolean }>()
const emit = defineEmits<{ readAll: []; exportFullBackup: []; importFullBackup: [file: File]; readDeviceType: []; readFirmware: []; readIap: []; readLayer: [layer: number] }>()
const { t } = useI18n({ useScope: 'global' })
const modelProfile = computed(() => props.deviceType ? getObinsModel(props.deviceType.model) : null)
function support(value: boolean | null): string { return value === null ? t('device.waiting') : value ? t('device.supported') : t('device.unsupported') }
function pickFullBackup(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) emit('importFullBackup', file) }
</script>

<template>
  <section class="card">
    <div class="section-heading"><h2>{{ t('device.title') }}</h2><div v-if="protocolReady" class="actions"><button :disabled="busy !== null" @click="$emit('readAll')">{{ t('device.refresh') }}</button><button class="secondary" :disabled="busy !== null || !fullBackupReady" @click="$emit('exportFullBackup')">{{ t('device.export') }}</button><label class="file-button">{{ t('device.restore') }}<input type="file" accept="application/json" :disabled="busy !== null || !fullBackupReady" @change="pickFullBackup"></label></div></div>
    <p v-if="busy === 'read all'" class="empty">{{ t('device.loading') }}</p>
    <div v-if="modelProfile" class="profile-line"><span :class="['profile-badge', modelProfile.profile]">{{ modelProfile.profile === 'anne-pro-2' ? t('device.fullSupport') : t('device.readOnlySupport') }}</span><strong>{{ modelProfile.family }}</strong><span v-for="trait in modelProfile.traits" :key="trait">{{ trait }}</span></div>
    <dl><div><dt>{{ t('device.model') }}</dt><dd>{{ deviceType?.modelName || device.productName || t('device.unavailable') }}</dd></div><div><dt>{{ t('device.firmware') }}</dt><dd>{{ firmware ? `Key ${firmware.key} · LED ${firmware.led} · BLE ${firmware.ble}` : t('device.unavailable') }}</dd></div><div><dt>{{ t('device.connection') }}</dt><dd>{{ device.opened ? t('device.connected') : t('device.unavailable') }}</dd></div><div><dt>USB</dt><dd>{{ formatHex(device.vendorId) }}:{{ formatHex(device.productId) }}</dd></div></dl>
    <details class="raw-details"><summary>{{ t('device.protocolTools') }}</summary><div class="actions protocol-actions"><button class="secondary" :disabled="busy !== null" @click="$emit('readDeviceType')">{{ t('device.readType') }}</button><button class="secondary" :disabled="busy !== null" @click="$emit('readFirmware')">{{ t('device.readFirmware') }}</button><button class="secondary" :disabled="busy !== null" @click="$emit('readIap')">{{ t('device.readIap') }}</button><button v-for="layer in (capabilities?.keyboardLayers ? 4 : 0)" :key="layer" class="secondary" :disabled="busy !== null" @click="$emit('readLayer', layer - 1)">{{ t('device.readLayer', { name: t(`layer.${layer - 1}`) }) }}</button></div>
      <p v-if="deviceType" class="decoded">Model {{ deviceType.model }} ({{ deviceType.modelName }}) · Type {{ deviceType.type }} ({{ deviceType.typeName }}) · Frame {{ bytesToHex(deviceType.rawFrame) }} · Ignored {{ deviceType.trailingLength }} trailing bytes</p><p v-if="firmware" class="decoded">Firmware · Key {{ firmware.key }} · LED {{ firmware.led }} · BLE {{ firmware.ble }} · Frame {{ bytesToHex(firmware.rawFrame) }} · Ignored {{ firmware.trailingLength }} trailing bytes</p><p v-if="iap" class="decoded">IAP state code {{ iap.mode }} · Frame {{ bytesToHex(iap.rawFrame) }} · Ignored {{ iap.trailingLength }} trailing bytes</p></details>
    <div v-if="capabilities" class="capability-summary">
      <strong>{{ t('device.capabilities') }}</strong> ·
      {{ t('device.rgb') }} {{ support(capabilities.hasLed) }} ·
      {{ t('device.indicator') }} {{ support(capabilities.hasIndicatorLed) }} ·
      {{ t('device.battery') }} {{ support(capabilities.hasBattery) }} ·
      {{ t('device.audio') }} {{ support(capabilities.audioVisualization) }} ·
      {{ t('device.tap') }} {{ support(capabilities.modernTapSettings) }} ·
      {{ t('device.ledPower') }} {{ support(capabilities.ledPowerMode) }}
    </div>
  </section>
</template>
