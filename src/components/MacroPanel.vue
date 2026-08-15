<script setup lang="ts">
import type { MacroBackup } from '../protocol/macro-info.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'

defineProps<{ backup: MacroBackup | null; busy: boolean }>()
defineEmits<{ readBackup: []; exportBackup: [] }>()
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">READ-ONLY</p><h2>巨集</h2></div><div><button v-if="backup" class="secondary" @click="$emit('exportBackup')">匯出備份</button><button class="secondary" :disabled="busy" @click="$emit('readBackup')">讀取巨集備份</button></div></div>
    <p v-if="!backup" class="empty">尚未讀取鍵盤內的巨集資料。</p>
    <template v-else>
      <p class="decoded">{{ backup.config.hasMacros ? `讀取 ${backup.macros.length} 個巨集與 ${backup.activeList.length} 個綁定` : '鍵盤目前沒有已儲存的巨集' }}</p>
      <p>Config count <code>{{ backup.config.storedMacroCount }}</code> · Unknown byte <code>{{ formatHex(backup.config.unknownByte, 2) }}</code></p>
      <article v-for="macro in backup.macros" :key="macro.id" class="macro-item"><strong>{{ macro.name || `Macro ${macro.id}` }}</strong><span>UUID {{ macro.uuid }} · icon {{ macro.icon }} · {{ macro.events.byteLength / 3 }} events</span><code>{{ bytesToHex(macro.events) }}</code></article>
      <code class="layout-raw">{{ bytesToHex(backup.config.rawFrame) }}</code>
    </template>
  </section>
</template>
