<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { decodeMacroEvents, encodeMacroEvents, type ActiveMacroBinding, type MacroBackup, type MacroEvent, type StoredMacro } from '../protocol/macro-info.ts'
import { keycodeName } from '../protocol/layout.ts'
import { bytesToHex } from '../protocol/packet.ts'

const props = defineProps<{ backup: MacroBackup | null; busy: boolean; hasBackup: boolean }>()
const emit = defineEmits<{ readBackup: []; exportBackup: []; importBackup: [file: File]; apply: [macros: StoredMacro[], bindings: ActiveMacroBinding[]]; restore: [] }>()
const macros = ref<StoredMacro[]>([])
const bindings = ref<ActiveMacroBinding[]>([])
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
function eventLabel(event: MacroEvent): string { if (event.type === 3) return `${event.value} ms`; const action = event.type === 1 ? 'Key up' : event.type === 2 ? 'Key down' : event.type === 4 ? 'Mouse up' : 'Mouse down'; return `${action}: ${keycodeName(event.value)}` }
function pickFile(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) emit('importBackup', file) }
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">BACKUP · EDIT · VERIFY</p><h2>巨集</h2></div><div class="actions"><label class="file-button">匯入備份<input type="file" accept="application/json" :disabled="busy" @change="pickFile"></label><button v-if="backup" class="secondary" @click="emit('exportBackup')">匯出備份</button><button class="secondary" :disabled="busy" @click="emit('readBackup')">讀取鍵盤</button><button v-if="hasBackup" class="secondary" :disabled="busy" @click="emit('restore')">復原首次備份</button><button :disabled="busy || !backup || !changed || !validImage" @click="emit('apply', macros, bindings)">套用並回讀驗證</button></div></div>
    <p v-if="!backup" class="empty">請先讀取鍵盤；寫入前會保留完整巨集備份。</p>
    <template v-else>
      <p class="decoded">{{ macros.length }} / 16 個巨集 · {{ bindings.length }} / 64 個綁定 · {{ changed ? '有未套用變更' : '與鍵盤一致' }}</p>
      <p v-if="!validImage" class="warning">每個裝置內巨集都必須至少綁定一個鍵位，才能套用。</p>
      <div class="actions"><button class="secondary" :disabled="busy || macros.length >= 16" @click="addMacro">新增巨集</button><button class="secondary" :disabled="busy || macros.length === 0 || bindings.length >= 64" @click="addBinding">新增綁定</button></div>
      <article v-for="(macro, macroIndex) in macros" :key="macroIndex" class="macro-item macro-editor">
        <div class="section-heading"><strong>Macro {{ macroIndex }}</strong><button class="danger" :disabled="busy" @click="removeMacro(macroIndex)">刪除</button></div>
        <label>名稱 <input :value="macro.name" maxlength="64" @input="updateMacro(macroIndex, { name: ($event.target as HTMLInputElement).value })"></label>
        <label>Icon <input :value="macro.icon" type="number" min="0" max="65535" @input="updateMacro(macroIndex, { icon: Number(($event.target as HTMLInputElement).value) })"></label>
        <div v-for="(event, eventIndex) in eventsFor(macro)" :key="eventIndex" class="macro-event"><span>{{ eventLabel(event) }}</span><select :value="event.type" @change="updateEvent(macroIndex, eventIndex, { type: Number(($event.target as HTMLSelectElement).value) as MacroEvent['type'] })"><option :value="1">Key up</option><option :value="2">Key down</option><option :value="3">Delay</option><option :value="4">Mouse up</option><option :value="5">Mouse down</option></select><input :value="event.value" type="number" min="0" max="65535" @input="updateEvent(macroIndex, eventIndex, { value: Number(($event.target as HTMLInputElement).value) })"><button class="secondary" @click="removeEvent(macroIndex, eventIndex)">移除</button></div>
        <button class="secondary" :disabled="macro.events.byteLength >= 4095" @click="addEvent(macroIndex)">新增事件</button><code>{{ bytesToHex(macro.events) }}</code>
      </article>
      <h3>鍵位綁定（matrix position）</h3>
      <div v-for="(binding, index) in bindings" :key="index" class="macro-binding"><label>Layer <input v-model.number="binding.layer" type="number" min="0" max="3"></label><label>Matrix <input v-model.number="binding.matrixPosition" type="number" min="0" max="255"></label><label>Macro <select v-model.number="binding.macroIndex"><option v-for="(_, macroIndex) in macros" :key="macroIndex" :value="macroIndex">{{ macroIndex }}</option></select></label><button class="secondary" @click="bindings.splice(index, 1)">移除</button></div>
    </template>
  </section>
</template>
