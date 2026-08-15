<script setup lang="ts">
import type { AudioVisualizeMode } from '../protocol/audio-visualize.ts'
defineProps<{ running: boolean; mode: AudioVisualizeMode; color: string; busy: boolean; frames: number }>()
defineEmits<{ start: []; stop: []; updateMode: [mode: AudioVisualizeMode]; updateColor: [color: string] }>()
</script>

<template>
  <section class="card"><div class="section-heading"><div><p class="eyebrow">TRANSIENT · 20 FPS MAX</p><h2>Audio Visualize</h2></div><div class="actions"><button v-if="!running" :disabled="busy" @click="$emit('start')">開始麥克風燈效</button><button v-else class="danger" @click="$emit('stop')">停止並恢復燈效</button></div></div>
    <p class="empty">音訊只在瀏覽器內分析，不錄製或上傳。每次開始都需要瀏覽器麥克風權限；停止、斷線或離開頁面時會關閉音軌。</p>
    <div class="audio-controls"><label>模式 <select :value="mode" :disabled="running" @change="$emit('updateMode', ($event.target as HTMLSelectElement).value as AudioVisualizeMode)"><option value="pure">Pure</option><option value="colorful">Colorful spectrum</option></select></label><label v-if="mode === 'pure'">顏色 <input type="color" :value="color" :disabled="running" @input="$emit('updateColor', ($event.target as HTMLInputElement).value)"></label><span>{{ running ? `運行中 · ${frames} frames` : '已停止' }}</span></div>
  </section>
</template>
