<script setup lang="ts">
import type { BatteryResponse, PowerOnTimeResponse } from '../protocol/runtime-info.ts'
import { bytesToHex } from '../protocol/packet.ts'
defineProps<{ battery: BatteryResponse | null; powerOnTime: PowerOnTimeResponse | null; busy: boolean }>()
defineEmits<{ read: [] }>()
</script>

<template>
  <section class="card"><div class="section-heading"><div><p class="eyebrow">DEVICE RUNTIME</p><h2>電池與運行時間</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">讀取資訊</button></div>
    <p v-if="!battery || !powerOnTime" class="empty">尚未讀取 01/02 與 01/05。</p>
    <div v-else class="info-grid"><div><span>電量估算</span><strong>{{ battery.percent }}%</strong></div><div><span>電池電壓</span><strong>{{ battery.voltage.toFixed(3) }} V</strong></div><div><span>ADC raw</span><strong>{{ battery.adc }}</strong></div><div><span>累計運行</span><strong>{{ powerOnTime.hours.toLocaleString() }} 小時</strong></div></div>
    <code v-if="battery && powerOnTime" class="layout-raw">Battery {{ bytesToHex(battery.rawFrame) }}<br>Power {{ bytesToHex(powerOnTime.rawFrame) }}</code>
  </section>
</template>
