<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ busy: boolean; ready: boolean }>()
defineEmits<{ reset: [] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section class="card factory-reset"><div><p class="eyebrow">DESTRUCTIVE · NON-FIRMWARE</p><h2>{{ t('factory.title') }}</h2><p class="empty">{{ t('factory.help') }}</p></div><button class="danger" :disabled="busy || !ready" @click="$emit('reset')">{{ t('factory.action') }}</button></section>
</template>
