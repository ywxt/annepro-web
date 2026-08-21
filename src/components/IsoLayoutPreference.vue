<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

type IsoLayout = 'us' | 'da' | 'sv' | 'no'

const { t } = useI18n({ useScope: 'global' })
const choices: readonly { value: IsoLayout; label: string }[] = [
  { value: 'us', label: 'US' },
  { value: 'da', label: 'Danish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'no', label: 'Norwegian' },
]
const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem('iso')
const layout = ref<IsoLayout>(choices.some(choice => choice.value === saved) ? saved as IsoLayout : 'us')

function update(event: Event): void {
  layout.value = (event.target as HTMLSelectElement).value as IsoLayout
  localStorage.setItem('iso', layout.value)
}
</script>

<template>
  <div class="setting-cluster iso-layout-preference">
    <div class="cluster-heading"><span class="cluster-icon">Å</span><div><h3>{{ t('isoCharacter.title') }}</h3><p>{{ t('isoCharacter.help') }}</p></div></div>
    <div class="cluster-controls"><label><span class="setting-label">{{ t('isoCharacter.language') }}</span><select :value="layout" @change="update"><option v-for="choice in choices" :key="choice.value" :value="choice.value">{{ choice.label }}</option></select></label></div>
  </div>
</template>
