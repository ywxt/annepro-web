<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { appLocale, setAppLocale, type AppLocale } from '../i18n.ts'

const { t } = useI18n({ useScope: 'global' })
function change(event: Event): void {
  const next = (event.target as HTMLSelectElement).value as AppLocale
  setAppLocale(next)
}
</script>

<template>
  <label class="language-switcher">{{ t('locale.label') }}
    <select :value="appLocale" @change="change"><option value="zh-TW">{{ t('locale.zh') }}</option><option value="en">{{ t('locale.en') }}</option></select>
  </label>
</template>
