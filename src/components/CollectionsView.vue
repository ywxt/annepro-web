<script setup lang="ts">
import type { CollectionMetadata } from '../hid/types.ts'
import { formatHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
defineProps<{ collections: CollectionMetadata[] }>()
defineEmits<{ exportMetadata: [] }>()
const { t } = useI18n()
</script>

<template>
  <section><div class="section-heading"><h2>{{ t('developer.collections') }}</h2><div><span>{{ t('developer.collectionCount', { total: collections.length, candidates: collections.filter(item => item.protocolCandidate).length }) }}</span><button class="secondary" @click="$emit('exportMetadata')">{{ t('developer.exportMetadata') }}</button></div></div>
    <div class="collection-grid"><article v-for="(collection, index) in collections" :key="index" class="collection" :class="{ vendor: collection.protocolCandidate }" :style="{ marginLeft: `${Math.min(collection.depth, 4) * 12}px` }"><div class="collection-title"><h3>Collection {{ index + 1 }}</h3><span v-if="collection.protocolCandidate" class="badge">{{ collection.vendorDefined ? 'Vendor-defined' : 'Protocol candidate' }}</span></div><p>Usage page <code>{{ formatHex(collection.usagePage) }}</code> · Usage <code>{{ formatHex(collection.usage) }}</code></p><table v-if="collection.reports.length"><thead><tr><th>Type</th><th>Report ID</th><th>Size</th></tr></thead><tbody><tr v-for="report in collection.reports" :key="`${report.kind}-${report.reportId}`"><td>{{ report.kind }}</td><td>{{ report.reportId }}</td><td>{{ report.reportSizeBits }} bits / {{ report.reportSizeBytes }} bytes</td></tr></tbody></table><p v-else class="empty">No reports exposed</p></article></div>
  </section>
</template>
