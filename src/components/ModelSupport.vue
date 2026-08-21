<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getObinsModel, OBINS_MODELS } from '../device-registry.ts'
import type { DeviceCapabilities } from '../protocol/capabilities.ts'

const props = defineProps<{ modelId: number; capabilities: DeviceCapabilities }>()
const { t } = useI18n({ useScope: 'global' })
const current = computed(() => getObinsModel(props.modelId))
const available = computed(() => [
  ['keys', props.capabilities.keyboardLayers],
  ['lighting', props.capabilities.hasLed === true],
  ['battery', props.capabilities.hasBattery === true],
  ['indicator', props.capabilities.indicatorLocation === true],
  ['oled', props.capabilities.oled === true],
].filter((entry): entry is [string, true] => entry[1] === true))
const partial = computed(() => available.value.length > 0)
</script>

<template>
  <section class="model-support">
    <div class="model-support-heading"><div><p class="eyebrow">MODEL PROFILE</p><h2>{{ t('models.title') }}</h2></div><span class="support-stage" :class="{ partial }">{{ t(partial ? 'models.partial' : 'models.identify') }}</span></div>
    <p>{{ t(partial ? 'models.partialHelp' : 'models.help', { model: current?.family ?? t('device.unavailable') }) }}</p>
    <div v-if="partial" class="model-capabilities"><span v-for="[feature] in available" :key="feature">✓ {{ t(`models.feature.${feature}`) }}</span></div>
    <ol class="profile-steps"><li><strong>{{ t('models.stepMetadata') }}</strong><span>{{ t('models.stepMetadataHelp') }}</span></li><li><strong>{{ t('models.stepRead') }}</strong><span>{{ t('models.stepReadHelp') }}</span></li><li><strong>{{ t('models.stepWrite') }}</strong><span>{{ t('models.stepWriteHelp') }}</span></li></ol>
    <details class="model-list"><summary>{{ t('models.showAll') }}</summary><div class="model-list-rows"><div v-for="model in OBINS_MODELS" :key="model.id" :class="{ current: model.id === modelId }"><code>{{ model.id }}</code><span><strong>{{ model.family }}</strong><small>{{ model.name }}<template v-if="model.traits.length"> · {{ model.traits.join(' · ') }}</template></small></span><em>{{ model.profile === 'anne-pro-2' ? t('models.full') : model.id === modelId ? t('models.partial') : t('models.modelled') }}</em></div></div></details>
  </section>
</template>
