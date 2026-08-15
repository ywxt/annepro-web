<script setup lang="ts">
import type { HardwareState } from '../protocol/hardware-state.ts'
import { bytesToHex } from '../protocol/packet.ts'

defineProps<{ state: HardwareState | null; busy: boolean }>()
defineEmits<{ readState: [] }>()
</script>

<template>
  <section class="card">
    <div class="section-heading"><div><p class="eyebrow">READ-ONLY</p><h2>一般設定</h2></div><button class="secondary" :disabled="busy" @click="$emit('readState')">讀取硬體狀態</button></div>
    <p v-if="!state" class="empty">尚未讀取鍵盤設定快照。</p>
    <template v-else>
      <dl class="settings-grid">
        <div><dt>Format</dt><dd>{{ state.format }}</dd></div><div><dt>User layout</dt><dd>{{ state.userLayout }}</dd></div>
        <div><dt>Magic Fn</dt><dd>{{ state.magicFn }}</dd></div><div><dt>Macro trigger</dt><dd>{{ state.macroTrigger }}</dd></div>
        <div><dt>CapsLock LED</dt><dd>{{ state.capslockLed }}</dd></div><div><dt>Indicator brightness</dt><dd>{{ state.indicatorBrightness }}</dd></div>
        <div><dt>Backlight brightness</dt><dd>{{ state.backlightBrightness }}</dd></div><div><dt>LED hold</dt><dd>{{ state.ledHold }}</dd></div>
        <div><dt>Tap enabled</dt><dd>{{ state.tapStatus }}</dd></div><div><dt>Tap mode</dt><dd>{{ state.tapActMode }}</dd></div>
        <div><dt>Tap timeout</dt><dd>{{ state.tapTimeoutValue }}</dd></div><div><dt>Sleep timeout (raw)</dt><dd>{{ state.sleepTimeoutRaw }}</dd></div>
      </dl>
      <code class="layout-raw">{{ bytesToHex(state.rawFrame) }}</code>
    </template>
  </section>
</template>
