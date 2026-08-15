<script setup lang="ts">
import { ref } from 'vue'
import type { BleMacAddress, DeviceUdid } from '../protocol/device-identity.ts'
import { useI18n } from 'vue-i18n'

defineProps<{ udid: DeviceUdid | null; bleMac: BleMacAddress | null; busy: boolean }>()
defineEmits<{ read: []; deleteBleHosts: [] }>()
const revealUdid = ref(false)
const { t } = useI18n()
const compactHex = (bytes: Uint8Array): string => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">IDENTITY &amp; BLUETOOTH</p><h2>{{ t('identity.title') }}</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">{{ t('common.read') }}</button></div>
    <p class="empty">{{ t('identity.help') }}</p>
    <div class="info-grid">
      <div><span>UDID</span><strong class="identity-value">{{ udid ? (revealUdid ? compactHex(udid.bytes) : `${compactHex(udid.bytes.slice(0, 2))}••••••••••••${compactHex(udid.bytes.slice(-2))}`) : t('common.notRead') }}</strong><button v-if="udid" class="secondary" @click="revealUdid = !revealUdid">{{ revealUdid ? t('common.hide') : t('common.show') }}</button></div>
      <div><span>BLE MAC</span><strong class="identity-value">{{ bleMac?.formatted ?? t('common.notRead') }}</strong></div>
    </div>
    <button class="danger" :disabled="busy" @click="$emit('deleteBleHosts')">{{ t('identity.clear') }}</button>
  </section>
</template>
