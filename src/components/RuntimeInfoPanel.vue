<script setup lang="ts">
import type { BatteryResponse, PowerOnTimeResponse } from '../protocol/runtime-info.ts'
import { bytesToHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
defineProps<{ battery: BatteryResponse | null; powerOnTime: PowerOnTimeResponse | null; busy: boolean }>()
defineEmits<{ read: [] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="card"><div class="section-heading"><div><p class="eyebrow">DEVICE RUNTIME</p><h2>{{ t('runtime.title') }}</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">{{ t('common.read') }}</button></div>
    <p v-if="!battery || !powerOnTime" class="empty">{{ t('common.notRead') }}</p>
    <div v-else class="info-grid"><div><span>{{ t('runtime.estimate') }}</span><strong>{{ battery.percent }}%</strong></div><div v-if="battery.voltage !== null"><span>{{ t('runtime.voltage') }}</span><strong>{{ battery.voltage.toFixed(3) }} V</strong></div><div v-if="battery.adc !== null"><span>ADC</span><strong>{{ battery.adc }}</strong></div><div><span>{{ t('runtime.uptime') }}</span><strong>{{ t('runtime.hours', { count: powerOnTime.hours.toLocaleString() }) }}</strong></div></div>
    <details v-if="battery && powerOnTime" class="raw-details"><summary>{{ t('runtime.raw') }}</summary><code class="layout-raw">Battery {{ bytesToHex(battery.rawFrame) }}<br>Power {{ bytesToHex(powerOnTime.rawFrame) }}</code></details>
  </section>
</template>
