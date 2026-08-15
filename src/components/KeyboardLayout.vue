<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { keyboardLayerRows, keycodeName, type KeyboardLayerResponse } from '../protocol/layout.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
const props = defineProps<{ layer: KeyboardLayerResponse; busy: boolean; hasBackup: boolean }>()
defineEmits<{ apply: [layer: number, data: Uint8Array]; restore: [layer: number] }>()
const draft = ref(props.layer.data.slice())
const selected = ref<number | null>(null)
watch(() => props.layer.data, data => { draft.value = data.slice(); selected.value = null })
const rows = computed(() => keyboardLayerRows(draft.value))
const changed = computed(() => draft.value.reduce((count, value, index) => count + (value === props.layer.data[index] ? 0 : 1), 0))
const rowOffsets = [0, 14, 28, 41, 53]
const { t } = useI18n()
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
    <div class="keyboard-layout"><div v-for="(row, rowIndex) in rows" :key="rowIndex" class="key-row"><button v-for="(keycode, keyIndex) in row" :key="keyIndex" class="key" :class="{ selected: selected === rowOffsets[rowIndex] + keyIndex, changed: keycode !== layer.data[rowOffsets[rowIndex] + keyIndex] }" :title="keycodeName(keycode)" @click="selectKey(rowIndex, keyIndex)"><strong>{{ keycodeName(keycode) }}</strong><small>{{ formatHex(keycode, 2) }}</small></button></div></div>
    <div v-if="selected !== null" class="key-editor"><span>{{ t('layer.selected', { index: selected }) }} · {{ keycodeName(draft[selected]) }}</span><input :value="draft[selected]" type="number" min="0" max="255" @input="setSelected(Number(($event.target as HTMLInputElement).value))"><code>{{ formatHex(draft[selected], 2) }}</code></div>
    <details class="raw-details"><summary>{{ t('layer.raw') }}</summary><code class="layout-raw">{{ bytesToHex(layer.data) }}</code></details>
  </section>
</template>
