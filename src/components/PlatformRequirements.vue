<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { nixosUdevModule, standardLinuxUdevRules } from '../udev-rules.ts'

type Platform = 'linux' | 'windows' | 'macos'
const { t } = useI18n({ useScope: 'global' })
const agent = navigator.userAgent.toLowerCase()
const detected: Platform = agent.includes('win') ? 'windows' : agent.includes('mac') ? 'macos' : 'linux'
const selected = ref<Platform>(detected)
const linuxVariant = ref<'standard' | 'nixos'>('standard')
const copied = ref(false)
const linuxRule = standardLinuxUdevRules()
const nixosModule = nixosUdevModule()
const displayedRule = computed(() => linuxVariant.value === 'nixos' ? nixosModule : linuxRule)

async function copyRule(): Promise<void> {
  await navigator.clipboard.writeText(displayedRule.value)
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
      <div class="platform-tabs"><button class="secondary" :class="{ active: linuxVariant === 'standard' }" @click="linuxVariant = 'standard'">{{ t('requirements.standardLinux') }}</button><button class="secondary" :class="{ active: linuxVariant === 'nixos' }" @click="linuxVariant = 'nixos'">NixOS</button></div>
      <p>{{ linuxVariant === 'nixos' ? t('requirements.nixosIntro') : t('requirements.standardIntro') }}</p>
      <div class="code-heading"><strong>{{ linuxVariant === 'nixos' ? t('requirements.nixosTitle') : t('requirements.udevTitle') }}</strong><button class="secondary" @click="copyRule">{{ copied ? t('requirements.copied') : t('requirements.copy') }}</button></div>
      <pre><code>{{ displayedRule }}</code></pre>
      <ol v-if="linuxVariant === 'standard'"><li>{{ t('requirements.linuxStep1') }}</li><li>{{ t('requirements.linuxStep2') }}</li><li>{{ t('requirements.linuxStep3') }}</li></ol>
      <ol v-else><li>{{ t('requirements.nixosStep1') }}</li><li>{{ t('requirements.nixosStep2') }}</li><li>{{ t('requirements.linuxStep3') }}</li></ol>
    </div>
    <div v-else-if="selected === 'windows'" class="platform-guide"><p>{{ t('requirements.windowsHelp') }}</p></div>
    <div v-else class="platform-guide"><p>{{ t('requirements.macosHelp') }}</p></div>
  </section>
</template>
