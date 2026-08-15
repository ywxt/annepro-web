<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setAppLocale, type AppLocale } from '../i18n.ts'

const { locale, t } = useI18n()
function change(event: Event): void { setAppLocale((event.target as HTMLSelectElement).value as AppLocale) }
</script>

<template>
  <label class="language-switcher">{{ t('locale.label') }}
    <select :value="locale" @change="change"><option value="zh-TW">{{ t('locale.zh') }}</option><option value="en">{{ t('locale.en') }}</option></select>
  </label>
</template>
