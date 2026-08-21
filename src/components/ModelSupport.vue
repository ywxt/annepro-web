<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getObinsModel, OBINS_MODELS } from '../device-registry.ts'

const props = defineProps<{ modelId: number }>()
const { t } = useI18n({ useScope: 'global' })
const current = computed(() => getObinsModel(props.modelId))
</script>

<template>
  <section class="model-support">
    <div class="model-support-heading"><div><p class="eyebrow">MODEL PROFILE</p><h2>{{ t('models.title') }}</h2></div><span class="support-stage">{{ t('models.identify') }}</span></div>
    <p>{{ t('models.help', { model: current?.family ?? t('device.unavailable') }) }}</p>
    <ol class="profile-steps"><li><strong>{{ t('models.stepMetadata') }}</strong><span>{{ t('models.stepMetadataHelp') }}</span></li><li><strong>{{ t('models.stepRead') }}</strong><span>{{ t('models.stepReadHelp') }}</span></li><li><strong>{{ t('models.stepWrite') }}</strong><span>{{ t('models.stepWriteHelp') }}</span></li></ol>
    <details class="model-list"><summary>{{ t('models.showAll') }}</summary><div class="model-list-rows"><div v-for="model in OBINS_MODELS" :key="model.id" :class="{ current: model.id === modelId }"><code>{{ model.id }}</code><span><strong>{{ model.family }}</strong><small>{{ model.name }}<template v-if="model.traits.length"> · {{ model.traits.join(' · ') }}</template></small></span><em>{{ model.profile === 'anne-pro-2' ? t('models.full') : t('models.identify') }}</em></div></div></details>
  </section>
</template>
