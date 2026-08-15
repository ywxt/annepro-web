<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { decodeMacroEvents, encodeMacroEvents, type ActiveMacroBinding, type MacroBackup, type MacroEvent, type StoredMacro } from '../protocol/macro-info.ts'
import { keycodeName } from '../protocol/layout.ts'
import { bytesToHex } from '../protocol/packet.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ backup: MacroBackup | null; busy: boolean; hasBackup: boolean }>()
const emit = defineEmits<{ readBackup: []; exportBackup: []; importBackup: [file: File]; apply: [macros: StoredMacro[], bindings: ActiveMacroBinding[]]; restore: [] }>()
const macros = ref<StoredMacro[]>([])
const bindings = ref<ActiveMacroBinding[]>([])
const { t } = useI18n()
watch(() => props.backup, (backup) => {
  if (!backup) return
  macros.value = backup.macros.map(macro => ({ ...macro, events: macro.events.slice(), separator: macro.separator.slice() }))
  bindings.value = backup.activeList.map(binding => ({ ...binding }))
}, { immediate: true })
const changed = computed(() => {
  if (!props.backup || macros.value.length !== props.backup.macros.length || bindings.value.length !== props.backup.activeList.length) return true
  return macros.value.some((macro, index) => { const original = props.backup!.macros[index]; return macro.name !== original.name || macro.icon !== original.icon || bytesToHex(macro.events) !== bytesToHex(original.events) })
    || bindings.value.some((binding, index) => { const original = props.backup!.activeList[index]; return binding.layer !== original.layer || binding.matrixPosition !== original.matrixPosition || binding.macroIndex !== original.macroIndex })
})
const validImage = computed(() => (macros.value.length === 0 && bindings.value.length === 0)
  || (bindings.value.length > 0 && macros.value.every((_, index) => bindings.value.some(binding => binding.macroIndex === index))))
function eventsFor(macro: StoredMacro): MacroEvent[] { return decodeMacroEvents(macro.events) }
function updateMacro(index: number, patch: Partial<Pick<StoredMacro, 'name' | 'icon'>>): void { macros.value[index] = { ...macros.value[index], ...patch } }
function updateEvent(macroIndex: number, eventIndex: number, patch: Partial<MacroEvent>): void { const events = eventsFor(macros.value[macroIndex]); events[eventIndex] = { ...events[eventIndex], ...patch }; macros.value[macroIndex] = { ...macros.value[macroIndex], events: encodeMacroEvents(events) } }
function addEvent(macroIndex: number): void { const events = eventsFor(macros.value[macroIndex]); events.push({ type: 3, value: 10 }); macros.value[macroIndex] = { ...macros.value[macroIndex], events: encodeMacroEvents(events) } }
function removeEvent(macroIndex: number, eventIndex: number): void { const events = eventsFor(macros.value[macroIndex]); events.splice(eventIndex, 1); macros.value[macroIndex] = { ...macros.value[macroIndex], events: encodeMacroEvents(events) } }
function addMacro(): void { if (macros.value.length >= 16) return; const id = macros.value.length; macros.value.push({ id, uuid: '0', icon: 0, name: `Macro ${id + 1}`, events: new Uint8Array(), separator: new Uint8Array([0, 0, 0]) }) }
function removeMacro(index: number): void { macros.value.splice(index, 1); bindings.value = bindings.value.filter(binding => binding.macroIndex !== index).map(binding => ({ ...binding, macroIndex: binding.macroIndex > index ? binding.macroIndex - 1 : binding.macroIndex })) }
function addBinding(): void { if (bindings.value.length < 64 && macros.value.length) bindings.value.push({ layer: 0, matrixPosition: 0, macroIndex: 0 }) }
function eventLabel(event: MacroEvent): string { if (event.type === 3) return `${event.value} ms`; const action = event.type === 1 ? t('macro.keyUp') : event.type === 2 ? t('macro.keyDown') : event.type === 4 ? t('macro.mouseUp') : t('macro.mouseDown'); return `${action}: ${keycodeName(event.value)}` }
function pickFile(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) emit('importBackup', file) }
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">BACKUP · EDIT · VERIFY</p><h2>{{ t('macro.title') }}</h2></div><div class="actions"><label class="file-button">{{ t('macro.import') }}<input type="file" accept="application/json" :disabled="busy" @change="pickFile"></label><button v-if="backup" class="secondary" @click="emit('exportBackup')">{{ t('macro.export') }}</button><button class="secondary" :disabled="busy" @click="emit('readBackup')">{{ t('macro.refresh') }}</button><button v-if="hasBackup" class="secondary" :disabled="busy" @click="emit('restore')">{{ t('macro.restore') }}</button><button :disabled="busy || !backup || !changed || !validImage" @click="emit('apply', macros, bindings)">{{ t('macro.apply') }}</button></div></div>
    <p v-if="!backup" class="empty">{{ t('macro.empty') }}</p>
    <template v-else>
      <p class="decoded">{{ t('macro.summary', { macros: macros.length, bindings: bindings.length }) }} · {{ changed ? t('macro.changed') : t('macro.synced') }}</p>
      <p v-if="!validImage" class="warning">{{ t('macro.invalid') }}</p>
      <div class="actions"><button class="secondary" :disabled="busy || macros.length >= 16" @click="addMacro">{{ t('macro.addMacro') }}</button><button class="secondary" :disabled="busy || macros.length === 0 || bindings.length >= 64" @click="addBinding">{{ t('macro.addBinding') }}</button></div>
      <article v-for="(macro, macroIndex) in macros" :key="macroIndex" class="macro-item macro-editor">
        <div class="section-heading"><strong>Macro {{ macroIndex + 1 }}</strong><button class="danger" :disabled="busy" @click="removeMacro(macroIndex)">{{ t('lighting.remove') }}</button></div>
        <label>{{ t('macro.name') }} <input :value="macro.name" maxlength="64" @input="updateMacro(macroIndex, { name: ($event.target as HTMLInputElement).value })"></label>
        <label>Icon <input :value="macro.icon" type="number" min="0" max="65535" @input="updateMacro(macroIndex, { icon: Number(($event.target as HTMLInputElement).value) })"></label>
        <div v-for="(event, eventIndex) in eventsFor(macro)" :key="eventIndex" class="macro-event"><span>{{ eventLabel(event) }}</span><select :value="event.type" @change="updateEvent(macroIndex, eventIndex, { type: Number(($event.target as HTMLSelectElement).value) as MacroEvent['type'] })"><option :value="1">{{ t('macro.keyUp') }}</option><option :value="2">{{ t('macro.keyDown') }}</option><option :value="3">{{ t('macro.delay') }}</option><option :value="4">{{ t('macro.mouseUp') }}</option><option :value="5">{{ t('macro.mouseDown') }}</option></select><input :value="event.value" type="number" min="0" max="65535" @input="updateEvent(macroIndex, eventIndex, { value: Number(($event.target as HTMLInputElement).value) })"><button class="secondary" @click="removeEvent(macroIndex, eventIndex)">{{ t('macro.remove') }}</button></div>
        <button class="secondary" :disabled="macro.events.byteLength >= 4095" @click="addEvent(macroIndex)">{{ t('macro.addEvent') }}</button><details class="raw-details"><summary>{{ t('layer.raw') }}</summary><code>{{ bytesToHex(macro.events) }}</code></details>
      </article>
      <h3>{{ t('macro.bindings') }}</h3>
      <div v-for="(binding, index) in bindings" :key="index" class="macro-binding"><label>Layer <select v-model.number="binding.layer"><option v-for="layer in 4" :key="layer" :value="layer - 1">{{ t(`layer.${layer - 1}`) }}</option></select></label><label>Matrix <input v-model.number="binding.matrixPosition" type="number" min="0" max="255"></label><label>Macro <select v-model.number="binding.macroIndex"><option v-for="(_, macroIndex) in macros" :key="macroIndex" :value="macroIndex">{{ macroIndex + 1 }}</option></select></label><button class="secondary" @click="bindings.splice(index, 1)">{{ t('macro.remove') }}</button></div>
    </template>
  </section>
</template>
