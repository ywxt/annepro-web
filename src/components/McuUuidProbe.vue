<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { McuUuidResponse } from '../protocol/mcu-uuid.ts'

defineProps<{ value: McuUuidResponse | null; busy: boolean }>()
defineEmits<{ read: [] }>()
const reveal = ref(false)
const { t } = useI18n({ useScope: 'global' })
const hex = (bytes: Uint8Array): string => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
const masked = (bytes: Uint8Array): string => bytes.byteLength <= 4 ? '••••••••' : `${hex(bytes.slice(0, 2))}${'•'.repeat(Math.min(16, bytes.byteLength * 2 - 8))}${hex(bytes.slice(-2))}`
</script>

<template>
  <section class="card debug-feature mcu-uuid-probe">
    <div class="section-heading"><div><p class="eyebrow">DEBUG · PRIVATE · READ ONLY · 01/04</p><h2>{{ t('mcuUuid.title') }}</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">{{ t('common.read') }}</button></div>
    <p class="empty">{{ t('mcuUuid.help') }}</p>
    <div v-if="value" class="identity-probe"><code>{{ reveal ? hex(value.bytes) : masked(value.bytes) }}</code><button class="secondary compact" @click="reveal = !reveal">{{ reveal ? t('common.hide') : t('common.show') }}</button></div>
    <p v-else class="empty">{{ t('common.notRead') }}</p>
  </section>
</template>
