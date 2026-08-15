<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceCapabilities } from '../protocol/capabilities.ts'
import type { HardwareState } from '../protocol/hardware-state.ts'
import { describeHardwareState } from '../protocol/hardware-state.ts'
import type { LedPowerModeResponse } from '../protocol/led-power.ts'
import type { HardwareSettingKey } from '../protocol/settings-write.ts'
import SettingsEditor from './SettingsEditor.vue'
import { bytesToHex } from '../protocol/packet.ts'
import type { IndicatorColorResponse } from '../protocol/indicator-color.ts'

const props = defineProps<{ state: HardwareState | null; ledPowerMode: LedPowerModeResponse | null; indicatorColor: IndicatorColorResponse | null; capabilities: DeviceCapabilities | null; busy: boolean; hasBackup: boolean; hasColorBackup: boolean }>()
defineEmits<{ readState: []; readLedPowerMode: []; readIndicatorColor: []; applySetting: [key: HardwareSettingKey, value: number]; applyIndicatorColor: [hex: string]; restoreSettings: []; restoreIndicatorColor: [] }>()
const description = computed(() => props.state ? describeHardwareState(props.state, props.capabilities) : null)
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">READ-ONLY</p><h2>一般設定</h2></div><div class="actions"><button class="secondary" :disabled="busy" @click="$emit('readState')">讀取硬體狀態</button><button v-if="capabilities?.ledPowerMode" class="secondary" :disabled="busy" @click="$emit('readLedPowerMode')">讀取 LED 功率模式</button></div></div>
    <p v-if="!state" class="empty">尚未讀取鍵盤設定快照。</p>
    <template v-else>
      <dl v-if="description" class="settings-grid">
        <div><dt>資料格式</dt><dd>{{ state.format }} <small>raw</small></dd></div><div><dt>按鍵配置</dt><dd>{{ description.userLayout }} <small>{{ state.userLayout }}</small></dd></div>
        <div><dt>Magic Fn</dt><dd>{{ description.magicFn }} <small>{{ state.magicFn }}</small></dd></div><div><dt>巨集觸發</dt><dd>{{ description.macroTrigger }} <small>{{ state.macroTrigger }}</small></dd></div>
        <div><dt>CapsLock 燈效</dt><dd>{{ description.capslockLed }} <small>{{ state.capslockLed }}</small></dd></div><div><dt>指示燈亮度</dt><dd>{{ description.indicatorBrightness }} <small>{{ state.indicatorBrightness }}</small></dd></div>
        <div><dt>背光亮度</dt><dd>{{ description.backlightBrightness }} <small>{{ state.backlightBrightness }}</small></dd></div><div><dt>自動休眠</dt><dd>{{ description.ledHold }} <small>{{ state.ledHold }}</small></dd></div>
        <div><dt>Tap</dt><dd>{{ description.tapStatus }} <small>{{ state.tapStatus }}</small></dd></div><div><dt>Tap 模式</dt><dd>{{ description.tapActMode }} <small>{{ state.tapActMode }}</small></dd></div>
        <div><dt>Tap 判定時間</dt><dd>{{ description.tapTimeout }} <small>{{ state.tapTimeoutValue }}</small></dd></div><div><dt>休眠時間</dt><dd>{{ description.sleepTimeout }} <small>{{ state.sleepTimeoutRaw }}</small></dd></div>
      </dl>
      <code class="layout-raw">{{ bytesToHex(state.rawFrame) }}</code>
    </template>
    <p v-if="ledPowerMode" class="decoded">LED 功率模式：{{ ledPowerMode.modeName }}（raw {{ ledPowerMode.mode }}）· Frame {{ bytesToHex(ledPowerMode.rawFrame) }} · Ignored {{ ledPowerMode.trailingLength }} trailing bytes</p>
    <div v-if="capabilities?.capslockColor" class="settings-editor"><div class="section-heading"><div><h3>CapsLock 指示顏色</h3><p class="empty">新版 Anne Pro 2 使用 LED indicator color 命令控制 CapsLock 顏色。</p></div><button class="secondary" :disabled="busy" @click="$emit('readIndicatorColor')">讀取顏色</button></div><div v-if="indicatorColor" class="audio-controls"><input id="caps-color" type="color" :value="indicatorColor.hex" @change="$emit('applyIndicatorColor', ($event.target as HTMLInputElement).value)"><code>{{ indicatorColor.hex }} · {{ bytesToHex(indicatorColor.rawFrame) }}</code><button v-if="hasColorBackup" class="secondary" :disabled="busy" @click="$emit('restoreIndicatorColor')">復原原色</button></div></div>
    <SettingsEditor v-if="state" :state="state" :led-power-mode="ledPowerMode" :capabilities="capabilities" :busy="busy" :has-backup="hasBackup" @apply="(key, value) => $emit('applySetting', key, value)" @restore="$emit('restoreSettings')" />
  </section>
</template>
