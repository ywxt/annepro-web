<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ state: HardwareState; ledPowerMode: LedPowerModeResponse | null; capabilities: DeviceCapabilities | null; busy: boolean; hasBackup: boolean }>()
const emit = defineEmits<{ apply: [key: HardwareSettingKey, value: number]; restore: [] }>()
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

function apply(key: HardwareSettingKey): void {
  emit('apply', key, form[key])
}
</script>

<template>
  <div class="settings-editor">
    <div class="section-heading"><div><p class="eyebrow">WRITE · VERIFIED</p><h3>{{ t('settings.edit') }}</h3></div><button v-if="hasBackup" class="secondary" :disabled="busy" @click="$emit('restore')">{{ t('settings.restore') }}</button></div>
    <p class="empty">{{ t('settings.help') }}</p>
    <div class="control-grid">
      <label>{{ t('settings.layout') }}<select v-model.number="form.userLayout"><option :value="0">{{ t('settings.defaultLayout') }}</option><option :value="1">{{ t('settings.userLayout') }}</option></select><button :disabled="busy || form.userLayout === state.userLayout" @click="apply('userLayout')">{{ t('settings.apply') }}</button></label>
      <label>Magic Fn<select v-model.number="form.magicFn"><option :value="0">{{ t('settings.disabled') }}</option><option :value="1">Fn1</option><option :value="2">Fn2</option></select><button :disabled="busy || form.magicFn === state.magicFn" @click="apply('magicFn')">{{ t('settings.apply') }}</button></label>
      <label>{{ t('settings.macroTrigger') }}<select v-model.number="form.macroTrigger"><option :value="0">{{ t('settings.disabled') }}</option><option :value="1">{{ t('settings.enabled') }}</option></select><button :disabled="busy || form.macroTrigger === state.macroTrigger" @click="apply('macroTrigger')">{{ t('settings.apply') }}</button></label>
      <label>{{ t('settings.capsLed') }}<select v-model.number="form.capslockLed"><option :value="0">{{ t('settings.capsOnly') }}</option><option :value="1">{{ t('settings.allKeys') }}</option></select><button :disabled="busy || form.capslockLed === state.capslockLed" @click="apply('capslockLed')">{{ t('settings.apply') }}</button></label>
      <label>{{ t('settings.backlight') }}<input v-model.number="form.backlightBrightness" type="range" min="1" max="10"><span>{{ form.backlightBrightness * 10 }}%</span><button :disabled="busy || form.backlightBrightness === state.backlightBrightness" @click="apply('backlightBrightness')">{{ t('settings.apply') }}</button></label>
      <label>{{ t('settings.autoSleep') }}<select v-model.number="form.ledHold"><option :value="0">{{ t('settings.disabled') }}</option><option :value="1">{{ t('settings.enabled') }}</option></select><button :disabled="busy || form.ledHold === state.ledHold" @click="apply('ledHold')">{{ t('settings.apply') }}</button></label>
      <label>Tap<select v-model.number="form.tapStatus"><option :value="0">{{ t('settings.disabled') }}</option><option :value="1">{{ t('settings.enabled') }}</option></select><button :disabled="busy || form.tapStatus === state.tapStatus" @click="apply('tapStatus')">{{ t('settings.apply') }}</button></label>
      <label>{{ t('settings.tapMode') }}<select v-model.number="form.tapActMode"><option :value="2">{{ t('settings.normal') }}</option><option :value="3">{{ t('settings.combo') }}</option></select><button :disabled="busy || form.tapActMode === state.tapActMode" @click="apply('tapActMode')">{{ t('settings.apply') }}</button></label>
      <label>{{ t('settings.tapTime') }}<input v-model.number="tapTimeoutMs" type="range" min="100" max="2000" step="10"><span>{{ tapTimeoutMs }} ms</span><button :disabled="busy || form.tapTimeoutValue === state.tapTimeoutValue" @click="apply('tapTimeoutValue')">{{ t('settings.apply') }}</button></label>
      <label v-if="capabilities?.sleepTimeout">{{ t('settings.sleepTime') }}<input v-model.number="form.sleepTimeoutRaw" type="number" min="10" max="3600"><span>{{ t('settings.seconds') }}</span><button :disabled="busy || form.sleepTimeoutRaw === state.sleepTimeoutRaw || form.sleepTimeoutRaw < 10 || form.sleepTimeoutRaw > 3600" @click="apply('sleepTimeoutRaw')">{{ t('settings.apply') }}</button></label>
      <label v-if="capabilities?.ledPowerMode && ledPowerMode">{{ t('settings.ledPower') }}<select v-model.number="form.ledPowerMode"><option :value="1">Low</option><option :value="2">High</option></select><button :disabled="busy || form.ledPowerMode === ledPowerMode.mode" @click="apply('ledPowerMode')">{{ t('settings.apply') }}</button></label>
    </div>
  </div>
</template>
