<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { OBINS_USB_DEVICES } from '../device-registry.ts'

type Platform = 'linux' | 'windows' | 'macos'
const { t } = useI18n({ useScope: 'global' })
const agent = navigator.userAgent.toLowerCase()
const detected: Platform = agent.includes('win') ? 'windows' : agent.includes('mac') ? 'macos' : 'linux'
const selected = ref<Platform>(detected)
const copied = ref(false)
const linuxRule = ['# ObinsLab keyboard WebHID access — exact known VID/PID pairs', ...OBINS_USB_DEVICES.map(({ vendorId, productId, family }) =>
  `# ${family} (${vendorId.toString(16).padStart(4, '0')}:${productId.toString(16).padStart(4, '0')})\nKERNEL=="hidraw*", ATTRS{idVendor}=="${vendorId.toString(16).padStart(4, '0')}", ATTRS{idProduct}=="${productId.toString(16).padStart(4, '0')}", TAG+="uaccess"`,
)].join('\n')

async function copyRule(): Promise<void> {
  await navigator.clipboard.writeText(linuxRule)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1500)
}
</script>

<template>
  <section class="card requirements">
    <div class="section-heading"><div><p class="eyebrow">{{ t('requirements.eyebrow') }}</p><h2>{{ t('requirements.title') }}</h2></div><div class="platform-tabs"><button v-for="platform in (['linux', 'windows', 'macos'] as const)" :key="platform" class="secondary" :class="{ active: selected === platform }" @click="selected = platform">{{ t(`requirements.${platform}`) }}</button></div></div>
    <p>{{ t('requirements.common') }}</p>
    <div v-if="selected === 'linux'" class="platform-guide">
      <p>{{ t('requirements.linuxIntro') }}</p>
      <div class="code-heading"><strong>{{ t('requirements.udevTitle') }}</strong><button class="secondary" @click="copyRule">{{ copied ? t('requirements.copied') : t('requirements.copy') }}</button></div>
      <pre><code>{{ linuxRule }}</code></pre>
      <ol><li>{{ t('requirements.linuxStep1') }}</li><li>{{ t('requirements.linuxStep2') }}</li><li>{{ t('requirements.linuxStep3') }}</li></ol>
    </div>
    <div v-else-if="selected === 'windows'" class="platform-guide"><p>{{ t('requirements.windowsHelp') }}</p></div>
    <div v-else class="platform-guide"><p>{{ t('requirements.macosHelp') }}</p></div>
  </section>
</template>
