<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'
import { useI18n } from 'vue-i18n'
import ToggleSwitch from './ToggleSwitch.vue'

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

function apply(): void {
  emit('apply', changes.value)
}
</script>

<template>
  <div class="settings-editor">
    <div class="section-heading"><div><p class="eyebrow">WRITE · VERIFIED</p><h3>{{ t('settings.edit') }}</h3></div><div class="actions"><button v-if="hasBackup" class="secondary" :disabled="busy" @click="$emit('restore')">{{ t('settings.restore') }}</button><button :title="t('settings.apply')" :aria-label="t('settings.apply')" :disabled="busy || !canApply" @click="apply"><span aria-hidden="true">✓</span><span class="button-label">{{ t('settings.apply') }}</span></button></div></div>
    <p class="empty">{{ t('settings.groupHelp') }}</p>
    <div class="control-grid">
      <label v-if="section === 'keys'">{{ t('settings.layout') }}<ToggleSwitch v-model="form.userLayout" :off-label="t('settings.defaultLayout')" :on-label="t('settings.userLayout')" /></label>
      <label v-if="section === 'keys'">Magic Fn<select v-model.number="form.magicFn"><option :value="0">{{ t('settings.disabled') }}</option><option :value="1">Fn1</option><option :value="2">Fn2</option></select></label>
      <label v-if="section === 'macros'">{{ t('settings.macroTrigger') }}<ToggleSwitch v-model="form.macroTrigger" :off-label="t('settings.disabled')" :on-label="t('settings.enabled')" /></label>
      <label v-if="section === 'lighting'">{{ t('settings.capsLed') }}<ToggleSwitch v-model="form.capslockLed" :off-label="t('settings.capsOnly')" :on-label="t('settings.allKeys')" /></label>
      <label v-if="section === 'lighting'">{{ t('settings.backlight') }}<input v-model.number="form.backlightBrightness" type="range" min="1" max="10"><span>{{ form.backlightBrightness * 10 }}%</span></label>
      <label v-if="section === 'device'">{{ t('settings.autoSleep') }}<ToggleSwitch v-model="form.ledHold" :off-label="t('settings.disabled')" :on-label="t('settings.enabled')" /></label>
      <label v-if="section === 'keys'">Tap<ToggleSwitch v-model="form.tapStatus" :off-label="t('settings.disabled')" :on-label="t('settings.enabled')" /></label>
      <label v-if="section === 'keys'">{{ t('settings.tapMode') }}<select v-model.number="form.tapActMode"><option :value="2">{{ t('settings.normal') }}</option><option :value="3">{{ t('settings.combo') }}</option></select></label>
      <label v-if="section === 'keys'">{{ t('settings.tapTime') }}<input v-model.number="tapTimeoutMs" type="range" min="100" max="2000" step="10"><span>{{ tapTimeoutMs }} ms</span></label>
      <label v-if="section === 'device' && capabilities?.sleepTimeout" :class="{ inactive: form.ledHold === 0 }">{{ t('settings.sleepTime') }}<input v-model.number="form.sleepTimeoutRaw" type="number" min="10" max="3600" :disabled="form.ledHold === 0"><span>{{ t('settings.seconds') }}</span></label>
      <label v-if="section === 'lighting' && capabilities?.ledPowerMode && ledPowerMode">{{ t('settings.ledPower') }}<select v-model.number="form.ledPowerMode"><option :value="1">Low</option><option :value="2">High</option></select></label>
    </div>
  </div>
</template>
