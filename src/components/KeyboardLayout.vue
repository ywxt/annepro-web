<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { C18_LAYOUT_SPEC, KEY_WIDTHS, decodeLayoutKeycodes, encodeLayoutKeycodes, keyboardKeycodeRows, keycapLabel, keycodeIcon, keycodeName, keycodeOptions, type KeyboardLayerResponse, type KeyboardLayoutSpec, type KeycodeOption } from '../protocol/layout.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'
const props = defineProps<{ layer: KeyboardLayerResponse; draft: Uint8Array; spec?: KeyboardLayoutSpec; busy: boolean }>()
const emit = defineEmits<{ update: [layer: number, data: Uint8Array] }>()
const selected = ref<number | null>(null)
const query = ref('')
type ChoiceGroup = 'Common' | KeycodeOption['group']
const activeGroup = ref<ChoiceGroup>('Common')
watch(() => props.layer.layer, () => { selected.value = null })
const layoutSpec = computed(() => props.spec ?? C18_LAYOUT_SPEC)
const keycodes = computed(() => decodeLayoutKeycodes(props.draft, layoutSpec.value))
const savedKeycodes = computed(() => decodeLayoutKeycodes(props.layer.data, layoutSpec.value))
const rows = computed(() => keyboardKeycodeRows(keycodes.value, layoutSpec.value))
const changed = computed(() => keycodes.value.reduce((count, value, index) => count + (value === savedKeycodes.value[index] ? 0 : 1), 0))
const selectedValue = computed(() => selected.value === null ? 0 : keycodes.value[selected.value])
const rowOffsets = computed(() => layoutSpec.value.rowLengths.map((_, row) => layoutSpec.value.rowLengths.slice(0, row).reduce((sum, length) => sum + length, 0)))
const keyWidths = computed(() => layoutSpec.value.keycapCount === 61 && layoutSpec.value.keycodeWidth === 8
  ? KEY_WIDTHS
  : layoutSpec.value.rowLengths.map(length => Array.from({ length }, () => 1)))
const keycodeHexWidth = computed(() => layoutSpec.value.keycodeWidth === 16 ? 4 : 2)
const choices = keycodeOptions()
const choiceGroups = ['Basic', 'Function', 'Media', 'Anne Pro', 'Modifiers'] as const
const pickerGroups: ChoiceGroup[] = ['Common', ...choiceGroups]
const commonValues = new Set([0x00, 0x01, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x39, 0x4c, 0x4f, 0x50, 0x51, 0x52, 0xa8, 0xa9, 0xaa, 0xab, 0xac, 0xad, 0xc0, 0xc1, 0xe0, 0xe1, 0xe2, 0xe3, 0xf0, 0xf1, 0xf2])
const filteredChoices = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  if (term) return choices.filter(choice => `${choice.name} ${formatHex(choice.value, 2)}`.toLocaleLowerCase().includes(term))
  return activeGroup.value === 'Common' ? choices.filter(choice => commonValues.has(choice.value)) : choices.filter(choice => choice.group === activeGroup.value)
})
const { t } = useI18n({ useScope: 'global' })
const layerName = computed(() => t(`layer.${props.layer.layer}`))
function selectKey(row: number, column: number): void { selected.value = rowOffsets.value[row] + column; query.value = '' }
function closeEditor(): void { selected.value = null; query.value = '' }
function keyIcon(value: number): string {
  return keycodeIcon(value) ?? keycapLabel(value).slice(0, 3)
}
function setSelected(value: number): void {
  const maximum = layoutSpec.value.keycodeWidth === 16 ? 0xffff : 0xff
  if (selected.value === null || !Number.isInteger(value) || value < 0 || value > maximum) return
  const next = keycodes.value.slice()
  next[selected.value] = value
  emit('update', props.layer.layer, encodeLayoutKeycodes(next, layoutSpec.value))
  closeEditor()
}
</script>

<template>
  <div class="keyboard-layer"><div class="section-heading"><h3>{{ layerName }}</h3><span>{{ t('layer.keys', { count: layoutSpec.keycapCount }) }} · {{ t('layer.changes', { count: changed }) }}</span></div>
    <div class="keyboard-layout"><div v-for="(row, rowIndex) in rows" :key="rowIndex" class="key-row"><button v-for="(keycode, keyIndex) in row" :key="keyIndex" class="key" :class="{ selected: selected === rowOffsets[rowIndex] + keyIndex, changed: keycode !== savedKeycodes[rowOffsets[rowIndex] + keyIndex], transparent: keycode === 1, symbolic: keycodeIcon(keycode) }" :style="{ '--key-width': keyWidths[rowIndex][keyIndex] }" :title="keycodeName(keycode)" :aria-label="keycodeName(keycode)" @click="selectKey(rowIndex, keyIndex)"><strong>{{ keycodeIcon(keycode) ?? keycapLabel(keycode) }}</strong><small v-if="keycode !== 1">{{ formatHex(keycode, keycodeHexWidth) }}</small></button></div></div>
    <Teleport to="body"><div v-if="selected !== null" class="key-picker-backdrop" @click.self="closeEditor"><section class="key-picker" role="dialog" aria-modal="true" :aria-label="t('layer.changeKey')"><div class="key-picker-heading"><div><p class="eyebrow">{{ t('layer.selected', { index: selected }) }}</p><h2>{{ keycodeName(selectedValue) }} <code>{{ formatHex(selectedValue, keycodeHexWidth) }}</code></h2></div><button class="secondary key-picker-close" :aria-label="t('common.close')" @click="closeEditor">×</button></div><input v-model="query" class="key-search" autofocus type="search" :placeholder="t('layer.searchKey')"><div class="key-picker-tabs"><button v-for="group in pickerGroups" :key="group" :class="{ active: activeGroup === group }" @click="activeGroup = group; query = ''">{{ t(`keyGroup.${group}`) }}</button></div><div class="key-choice-groups"><div class="key-choice-grid"><button v-for="option in filteredChoices" :key="option.value" class="key-choice" :class="{ active: option.value === selectedValue }" @click="setSelected(option.value)"><span class="key-choice-icon" aria-hidden="true">{{ keyIcon(option.value) }}</span><span><strong>{{ option.name }}</strong><code>{{ formatHex(option.value, keycodeHexWidth) }}</code></span></button></div><p v-if="filteredChoices.length === 0" class="empty">{{ t('layer.noKeyResult') }}</p></div><p class="key-picker-hint">{{ t('layer.comboHint') }}</p></section></div></Teleport>
    <details class="raw-details"><summary>{{ t('layer.raw') }}</summary><code class="layout-raw">{{ bytesToHex(layer.data) }}</code></details>
  </div>
</template>
