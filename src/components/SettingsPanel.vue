<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'
import SettingsEditor from './SettingsEditor.vue'
import { bytesToHex } from '../protocol/packet.ts'
import type { IndicatorColorResponse } from '../protocol/indicator-color.ts'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ state: HardwareState | null; ledPowerMode: LedPowerModeResponse | null; indicatorColor: IndicatorColorResponse | null; capabilities: DeviceCapabilities | null; busy: boolean; hasBackup: boolean; hasColorBackup: boolean }>()
defineEmits<{ readState: []; readLedPowerMode: []; readIndicatorColor: []; applySetting: [key: HardwareSettingKey, value: number]; applyIndicatorColor: [hex: string]; restoreSettings: []; restoreIndicatorColor: [] }>()
const { t } = useI18n()
function binary(value: number): string { return value >= 1 ? t('settings.enabled') : t('settings.disabled') }
function option(value: number, values: Record<number, string>): string { return values[value] ?? t('settings.unknown', { value }) }
const description = computed(() => props.state ? {
  userLayout: option(props.state.userLayout, { 0: t('settings.defaultLayout'), 1: t('settings.userLayout') }),
  magicFn: option(props.state.magicFn, { 0: t('settings.disabled'), 1: 'Fn1', 2: 'Fn2' }),
  macroTrigger: binary(props.state.macroTrigger), capslockLed: option(props.state.capslockLed, { 0: t('settings.capsOnly'), 1: t('settings.allKeys') }),
  indicatorBrightness: props.capabilities?.hasIndicatorLed === false ? t('settings.unsupportedValue', { value: props.state.indicatorBrightness }) : `${props.state.indicatorBrightness * 10}%`,
  backlightBrightness: `${props.state.backlightBrightness * 10}%`, ledHold: binary(props.state.ledHold), tapStatus: binary(props.state.tapStatus),
  tapActMode: option(props.state.tapActMode, { 2: t('settings.normal'), 3: t('settings.combo') }), tapTimeout: `${props.state.tapTimeoutValue * 10} ms`,
  sleepTimeout: `${props.state.sleepTimeoutRaw} ${t('settings.seconds')}${props.state.ledHold === 0 ? ` (${t('settings.inactive')})` : ''}`,
} : null)
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">READ · WRITE · VERIFIED</p><h2>{{ t('settings.title') }}</h2></div><div class="actions"><button class="secondary" :disabled="busy" @click="$emit('readState')">{{ t('settings.refresh') }}</button></div></div>
    <p v-if="!state" class="empty">{{ t('common.notRead') }}</p>
    <template v-else>
      <dl v-if="description" class="settings-grid">
        <div><dt>{{ t('settings.format') }}</dt><dd>{{ state.format }}</dd></div><div><dt>{{ t('settings.layout') }}</dt><dd>{{ description.userLayout }}</dd></div>
        <div><dt>Magic Fn</dt><dd>{{ description.magicFn }}</dd></div><div><dt>{{ t('settings.macroTrigger') }}</dt><dd>{{ description.macroTrigger }}</dd></div>
        <div><dt>{{ t('settings.capsLed') }}</dt><dd>{{ description.capslockLed }}</dd></div><div><dt>{{ t('settings.indicatorBrightness') }}</dt><dd>{{ description.indicatorBrightness }}</dd></div>
        <div><dt>{{ t('settings.backlight') }}</dt><dd>{{ description.backlightBrightness }}</dd></div><div><dt>{{ t('settings.autoSleep') }}</dt><dd>{{ description.ledHold }}</dd></div>
        <div><dt>Tap</dt><dd>{{ description.tapStatus }}</dd></div><div><dt>{{ t('settings.tapMode') }}</dt><dd>{{ description.tapActMode }}</dd></div>
        <div><dt>{{ t('settings.tapTime') }}</dt><dd>{{ description.tapTimeout }}</dd></div><div><dt>{{ t('settings.sleepTime') }}</dt><dd>{{ description.sleepTimeout }}</dd></div>
      </dl>
      <details class="raw-details"><summary>{{ t('settings.raw') }}</summary><code class="layout-raw">{{ bytesToHex(state.rawFrame) }}</code></details>
    </template>
    <div v-if="capabilities?.capslockColor" class="settings-editor"><div class="section-heading"><h3>{{ t('settings.capsColor') }}</h3><button class="secondary" :disabled="busy" @click="$emit('readIndicatorColor')">{{ t('settings.readColor') }}</button></div><div v-if="indicatorColor" class="audio-controls"><input id="caps-color" type="color" :value="indicatorColor.hex" @change="$emit('applyIndicatorColor', ($event.target as HTMLInputElement).value)"><code>{{ indicatorColor.hex }}</code><button v-if="hasColorBackup" class="secondary" :disabled="busy" @click="$emit('restoreIndicatorColor')">{{ t('settings.restoreColor') }}</button></div></div>
    <SettingsEditor v-if="state" :state="state" :led-power-mode="ledPowerMode" :capabilities="capabilities" :busy="busy" :has-backup="hasBackup" @apply="(key, value) => $emit('applySetting', key, value)" @restore="$emit('restoreSettings')" />
  </section>
</template>
