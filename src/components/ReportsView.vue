<script setup lang="ts">
import type { InputReportRecord } from '../hid/types.ts'
import { tryParseLianaFrame } from '../protocol/liana.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'
defineProps<{ records: InputReportRecord[] }>()
defineEmits<{ clear: []; exportReports: [] }>()
function parsed(bytes: Uint8Array): string | null {
  const frame = tryParseLianaFrame(bytes)
  return frame ? `Liana ${formatHex(frame.protocol, 2)} · route ${frame.route} · sequence ${frame.sequence} · command ${formatHex(frame.command, 2)}/${formatHex(frame.action, 2)} · payload ${frame.payload.byteLength} bytes` : null
}
</script>

<template>
  <section class="card"><div class="section-heading"><h2>Input reports</h2><div><button class="secondary" @click="$emit('exportReports')">匯出 JSON</button><button class="secondary" @click="$emit('clear')">清除</button></div></div><div class="reports"><p v-if="records.length === 0" class="empty">等待輸入報告…</p><div v-for="(record, index) in records" v-else :key="`${record.timestamp}-${index}`" class="report"><time>{{ record.timestamp }}</time><span>ID {{ record.reportId }}</span><span>{{ record.bytes.byteLength }} bytes</span><code>{{ bytesToHex(record.bytes) || '(empty)' }}</code><small v-if="parsed(record.bytes)" class="decoded">{{ parsed(record.bytes) }}</small></div></div></section>
</template>
