<script setup lang="ts">
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'
import SettingsEditor from './SettingsEditor.vue'
import OptionHint from './OptionHint.vue'
import type { IndicatorColorResponse } from '../protocol/indicator-color.ts'
import { useI18n } from 'vue-i18n'
import IsoLayoutPreference from './IsoLayoutPreference.vue'

defineProps<{ section: 'device' | 'keys' | 'lighting' | 'macros'; state: HardwareState | null; ledPowerMode: LedPowerModeResponse | null; indicatorColor: IndicatorColorResponse | null; capabilities: DeviceCapabilities | null; busy: boolean; hasBackup: boolean; hasColorBackup: boolean; macroAvailable?: boolean }>()
defineEmits<{ readState: []; readLedPowerMode: []; readIndicatorColor: []; applySettings: [changes: Array<{ key: HardwareSettingKey; value: number }>]; applyIndicatorColor: [hex: string]; restoreSettings: []; restoreIndicatorColor: [] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section v-if="section !== 'device' || capabilities?.hasBattery" class="card">
    <div class="section-heading"><div><p class="eyebrow">READ · WRITE · VERIFIED</p><h2>{{ t(`settings.${section}Section`) }}</h2></div><div class="actions"><button class="secondary" :disabled="busy" @click="$emit('readState')">{{ t('settings.refresh') }}</button></div></div>
    <p v-if="!state" class="empty">{{ t('common.notRead') }}</p>
    <IsoLayoutPreference v-if="section === 'keys' && capabilities?.isoCharacterLayout" />
    <SettingsEditor v-if="state" :section="section" :state="state" :led-power-mode="ledPowerMode" :capabilities="capabilities" :busy="busy" :has-backup="hasBackup" :macro-available="macroAvailable" @apply="changes => $emit('applySettings', changes)" @restore="$emit('restoreSettings')">
      <template v-if="section === 'lighting' && capabilities?.capslockColor" #caps-color>
        <label class="caps-color-row"><span class="setting-label">{{ t('settings.capsColor') }}<OptionHint :text="t('settings.capsColorHelp')" /></span><span v-if="indicatorColor" class="caps-color-control"><input id="caps-color" type="color" :value="indicatorColor.hex" @change="$emit('applyIndicatorColor', ($event.target as HTMLInputElement).value)"><code>{{ indicatorColor.hex }}</code><button v-if="hasColorBackup" class="text-action" :disabled="busy" @click.prevent="$emit('restoreIndicatorColor')">{{ t('settings.restoreColor') }}</button></span><button v-else class="text-action" :disabled="busy" @click.prevent="$emit('readIndicatorColor')">{{ t('settings.readColor') }}</button></label>
      </template>
    </SettingsEditor>
  </section>
</template>
