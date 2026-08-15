<script setup lang="ts">
import { computed } from 'vue'
import { keyboardLayerRows, keycodeName, type KeyboardLayerResponse } from '../protocol/layout.ts'
import { bytesToHex, formatHex } from '../protocol/packet.ts'
const props = defineProps<{ layer: KeyboardLayerResponse }>()
const rows = computed(() => keyboardLayerRows(props.layer.data))
</script>

<template>
  <section class="card"><div class="section-heading"><h2>Layer {{ layer.layer }}</h2><span>{{ layer.data.byteLength }} keys · {{ layer.packetCount }} reports</span></div>
    <div class="keyboard-layout"><div v-for="(row, rowIndex) in rows" :key="rowIndex" class="key-row"><div v-for="(keycode, keyIndex) in row" :key="keyIndex" class="key"><strong>{{ keycodeName(keycode) }}</strong><small>{{ formatHex(keycode, 2) }}</small></div></div></div>
    <code class="layout-raw">{{ bytesToHex(layer.data) }}</code>
  </section>
</template>
