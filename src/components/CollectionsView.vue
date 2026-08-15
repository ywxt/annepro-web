<script setup lang="ts">
import type { CollectionMetadata } from '../hid/types.ts'
import { formatHex } from '../protocol/packet.ts'
defineProps<{ collections: CollectionMetadata[] }>()
defineEmits<{ exportMetadata: [] }>()
</script>

<template>
  <section><div class="section-heading"><h2>Collections</h2><div><span>{{ collections.length }} total · {{ collections.filter(item => item.protocolCandidate).length }} protocol candidate</span><button class="secondary" @click="$emit('exportMetadata')">匯出 metadata</button></div></div>
    <div class="collection-grid"><article v-for="(collection, index) in collections" :key="index" class="collection" :class="{ vendor: collection.protocolCandidate }" :style="{ marginLeft: `${Math.min(collection.depth, 4) * 12}px` }"><div class="collection-title"><h3>Collection {{ index + 1 }}</h3><span v-if="collection.protocolCandidate" class="badge">{{ collection.vendorDefined ? 'Vendor-defined' : 'Protocol candidate' }}</span></div><p>Usage page <code>{{ formatHex(collection.usagePage) }}</code> · Usage <code>{{ formatHex(collection.usage) }}</code></p><table v-if="collection.reports.length"><thead><tr><th>Type</th><th>Report ID</th><th>Size</th></tr></thead><tbody><tr v-for="report in collection.reports" :key="`${report.kind}-${report.reportId}`"><td>{{ report.kind }}</td><td>{{ report.reportId }}</td><td>{{ report.reportSizeBits }} bits / {{ report.reportSizeBytes }} bytes</td></tr></tbody></table><p v-else class="empty">No reports exposed</p></article></div>
  </section>
</template>
