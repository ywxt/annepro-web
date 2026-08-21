<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { KEY_WIDTHS, keyboardLayerRows, keycapLabel, keycodeName, keycodeOptions, type KeyboardLayerResponse } from '../protocol/layout.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
const props = defineProps<{ layer: KeyboardLayerResponse; draft: Uint8Array; busy: boolean }>()
const emit = defineEmits<{ update: [layer: number, data: Uint8Array] }>()
const selected = ref<number | null>(null)
const query = ref('')
watch(() => props.layer.layer, () => { selected.value = null })
const rows = computed(() => keyboardLayerRows(props.draft))
const changed = computed(() => props.draft.reduce((count, value, index) => count + (value === props.layer.data[index] ? 0 : 1), 0))
const selectedValue = computed(() => selected.value === null ? 0 : props.draft[selected.value])
const rowOffsets = [0, 14, 28, 41, 53]
const choices = keycodeOptions()
const choiceGroups = ['Basic', 'Function', 'Media', 'Anne Pro', 'Modifiers'] as const
const filteredChoices = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return term ? choices.filter(choice => `${choice.name} ${formatHex(choice.value, 2)}`.toLocaleLowerCase().includes(term)) : choices
})
const { t } = useI18n({ useScope: 'global' })
const layerName = computed(() => t(`layer.${props.layer.layer}`))
function selectKey(row: number, column: number): void { selected.value = rowOffsets[row] + column; query.value = '' }
function closeEditor(): void { selected.value = null; query.value = '' }
function setSelected(value: number): void {
  if (selected.value === null || !Number.isInteger(value) || value < 0 || value > 255) return
  const next = props.draft.slice()
  next[selected.value] = value
  emit('update', props.layer.layer, next)
  closeEditor()
}
</script>

<template>
  <div class="keyboard-layer"><div class="section-heading"><h3>{{ layerName }}</h3><span>{{ t('layer.keys', { count: layer.data.byteLength }) }} · {{ t('layer.changes', { count: changed }) }}</span></div>
    <div class="keyboard-layout"><div v-for="(row, rowIndex) in rows" :key="rowIndex" class="key-row"><button v-for="(keycode, keyIndex) in row" :key="keyIndex" class="key" :class="{ selected: selected === rowOffsets[rowIndex] + keyIndex, changed: keycode !== layer.data[rowOffsets[rowIndex] + keyIndex], transparent: keycode === 1 }" :style="{ '--key-width': KEY_WIDTHS[rowIndex][keyIndex] }" :title="keycodeName(keycode)" @click="selectKey(rowIndex, keyIndex)"><strong>{{ keycapLabel(keycode) }}</strong><small v-if="keycode !== 1">{{ formatHex(keycode, 2) }}</small></button></div></div>
    <Teleport to="body"><div v-if="selected !== null" class="key-picker-backdrop" @click.self="closeEditor"><section class="key-picker" role="dialog" aria-modal="true" :aria-label="t('layer.changeKey')"><div class="key-picker-heading"><div><p class="eyebrow">{{ t('layer.selected', { index: selected }) }}</p><h2>{{ keycodeName(selectedValue) }} <code>{{ formatHex(selectedValue, 2) }}</code></h2></div><button class="secondary key-picker-close" :aria-label="t('common.close')" @click="closeEditor">×</button></div><input v-model="query" class="key-search" autofocus type="search" :placeholder="t('layer.searchKey')"><div class="key-choice-groups"><section v-for="group in choiceGroups" v-show="filteredChoices.some(candidate => candidate.group === group)" :key="group" class="key-choice-group"><h3>{{ t(`keyGroup.${group}`) }}</h3><div class="key-choice-grid"><button v-for="option in filteredChoices.filter(candidate => candidate.group === group)" :key="option.value" class="key-choice" :class="{ active: option.value === selectedValue }" @click="setSelected(option.value)"><strong>{{ option.name }}</strong><code>{{ formatHex(option.value, 2) }}</code></button></div></section><p v-if="filteredChoices.length === 0" class="empty">{{ t('layer.noKeyResult') }}</p></div></section></div></Teleport>
    <details class="raw-details"><summary>{{ t('layer.raw') }}</summary><code class="layout-raw">{{ bytesToHex(layer.data) }}</code></details>
  </div>
</template>
