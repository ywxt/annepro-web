<script setup lang="ts">
import type { AudioVisualizeMode } from '../protocol/audio-visualize.ts'
import { useI18n } from 'vue-i18n'
defineProps<{ running: boolean; mode: AudioVisualizeMode; color: string; busy: boolean; frames: number }>()
defineEmits<{ start: []; stop: []; updateMode: [mode: AudioVisualizeMode]; updateColor: [color: string] }>()
const { t } = useI18n()
</script>

<template>
  <section class="card"><div class="section-heading"><div><p class="eyebrow">TRANSIENT · 20 FPS MAX</p><h2>{{ t('audio.title') }}</h2></div><div class="actions"><button v-if="!running" :disabled="busy" @click="$emit('start')">{{ t('audio.start') }}</button><button v-else class="danger" @click="$emit('stop')">{{ t('audio.stop') }}</button></div></div>
    <p class="empty">{{ t('audio.help') }}</p>
    <div class="audio-controls"><label>{{ t('common.mode') }} <select :value="mode" :disabled="running" @change="$emit('updateMode', ($event.target as HTMLSelectElement).value as AudioVisualizeMode)"><option value="pure">Pure</option><option value="colorful">Colorful spectrum</option></select></label><label v-if="mode === 'pure'">{{ t('common.color') }} <input type="color" :value="color" :disabled="running" @input="$emit('updateColor', ($event.target as HTMLInputElement).value)"></label><span>{{ running ? t('audio.running', { count: frames }) : t('audio.stopped') }}</span></div>
  </section>
</template>
