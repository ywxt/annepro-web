<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AdvancedAudioMode } from '../protocol/advanced-audio.ts'

defineProps<{ busy: boolean }>()
defineEmits<{ configure: [mode: AdvancedAudioMode] }>()
const { t } = useI18n({ useScope: 'global' })
const mode = ref(AdvancedAudioMode.Pure)
const modes = [
  AdvancedAudioMode.Pure,
  AdvancedAudioMode.Colorful,
  AdvancedAudioMode.Scroll,
  AdvancedAudioMode.Energy,
  AdvancedAudioMode.Spectrum,
  AdvancedAudioMode.Original,
  AdvancedAudioMode.Fft,
  AdvancedAudioMode.Wallpaper,
  AdvancedAudioMode.ScrollRms1024,
  AdvancedAudioMode.ScrollRmsEnvelope,
] as const
</script>

<template>
  <section class="card debug-feature">
    <div class="section-heading">
      <div><p class="eyebrow">DEBUG · MCU LED · 21/01</p><h2>{{ t('advancedAudio.title') }}</h2></div>
      <button :disabled="busy" @click="$emit('configure', mode)">{{ t('advancedAudio.apply') }}</button>
    </div>
    <p class="empty">{{ t('advancedAudio.help') }}</p>
    <label class="advanced-audio-mode">{{ t('common.mode') }}
      <select v-model.number="mode" :disabled="busy">
        <option v-for="value in modes" :key="value" :value="value">{{ t(`advancedAudio.mode.${value}`) }}</option>
      </select>
    </label>
  </section>
</template>
