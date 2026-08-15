<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { KEY_WIDTHS, keyboardLayerRows, keycapLabel, keycodeName, keycodeOptions, type KeyboardLayerResponse } from '../protocol/layout.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
const props = defineProps<{ layer: KeyboardLayerResponse; busy: boolean; hasBackup: boolean }>()
defineEmits<{ apply: [layer: number, data: Uint8Array]; restore: [layer: number] }>()
const draft = ref(props.layer.data.slice())
const selected = ref<number | null>(null)
watch(() => props.layer.data, data => { draft.value = data.slice(); selected.value = null })
const rows = computed(() => keyboardLayerRows(draft.value))
const changed = computed(() => draft.value.reduce((count, value, index) => count + (value === props.layer.data[index] ? 0 : 1), 0))
const selectedValue = computed(() => selected.value === null ? 0 : draft.value[selected.value])
const rowOffsets = [0, 14, 28, 41, 53]
const choices = keycodeOptions()
const choiceGroups = ['Basic', 'Function', 'Media', 'Anne Pro', 'Modifiers'] as const
const { t } = useI18n({ useScope: 'global' })
const layerName = computed(() => t(`layer.${props.layer.layer}`))
function selectKey(row: number, column: number): void { selected.value = rowOffsets[row] + column }
function setSelected(value: number): void {
  if (selected.value === null || !Number.isInteger(value) || value < 0 || value > 255) return
  const next = draft.value.slice()
  next[selected.value] = value
  draft.value = next
}
</script>

<template>
  <section class="card"><div class="section-heading"><h2>{{ layerName }}</h2><div class="actions"><span>{{ t('layer.keys', { count: layer.data.byteLength }) }} · {{ t('layer.changes', { count: changed }) }}</span><button v-if="hasBackup" class="secondary" :disabled="busy" @click="$emit('restore', layer.layer)">{{ t('layer.restore') }}</button><button :disabled="busy || changed === 0" @click="$emit('apply', layer.layer, draft)">{{ t('layer.apply', { name: layerName }) }}</button></div></div>
    <div class="keyboard-layout"><div v-for="(row, rowIndex) in rows" :key="rowIndex" class="key-row"><button v-for="(keycode, keyIndex) in row" :key="keyIndex" class="key" :class="{ selected: selected === rowOffsets[rowIndex] + keyIndex, changed: keycode !== layer.data[rowOffsets[rowIndex] + keyIndex], transparent: keycode === 1 }" :style="{ '--key-width': KEY_WIDTHS[rowIndex][keyIndex] }" :title="keycodeName(keycode)" @click="selectKey(rowIndex, keyIndex)"><strong>{{ keycapLabel(keycode) }}</strong><small v-if="keycode !== 1">{{ formatHex(keycode, 2) }}</small></button></div></div>
    <div v-if="selected !== null" class="key-editor"><label><span>{{ t('layer.selected', { index: selected }) }}</span><select :value="selectedValue" @change="setSelected(Number(($event.target as HTMLSelectElement).value))"><option v-if="!choices.some(option => option.value === selectedValue)" :value="selectedValue">{{ keycodeName(selectedValue) }} · {{ formatHex(selectedValue, 2) }}</option><optgroup v-for="group in choiceGroups" :key="group" :label="t(`keyGroup.${group}`)"><option v-for="option in choices.filter(candidate => candidate.group === group)" :key="option.value" :value="option.value">{{ option.name }} · {{ formatHex(option.value, 2) }}</option></optgroup></select></label><code>{{ formatHex(selectedValue, 2) }}</code></div>
    <details class="raw-details"><summary>{{ t('layer.raw') }}</summary><code class="layout-raw">{{ bytesToHex(layer.data) }}</code></details>
  </section>
</template>
