<script setup lang="ts">
import { ref, watch } from 'vue'
import type { IndicatorLocationResponse } from '../protocol/indicator-location.ts'
import { bytesToHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ value: IndicatorLocationResponse | null; brightness: number | null; busy: boolean; hasBackup: boolean; hasBrightnessBackup: boolean }>()
const emit = defineEmits<{ read: []; apply: [locations: number[]]; restore: []; applyBrightness: [value: number]; restoreBrightness: [] }>()
const { t } = useI18n({ useScope: 'global' })
const draft = ref<number[]>([])
watch(() => props.value, value => { draft.value = value ? Array.from(value.locations) : [] }, { immediate: true })
function apply(): void {
  if (draft.value.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) emit('apply', [...draft.value])
}
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">MODEL-SPECIFIC · VERIFIED</p><h2>{{ t('settings.capsLed') }}</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">{{ t('common.read') }}</button></div>
    <p v-if="!value" class="empty">{{ t('common.notRead') }}</p>
    <div v-else class="setting-cluster"><div class="cluster-controls"><label v-for="(_, index) in draft" :key="index">LED {{ index + 1 }}<input v-model.number="draft[index]" type="number" min="0" max="255"></label></div><div class="actions"><button v-if="hasBackup" class="secondary" :disabled="busy" @click="$emit('restore')">{{ t('settings.restore') }}</button><button :disabled="busy" @click="apply">{{ t('settings.apply') }}</button></div></div>
    <div v-if="brightness !== null" class="indicator-brightness"><label><span>{{ t('settings.indicatorBrightness') }}</span><input :value="brightness" type="range" min="1" max="10" :disabled="busy" @change="$emit('applyBrightness', Number(($event.target as HTMLInputElement).value))"><strong>{{ brightness * 10 }}%</strong></label><button v-if="hasBrightnessBackup" class="secondary compact" :disabled="busy" @click="$emit('restoreBrightness')">{{ t('settings.restore') }}</button></div>
    <details v-if="value" class="raw-details"><summary>{{ t('settings.raw') }}</summary><code class="layout-raw">{{ bytesToHex(value.rawFrame) }}</code></details>
  </section>
</template>
