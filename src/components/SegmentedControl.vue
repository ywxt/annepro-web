<script setup lang="ts">
defineProps<{ modelValue: number; options: Array<{ value: number; label: string; icon?: string }> }>()
defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<template>
  <div class="segmented-control">
    <button v-for="option in options" :key="option.value" type="button" :class="{ active: modelValue === option.value }" @click="$emit('update:modelValue', option.value)"><span v-if="option.icon" aria-hidden="true">{{ option.icon }}</span>{{ option.label }}</button>
  </div>
</template>
