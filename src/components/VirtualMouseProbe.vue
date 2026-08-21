<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VirtualMouseConfigResponse } from '../protocol/virtual-mouse.ts'
import { bytesToHex } from '../protocol/packet.ts'

defineProps<{ value: VirtualMouseConfigResponse | null; busy: boolean }>()
defineEmits<{ read: [] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="card debug-feature virtual-mouse-probe">
    <div class="section-heading"><div><p class="eyebrow">DEBUG · READ ONLY · 60/05</p><h2>{{ t('virtualMouse.title') }}</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">{{ t('common.read') }}</button></div>
    <p class="empty">{{ t('virtualMouse.help') }}</p>
    <div v-if="value" class="raw-probe-result"><span>{{ t('virtualMouse.bytes', { count: value.rawConfig.byteLength }) }}</span><code>{{ bytesToHex(value.rawConfig) }}</code><details><summary>{{ t('virtualMouse.frame') }}</summary><code>{{ bytesToHex(value.rawFrame) }}</code></details></div>
    <p v-else class="empty">{{ t('common.notRead') }}</p>
  </section>
</template>
