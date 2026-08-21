<script setup lang="ts">
const props = defineProps<{ modelValue: number; offLabel: string; onLabel: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
function toggle(): void { if (!props.disabled) emit('update:modelValue', props.modelValue === 0 ? 1 : 0) }
</script>

<template>
  <button type="button" class="toggle-switch" :class="{ on: modelValue !== 0 }" role="switch" :aria-checked="modelValue !== 0" :disabled="disabled" @click="toggle">
    <span class="toggle-track"><span class="toggle-thumb"></span></span>
    <span>{{ modelValue === 0 ? offLabel : onLabel }}</span>
  </button>
</template>
