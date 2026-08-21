<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <span class="option-hint">
    <button type="button" class="option-hint-trigger" :aria-label="text">?</button>
    <span class="option-hint-popup" role="tooltip">{{ text }}</span>
  </span>
</template>
