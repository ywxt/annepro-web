<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { IndicatorLocationResponse } from '../protocol/indicator-location.ts'
import { indicatorFunctionsForModel } from '../protocol/indicator-location.ts'
import { bytesToHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
import type { IndicatorColorResponse } from '../protocol/indicator-color.ts'

const props = defineProps<{ modelId: number; value: IndicatorLocationResponse | null; colors: IndicatorColorResponse | null; brightness: number | null; busy: boolean; hasBackup: boolean; hasBrightnessBackup: boolean; hasColorBackup: boolean }>()
const emit = defineEmits<{ read: []; apply: [locations: number[]]; restore: []; applyBrightness: [value: number]; restoreBrightness: []; applyColors: [colors: [string, string]]; restoreColors: [] }>()
const { t } = useI18n({ useScope: 'global' })
const draft = ref<number[]>([])
const functions = computed(() => indicatorFunctionsForModel(props.modelId))
const validDraft = computed(() => draft.value.every(value => functions.value.includes(value)))
watch(() => props.value, value => { draft.value = value ? Array.from(value.locations) : [] }, { immediate: true })
function apply(): void {
  if (validDraft.value) emit('apply', [...draft.value])
}
function functionName(value: number): string { return t(`indicator.function.${value}`) }
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">MODEL-SPECIFIC · VERIFIED</p><h2>{{ t('settings.capsLed') }}</h2></div><button class="secondary" :disabled="busy" @click="$emit('read')">{{ t('common.read') }}</button></div>
    <p v-if="!value" class="empty">{{ t('common.notRead') }}</p>
    <div v-else class="setting-cluster"><div class="cluster-controls"><label v-for="(current, index) in draft" :key="index">{{ t('indicator.led', { index: index + 1 }) }}<select v-model.number="draft[index]" :disabled="busy"><option v-if="!functions.includes(current)" :value="current" disabled>{{ t('settings.unsupportedValue', { value: current }) }}</option><option v-for="item in functions" :key="item" :value="item">{{ functionName(item) }}</option></select></label></div><div class="actions"><button v-if="hasBackup" class="secondary" :disabled="busy" @click="$emit('restore')">{{ t('settings.restore') }}</button><button :disabled="busy || !validDraft" @click="apply">{{ t('settings.apply') }}</button></div></div>
    <div v-if="brightness !== null" class="indicator-brightness"><label><span>{{ t('settings.indicatorBrightness') }}</span><input :value="brightness" type="range" min="1" max="10" :disabled="busy" @change="$emit('applyBrightness', Number(($event.target as HTMLInputElement).value))"><strong>{{ brightness * 10 }}%</strong></label><button v-if="hasBrightnessBackup" class="secondary compact" :disabled="busy" @click="$emit('restoreBrightness')">{{ t('settings.restore') }}</button></div>
    <div v-if="modelId === 12 && colors?.colors.length === 2" class="indicator-brightness"><label v-for="(color, index) in colors.colors" :key="index"><span>{{ t(index === 0 ? 'indicator.leftColor' : 'indicator.rightColor') }}</span><input type="color" :value="color" :disabled="busy" @change="$emit('applyColors', colors.colors.map((item, colorIndex) => colorIndex === index ? ($event.target as HTMLInputElement).value : item) as [string, string])"></label><button v-if="hasColorBackup" class="secondary compact" :disabled="busy" @click="$emit('restoreColors')">{{ t('settings.restore') }}</button></div>
    <details v-if="value" class="raw-details"><summary>{{ t('settings.raw') }}</summary><code class="layout-raw">{{ bytesToHex(value.rawFrame) }}</code></details>
  </section>
</template>
