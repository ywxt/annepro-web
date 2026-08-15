<script setup lang="ts">
import { computed, ref } from 'vue'
import { requiredLightColorCount, type LightEffect } from '../protocol/lighting.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ effects: LightEffect[]; busy: boolean }>()
const emit = defineEmits<{ update: [effects: LightEffect[]]; preview: [effect: LightEffect]; install: []; export: []; import: [file: File] }>()
const typeNames: Record<number, string> = {
  1: 'Static', 2: 'Per-key static', 3: 'Breath', 4: 'Gradient breath',
  5: 'Poptang', 6: 'Rainbow', 7: 'Single breath', 10: 'Trigger breath',
  11: 'Trigger rainbow', 13: 'Starry sky', 14: 'Comet', 16: 'Colorful',
  17: 'Wave', 18: 'Black hole', 19: 'Vertical rainbow', 21: 'Fountain',
  23: 'Flame', 24: 'Firework', 25: 'Star fall',
}
const count = computed(() => props.effects.length)
const expanded = ref<number | null>(null)
const { t } = useI18n()
const rowLengths = [14, 14, 13, 12, 8]
const rowOffsets = [0, 14, 28, 41, 53]
const rainbow = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080']

function replace(index: number, patch: Partial<LightEffect>): void {
  const next = props.effects.map((effect, current) => current === index ? { ...effect, ...patch } : effect)
  emit('update', next)
}
function changeType(index: number, type: number): void {
  const color = props.effects[index].colors[0] ?? '#ff0000'
  const required = requiredLightColorCount(type)
  replace(index, { type, colors: required === 12 ? rainbow.slice() : Array(required).fill(color) })
}
function changePrimary(index: number, color: string): void {
  const effect = props.effects[index]
  replace(index, { colors: effect.colors.map(() => color) })
}
function changeColor(effectIndex: number, colorIndex: number, color: string): void {
  const colors = props.effects[effectIndex].colors.slice()
  colors[colorIndex] = color
  replace(effectIndex, { colors })
}
function add(): void {
  if (props.effects.length >= 32) return
  emit('update', [...props.effects, { name: t('lighting.effectName', { count: props.effects.length + 1 }), type: 1, colors: ['#ff0000'] }])
}
function remove(index: number): void { emit('update', props.effects.filter((_, current) => current !== index)) }
function pickFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('import', file)
}
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">HOST-MANAGED · WRITE</p><h2>{{ t('lighting.title') }}</h2></div><div class="actions"><label class="file-button">{{ t('lighting.import') }}<input type="file" accept="application/json" @change="pickFile"></label><button class="secondary" @click="$emit('export')">{{ t('lighting.export') }}</button><button class="secondary" :disabled="busy || count >= 32" @click="add">{{ t('lighting.add') }}</button><button :disabled="busy || count === 0" @click="$emit('install')">{{ t('lighting.install', { count }) }}</button></div></div>
    <p class="empty">{{ t('lighting.help') }}</p>
    <div v-for="(effect, index) in effects" :key="index" class="light-item">
      <input :value="effect.name" maxlength="40" @change="replace(index, { name: ($event.target as HTMLInputElement).value })">
      <select :value="effect.type" @change="changeType(index, Number(($event.target as HTMLSelectElement).value))"><option v-for="(name, type) in typeNames" :key="type" :value="Number(type)">{{ name }} ({{ type }})</option></select>
      <input type="color" :value="effect.colors[0]" @input="changePrimary(index, ($event.target as HTMLInputElement).value)">
      <span>{{ t('lighting.colors', { count: effect.colors.length }) }}</span>
      <button v-if="effect.colors.length > 1" class="secondary" :disabled="busy" @click="expanded = expanded === index ? null : index">{{ expanded === index ? t('lighting.collapse') : (effect.type === 2 ? t('lighting.perKey') : t('lighting.palette')) }}</button>
      <button class="secondary" :disabled="busy" @click="$emit('preview', effect)">{{ t('lighting.preview') }}</button>
      <button class="danger" :disabled="busy" @click="remove(index)">{{ t('lighting.remove') }}</button>
      <div v-if="expanded === index && effect.type === 2" class="light-color-editor per-key-colors">
        <div v-for="(length, row) in rowLengths" :key="row" class="color-row">
          <label v-for="column in length" :key="column" :title="`Key ${rowOffsets[row] + column - 1}: ${effect.colors[rowOffsets[row] + column - 1]}`">
            <input type="color" :value="effect.colors[rowOffsets[row] + column - 1]" @input="changeColor(index, rowOffsets[row] + column - 1, ($event.target as HTMLInputElement).value)">
            <small>{{ rowOffsets[row] + column - 1 }}</small>
          </label>
        </div>
      </div>
      <div v-else-if="expanded === index" class="light-color-editor palette-colors">
        <label v-for="(color, colorIndex) in effect.colors" :key="colorIndex" :title="`Palette ${colorIndex + 1}: ${color}`"><input type="color" :value="color" @input="changeColor(index, colorIndex, ($event.target as HTMLInputElement).value)"><small>{{ colorIndex + 1 }}</small></label>
      </div>
    </div>
  </section>
</template>
