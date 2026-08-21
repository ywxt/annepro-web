<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { OLED_HEIGHT, OLED_WIDTH, packOledRgba } from '../protocol/oled.ts'

defineProps<{ busy: boolean }>()
const emit = defineEmits<{ syncDate: []; writeImage: [packed: Uint8Array]; writeText: [packed: Uint8Array]; scroll: [enabled: boolean] }>()
const { t } = useI18n({ useScope: 'global' })
const canvas = ref<HTMLCanvasElement | null>(null)
const text = ref('TENET 70')
const scroll = ref(false)

function context(): CanvasRenderingContext2D {
  const value = canvas.value?.getContext('2d', { willReadFrequently: true })
  if (!value) throw new Error('OLED canvas is unavailable')
  return value
}
function packedCanvas(): Uint8Array { return packOledRgba(context().getImageData(0, 0, OLED_WIDTH, OLED_HEIGHT).data) }
function drawText(): void {
  const ctx = context(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text.value.slice(0, 40), OLED_WIDTH / 2, OLED_HEIGHT / 2, OLED_WIDTH - 12)
}
function writeText(): void { drawText(); emit('writeText', packedCanvas()) }
async function pickImage(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return
  const bitmap = await createImageBitmap(file); const ctx = context()
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, OLED_WIDTH, OLED_HEIGHT)
  const scale = Math.max(OLED_WIDTH / bitmap.width, OLED_HEIGHT / bitmap.height)
  const width = bitmap.width * scale; const height = bitmap.height * scale
  ctx.drawImage(bitmap, (OLED_WIDTH - width) / 2, (OLED_HEIGHT - height) / 2, width, height); bitmap.close()
}
function toggleScroll(event: Event): void { scroll.value = (event.target as HTMLInputElement).checked; emit('scroll', scroll.value) }
</script>

<template>
  <section class="card oled-panel">
    <div class="section-heading"><div><p class="eyebrow">TENET 70 · 256×32 OLED</p><h2>{{ t('oled.title') }}</h2></div><button class="secondary" :disabled="busy" @click="$emit('syncDate')">{{ t('oled.syncDate') }}</button></div>
    <p class="empty">{{ t('oled.help') }}</p>
    <canvas ref="canvas" :width="OLED_WIDTH" :height="OLED_HEIGHT" class="oled-preview" />
    <div class="oled-controls">
      <label>{{ t('oled.image') }} <input type="file" accept="image/*" :disabled="busy" @change="pickImage"></label><button :disabled="busy" @click="$emit('writeImage', packedCanvas())">{{ t('oled.writeImage') }}</button>
      <label>{{ t('oled.text') }} <input v-model="text" maxlength="40" :disabled="busy" @input="drawText"></label><button :disabled="busy || !text" @click="writeText">{{ t('oled.writeText') }}</button>
      <label><input type="checkbox" :checked="scroll" :disabled="busy" @change="toggleScroll"> {{ t('oled.scroll') }}</label>
    </div>
  </section>
</template>
