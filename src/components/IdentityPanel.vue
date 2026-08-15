<script setup lang="ts">
import { ref } from 'vue'
import type { BleMacAddress, DeviceUdid } from '../protocol/device-identity.ts'

defineProps<{ udid: DeviceUdid | null; bleMac: BleMacAddress | null; busy: boolean }>()
defineEmits<{ read: []; deleteBleHosts: [] }>()
const revealUdid = ref(false)
const compactHex = (bytes: Uint8Array): string => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">IDENTITY &amp; BLUETOOTH</p><h2>裝置識別與藍牙</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">讀取資訊</button></div>
    <p class="empty">UDID 是裝置唯一識別碼，預設遮蔽且不會加入 metadata 匯出。清除配對會移除鍵盤記住的所有 BLE 主機。</p>
    <div class="info-grid">
      <div><span>UDID</span><strong class="identity-value">{{ udid ? (revealUdid ? compactHex(udid.bytes) : `${compactHex(udid.bytes.slice(0, 2))}••••••••••••${compactHex(udid.bytes.slice(-2))}`) : '尚未讀取' }}</strong><button v-if="udid" class="secondary" @click="revealUdid = !revealUdid">{{ revealUdid ? '遮蔽' : '顯示' }}</button></div>
      <div><span>BLE MAC</span><strong class="identity-value">{{ bleMac?.formatted ?? '尚未讀取' }}</strong></div>
    </div>
    <button class="danger" :disabled="busy" @click="$emit('deleteBleHosts')">清除所有藍牙配對</button>
  </section>
</template>
