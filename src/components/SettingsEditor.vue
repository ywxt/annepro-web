<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'

const props = defineProps<{ state: HardwareState; ledPowerMode: LedPowerModeResponse | null; capabilities: DeviceCapabilities | null; busy: boolean; hasBackup: boolean }>()
const emit = defineEmits<{ apply: [key: HardwareSettingKey, value: number]; restore: [] }>()
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
    <div class="section-heading"><div><p class="eyebrow">WRITE · VERIFIED</p><h3>修改一般設定</h3></div><button v-if="hasBackup" class="secondary" :disabled="busy" @click="$emit('restore')">復原寫入前快照</button></div>
    <p class="empty">每次只寫一個欄位，成功後立即回讀驗證。首次寫入會保留完整設定快照。</p>
    <div class="control-grid">
      <label>按鍵配置<select v-model.number="form.userLayout"><option :value="0">預設配置</option><option :value="1">使用者配置</option></select><button :disabled="busy || form.userLayout === state.userLayout" @click="apply('userLayout')">套用</button></label>
      <label>Magic Fn<select v-model.number="form.magicFn"><option :value="0">停用</option><option :value="1">Fn1</option><option :value="2">Fn2</option></select><button :disabled="busy || form.magicFn === state.magicFn" @click="apply('magicFn')">套用</button></label>
      <label>巨集觸發<select v-model.number="form.macroTrigger"><option :value="0">停用</option><option :value="1">啟用</option></select><button :disabled="busy || form.macroTrigger === state.macroTrigger" @click="apply('macroTrigger')">套用</button></label>
      <label>CapsLock 燈效<select v-model.number="form.capslockLed"><option :value="0">僅 CapsLock 鍵</option><option :value="1">所有按鍵</option></select><button :disabled="busy || form.capslockLed === state.capslockLed" @click="apply('capslockLed')">套用</button></label>
      <label>背光亮度<input v-model.number="form.backlightBrightness" type="range" min="1" max="10"><span>{{ form.backlightBrightness * 10 }}%</span><button :disabled="busy || form.backlightBrightness === state.backlightBrightness" @click="apply('backlightBrightness')">套用</button></label>
      <label>自動休眠<select v-model.number="form.ledHold"><option :value="0">停用</option><option :value="1">啟用</option></select><button :disabled="busy || form.ledHold === state.ledHold" @click="apply('ledHold')">套用</button></label>
      <label>Tap<select v-model.number="form.tapStatus"><option :value="0">停用</option><option :value="1">啟用</option></select><button :disabled="busy || form.tapStatus === state.tapStatus" @click="apply('tapStatus')">套用</button></label>
      <label>Tap 模式<select v-model.number="form.tapActMode"><option :value="2">一般模式</option><option :value="3">組合模式</option></select><button :disabled="busy || form.tapActMode === state.tapActMode" @click="apply('tapActMode')">套用</button></label>
      <label>Tap 判定時間<input v-model.number="tapTimeoutMs" type="range" min="100" max="2000" step="10"><span>{{ tapTimeoutMs }} ms</span><button :disabled="busy || form.tapTimeoutValue === state.tapTimeoutValue" @click="apply('tapTimeoutValue')">套用</button></label>
      <label v-if="capabilities?.sleepTimeout">休眠時間<input v-model.number="form.sleepTimeoutRaw" type="number" min="10" max="3600"><span>秒</span><button :disabled="busy || form.sleepTimeoutRaw === state.sleepTimeoutRaw || form.sleepTimeoutRaw < 10 || form.sleepTimeoutRaw > 3600" @click="apply('sleepTimeoutRaw')">套用</button></label>
      <label v-if="capabilities?.ledPowerMode && ledPowerMode">LED 功率<select v-model.number="form.ledPowerMode"><option :value="1">Low</option><option :value="2">High</option></select><button :disabled="busy || form.ledPowerMode === ledPowerMode.mode" @click="apply('ledPowerMode')">套用</button></label>
    </div>
  </div>
</template>
