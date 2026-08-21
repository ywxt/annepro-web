<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'
import { useI18n } from 'vue-i18n'
import ToggleSwitch from './ToggleSwitch.vue'
import SegmentedControl from './SegmentedControl.vue'
import { SETTINGS_AUTOSAVE_DELAY_MS } from '../protocol/timing.ts'

type SettingsSection = 'device' | 'keys' | 'lighting' | 'macros'

const props = defineProps<{ section: SettingsSection; state: HardwareState; ledPowerMode: LedPowerModeResponse | null; capabilities: DeviceCapabilities | null; busy: boolean; hasBackup: boolean }>()
const emit = defineEmits<{ apply: [changes: Array<{ key: HardwareSettingKey; value: number }>]; restore: [] }>()
const { t } = useI18n({ useScope: 'global' })
const form = reactive<Record<HardwareSettingKey, number>>({
  userLayout: 0, magicFn: 0, macroTrigger: 0, capslockLed: 0,
  backlightBrightness: 10, ledHold: 0, tapStatus: 1, tapActMode: 2,
  tapTimeoutValue: 26, sleepTimeoutRaw: 600, ledPowerMode: 1,
})

watch(() => [props.state, props.ledPowerMode] as const, ([state, power]) => {
  Object.assign(form, {
    userLayout: state.userLayout, magicFn: state.magicFn,
    macroTrigger: state.macroTrigger, capslockLed: state.capslockLed,
    backlightBrightness: state.backlightBrightness, ledHold: state.ledHold,
    tapStatus: state.tapStatus, tapActMode: state.tapActMode,
    tapTimeoutValue: state.tapTimeoutValue, sleepTimeoutRaw: state.sleepTimeoutRaw,
    ledPowerMode: power?.mode ?? form.ledPowerMode,
  })
}, { immediate: true })

const tapTimeoutMs = computed({
  get: () => form.tapTimeoutValue * 10,
  set: value => { form.tapTimeoutValue = Math.round(value / 10) },
})

const sectionKeys = computed<HardwareSettingKey[]>(() => ({
  device: ['ledHold', 'sleepTimeoutRaw'],
  keys: ['userLayout', 'magicFn', 'tapStatus', 'tapActMode', 'tapTimeoutValue'],
  lighting: ['capslockLed', 'backlightBrightness', 'ledPowerMode'],
  macros: ['macroTrigger'],
})[props.section] as HardwareSettingKey[])

const changes = computed(() => sectionKeys.value.flatMap((key) => {
  if (key === 'sleepTimeoutRaw' && form.ledHold === 0) return []
  const current = key === 'ledPowerMode' ? props.ledPowerMode?.mode : props.state[key]
  return current === form[key] ? [] : [{ key, value: form[key] }]
}))
const canApply = computed(() => changes.value.length > 0 && !(
  props.section === 'device'
  && form.ledHold === 1
  && (form.sleepTimeoutRaw < 10 || form.sleepTimeoutRaw > 3600)
))

let autosaveTimer: number | null = null
watch(changes, (next) => {
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer)
  autosaveTimer = null
  if (!canApply.value || props.busy) return
  const snapshot = next.map(change => ({ ...change }))
  autosaveTimer = window.setTimeout(() => {
    if (!props.busy) emit('apply', snapshot)
    autosaveTimer = null
  }, SETTINGS_AUTOSAVE_DELAY_MS)
}, { deep: true })
onBeforeUnmount(() => { if (autosaveTimer !== null) window.clearTimeout(autosaveTimer) })
</script>

<template>
  <div class="settings-editor">
    <div class="settings-bar"><span class="autosave-state"><span class="status-pulse" :class="{ saving: busy }"></span>{{ busy ? t('settings.saving') : t('settings.autoApply') }}</span><button v-if="hasBackup" class="text-action" :disabled="busy" @click="$emit('restore')">{{ t('settings.restore') }}</button></div>
    <div v-if="section === 'device'" class="setting-cluster"><div class="cluster-heading"><span class="cluster-icon">◷</span><div><h3>{{ t('settings.sleepGroup') }}</h3><p>{{ t('settings.sleepHelp') }}</p></div></div><div class="cluster-controls"><label>{{ t('settings.autoSleep') }}<ToggleSwitch v-model="form.ledHold" :off-label="t('settings.disabled')" :on-label="t('settings.enabled')" /></label><label v-if="capabilities?.sleepTimeout" :class="{ inactive: form.ledHold === 0 }">{{ t('settings.sleepTime') }}<span class="number-unit"><input v-model.number="form.sleepTimeoutRaw" type="number" min="10" max="3600" :disabled="form.ledHold === 0"><span>{{ t('settings.seconds') }}</span></span></label></div></div>
    <template v-if="section === 'keys'"><div class="setting-cluster"><div class="cluster-heading"><span class="cluster-icon">⌨</span><div><h3>{{ t('settings.layoutGroup') }}</h3></div></div><div class="cluster-controls"><label>{{ t('settings.layout') }}<ToggleSwitch v-model="form.userLayout" :off-label="t('settings.defaultLayout')" :on-label="t('settings.userLayout')" /></label><label>Magic Fn<SegmentedControl v-model="form.magicFn" :options="[{ value: 0, label: t('settings.disabled'), icon: '○' }, { value: 1, label: 'Fn1', icon: 'F₁' }, { value: 2, label: 'Fn2', icon: 'F₂' }]" /></label></div></div><div class="setting-cluster"><div class="cluster-heading"><span class="cluster-icon">T</span><div><h3>{{ t('settings.tapGroup') }}</h3><p>{{ t('settings.tapHelp') }}</p></div></div><div class="cluster-controls"><label>Tap<ToggleSwitch v-model="form.tapStatus" :off-label="t('settings.disabled')" :on-label="t('settings.enabled')" /></label><label>{{ t('settings.tapMode') }}<SegmentedControl v-model="form.tapActMode" :options="[{ value: 2, label: t('settings.normal'), icon: 'A' }, { value: 3, label: t('settings.combo'), icon: 'A+B' }]" /></label><label class="wide-control">{{ t('settings.tapTime') }}<input v-model.number="tapTimeoutMs" type="range" min="100" max="2000" step="10"><span>{{ tapTimeoutMs }} ms</span></label></div></div></template>
    <div v-if="section === 'lighting'" class="setting-cluster"><div class="cluster-heading"><span class="cluster-icon">☀</span><div><h3>{{ t('settings.lightGroup') }}</h3></div></div><div class="cluster-controls"><label class="caps-effect-control">{{ t('settings.capsLed') }}<ToggleSwitch v-model="form.capslockLed" :off-label="t('settings.capsOnly')" :on-label="t('settings.allKeys')" /></label><label class="wide-control">{{ t('settings.backlight') }}<input v-model.number="form.backlightBrightness" type="range" min="1" max="10"><span>{{ form.backlightBrightness * 10 }}%</span></label><label v-if="capabilities?.ledPowerMode && ledPowerMode">{{ t('settings.ledPower') }}<SegmentedControl v-model="form.ledPowerMode" :options="[{ value: 1, label: 'Low', icon: '◐' }, { value: 2, label: 'High', icon: '●' }]" /></label></div></div>
    <div v-if="section === 'macros'" class="setting-cluster"><div class="cluster-heading"><span class="cluster-icon">◆</span><div><h3>{{ t('settings.macroTrigger') }}</h3></div></div><div class="cluster-controls"><label>{{ t('settings.macroTrigger') }}<ToggleSwitch v-model="form.macroTrigger" :off-label="t('settings.disabled')" :on-label="t('settings.enabled')" /></label></div></div>
  </div>
</template>
