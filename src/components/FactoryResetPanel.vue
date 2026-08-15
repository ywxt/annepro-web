<script setup lang="ts">
defineProps<{ busy: boolean; ready: boolean }>()
defineEmits<{ reset: [] }>()
</script>

<template>
  <section class="card factory-reset"><div><p class="eyebrow">DESTRUCTIVE · NON-FIRMWARE</p><h2>恢復 ObinsKit 原廠設定</h2><p class="empty">重設一般設定、清空巨集、安裝 ObinsKit 1.2.11 的 14 個 Anne Pro 2 原廠燈效，並清除 BLE 配對。不切換 IAP、不修改 firmware 或 flash memory。鍵位資料保留，但切回預設配置。</p></div><button class="danger" :disabled="busy || !ready" @click="$emit('reset')">恢復原廠設定</button></section>
</template>
