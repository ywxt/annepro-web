<script setup lang="ts">
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'
import SettingsEditor from './SettingsEditor.vue'
import type { IndicatorColorResponse } from '../protocol/indicator-color.ts'
import { useI18n } from 'vue-i18n'

defineProps<{ section: 'device' | 'keys' | 'lighting' | 'macros'; state: HardwareState | null; ledPowerMode: LedPowerModeResponse | null; indicatorColor: IndicatorColorResponse | null; capabilities: DeviceCapabilities | null; busy: boolean; hasBackup: boolean; hasColorBackup: boolean }>()
defineEmits<{ readState: []; readLedPowerMode: []; readIndicatorColor: []; applySettings: [changes: Array<{ key: HardwareSettingKey; value: number }>]; applyIndicatorColor: [hex: string]; restoreSettings: []; restoreIndicatorColor: [] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">READ · WRITE · VERIFIED</p><h2>{{ t(`settings.${section}Section`) }}</h2></div><div class="actions"><button class="secondary" :disabled="busy" @click="$emit('readState')">{{ t('settings.refresh') }}</button></div></div>
    <p v-if="!state" class="empty">{{ t('common.notRead') }}</p>
    <div v-if="section === 'lighting' && capabilities?.capslockColor" class="settings-editor"><div class="section-heading"><h3>{{ t('settings.capsColor') }}</h3><button class="secondary" :disabled="busy" @click="$emit('readIndicatorColor')">{{ t('settings.readColor') }}</button></div><div v-if="indicatorColor" class="audio-controls"><input id="caps-color" type="color" :value="indicatorColor.hex" @change="$emit('applyIndicatorColor', ($event.target as HTMLInputElement).value)"><code>{{ indicatorColor.hex }}</code><button v-if="hasColorBackup" class="secondary" :disabled="busy" @click="$emit('restoreIndicatorColor')">{{ t('settings.restoreColor') }}</button></div></div>
    <SettingsEditor v-if="state" :section="section" :state="state" :led-power-mode="ledPowerMode" :capabilities="capabilities" :busy="busy" :has-backup="hasBackup" @apply="changes => $emit('applySettings', changes)" @restore="$emit('restoreSettings')" />
  </section>
</template>
