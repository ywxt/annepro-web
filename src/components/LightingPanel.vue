<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFAULT_LIGHT_PALETTE, MAX_LIGHT_PALETTE_COLORS, type LightEffect, type LightingProfile } from '../protocol/lighting.ts'
import { KEY_WIDTHS } from '../protocol/layout.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ effects: LightEffect[]; busy: boolean; profile: LightingProfile }>()
const emit = defineEmits<{ update: [effects: LightEffect[]]; preview: [effect: LightEffect]; install: []; export: []; import: [file: File] }>()
const typeNames: Record<number, string> = {
  1: 'Static', 2: 'Per-key static', 3: 'Breath', 4: 'Gradient breath',
  5: 'Poptang', 6: 'Rainbow', 7: 'Single breath', 10: 'Trigger breath',
  11: 'Trigger rainbow', 12: 'Ripple', 13: 'Starry sky', 14: 'Comet', 15: 'Pulse', 16: 'Colorful',
  17: 'Wave', 18: 'Black hole', 19: 'Vertical rainbow', 21: 'Fountain',
  22: 'Snake', 23: 'Flame', 24: 'Firework', 25: 'Star fall',
}
const count = computed(() => props.effects.length)
const expanded = ref<number | null>(null)
const selected = ref(0)
const selectedEffect = computed(() => props.effects[selected.value] ?? null)
const { t } = useI18n({ useScope: 'global' })
const rowLengths = computed(() => props.profile.rowLengths)
const rowOffsets = computed(() => props.profile.rowLengths.map((_, index) => props.profile.rowLengths.slice(0, index).reduce((sum, length) => sum + length, 0)))

function replace(index: number, patch: Partial<LightEffect>): void {
  selected.value = index
  const next = props.effects.map((effect, current) => current === index ? { ...effect, ...patch } : effect)
  emit('update', next)
}
function changeType(index: number, type: number): void {
  const effect = props.effects[index]
  replace(index, type === 1
    ? { type, staticColors: effect.staticColors.map(() => effect.staticColors[0] ?? '#ff0000') }
    : { type })
}
function changePrimary(index: number, color: string): void {
  const effect = props.effects[index]
  if (effect.type <= 2) replace(index, { staticColors: effect.staticColors.map(() => color) })
  else replace(index, { dynamicColors: [color, ...effect.dynamicColors.slice(1)] })
}
function changeColor(effectIndex: number, colorIndex: number, color: string): void {
  const field = props.effects[effectIndex].type <= 2 ? 'staticColors' : 'dynamicColors'
  const colors = props.effects[effectIndex][field].slice()
  colors[colorIndex] = color
  replace(effectIndex, { [field]: colors })
}
function addPaletteColor(index: number): void { const effect = props.effects[index]; if (effect.dynamicColors.length < MAX_LIGHT_PALETTE_COLORS) replace(index, { dynamicColors: [...effect.dynamicColors, effect.dynamicColors.at(-1) ?? '#ff0000'] }) }
function removePaletteColor(index: number): void { const effect = props.effects[index]; if (effect.dynamicColors.length > 1) replace(index, { dynamicColors: effect.dynamicColors.slice(0, -1) }) }
function add(): void {
  if (props.effects.length >= props.profile.maxEffects) return
  emit('update', [...props.effects, { name: t('lighting.effectName', { count: props.effects.length + 1 }), type: 1, staticColors: Array(props.profile.keycapCount).fill('#ff0000'), dynamicColors: [...DEFAULT_LIGHT_PALETTE] }])
}
function remove(index: number): void { emit('update', props.effects.filter((_, current) => current !== index)) }
function previewColor(effect: LightEffect, keyIndex: number): string {
  if (effect.type <= 2) return effect.staticColors[keyIndex] ?? '#000000'
  return effect.dynamicColors[keyIndex % effect.dynamicColors.length] ?? '#000000'
}
function pickFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('import', file)
}
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">HOST-MANAGED · WRITE</p><h2>{{ t('lighting.title') }}</h2></div><div class="actions"><label class="file-button">{{ t('lighting.import') }}<input type="file" accept="application/json" @change="pickFile"></label><button class="secondary" @click="$emit('export')">{{ t('lighting.export') }}</button><button class="secondary" :disabled="busy || count >= profile.maxEffects" @click="add">{{ t('lighting.add') }}</button><button :disabled="busy || count === 0" @click="$emit('install')">{{ t('lighting.install', { count }) }}</button></div></div>
    <p class="empty">{{ t('lighting.help') }}</p>
    <div v-if="selectedEffect" class="light-keyboard-preview" :aria-label="t('lighting.keyboardPreview')">
      <div class="preview-heading"><strong>{{ t('lighting.keyboardPreview') }}</strong><span>{{ selectedEffect.name }}</span></div>
      <div v-for="(length, row) in rowLengths" :key="row" class="light-preview-row">
        <span v-for="column in length" :key="column" class="light-preview-key" :style="{ '--key-width': KEY_WIDTHS[row]?.[column - 1] ?? 1, backgroundColor: previewColor(selectedEffect, rowOffsets[row] + column - 1) }"></span>
      </div>
    </div>
    <div v-for="(effect, index) in effects" :key="index" class="light-item" :class="{ selected: selected === index }" @click="selected = index">
      <input :value="effect.name" maxlength="40" @change="replace(index, { name: ($event.target as HTMLInputElement).value })">
      <select :value="effect.type" @change="changeType(index, Number(($event.target as HTMLSelectElement).value))"><option v-for="(name, type) in typeNames" :key="type" :value="Number(type)">{{ name }} ({{ type }})</option></select>
      <label v-if="effect.type <= 2" :title="effect.type === 2 ? t('lighting.fillAllHelp') : t('lighting.singleHelp')">{{ effect.type === 2 ? t('lighting.fillAll') : t('common.color') }} <input type="color" :value="effect.staticColors[0]" @input="changePrimary(index, ($event.target as HTMLInputElement).value)"></label>
      <span v-if="effect.type !== 1">{{ t('lighting.colors', { count: effect.type === 2 ? effect.staticColors.length : effect.dynamicColors.length }) }}</span>
      <button v-if="effect.type !== 1" class="secondary" :disabled="busy" @click="expanded = expanded === index ? null : index">{{ expanded === index ? t('lighting.collapse') : (effect.type === 2 ? t('lighting.perKey') : t('lighting.palette')) }}</button>
      <button class="secondary" :disabled="busy" @click="$emit('preview', effect)">{{ t('lighting.preview') }}</button>
      <button class="danger" :disabled="busy" @click="remove(index)">{{ t('lighting.remove') }}</button>
      <div v-if="expanded === index && effect.type === 2" class="light-color-editor per-key-colors">
        <div v-for="(length, row) in rowLengths" :key="row" class="color-row">
          <label v-for="column in length" :key="column" :title="`Key ${rowOffsets[row] + column - 1}: ${effect.staticColors[rowOffsets[row] + column - 1]}`">
            <input type="color" :value="effect.staticColors[rowOffsets[row] + column - 1]" @input="changeColor(index, rowOffsets[row] + column - 1, ($event.target as HTMLInputElement).value)">
            <small>{{ rowOffsets[row] + column - 1 }}</small>
          </label>
        </div>
      </div>
      <div v-else-if="expanded === index" class="light-color-editor palette-colors">
        <label v-for="(color, colorIndex) in effect.dynamicColors" :key="colorIndex" :title="`Palette ${colorIndex + 1}: ${color}`"><input type="color" :value="color" @input="changeColor(index, colorIndex, ($event.target as HTMLInputElement).value)"><small>{{ colorIndex + 1 }}</small></label>
        <button class="secondary" :disabled="busy || effect.dynamicColors.length >= MAX_LIGHT_PALETTE_COLORS" @click="addPaletteColor(index)">+</button>
        <button class="secondary" :disabled="busy || effect.dynamicColors.length <= 1" @click="removePaletteColor(index)">−</button>
      </div>
    </div>
  </section>
</template>
