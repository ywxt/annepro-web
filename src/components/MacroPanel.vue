<script setup lang="ts">
import type { MacroConfigResponse } from '../protocol/macro-info.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'

defineProps<{ config: MacroConfigResponse | null; busy: boolean }>()
defineEmits<{ readConfig: [] }>()
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">READ-ONLY</p><h2>巨集</h2></div><button class="secondary" :disabled="busy" @click="$emit('readConfig')">讀取巨集狀態</button></div>
    <p v-if="!config" class="empty">尚未讀取鍵盤內的巨集狀態。</p>
    <template v-else>
      <p class="decoded">{{ config.hasMacros ? `偵測到 ${config.storedMacroCount} 個巨集記錄` : '鍵盤目前沒有已儲存的巨集' }}</p>
      <p>Count <code>{{ config.storedMacroCount }}</code> · Unknown byte <code>{{ formatHex(config.unknownByte, 2) }}</code></p>
      <code class="layout-raw">{{ bytesToHex(config.rawFrame) }}</code>
    </template>
  </section>
</template>
