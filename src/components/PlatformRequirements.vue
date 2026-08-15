<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

type Platform = 'linux' | 'windows' | 'macos'
const { t } = useI18n({ useScope: 'global' })
const agent = navigator.userAgent.toLowerCase()
const detected: Platform = agent.includes('win') ? 'windows' : agent.includes('mac') ? 'macos' : 'linux'
const selected = ref<Platform>(detected)
const copied = ref(false)
const linuxRule = `# Anne Pro 2 WebHID access — one rule per product ID
KERNEL=="hidraw*", ATTRS{idVendor}=="04d9", ATTRS{idProduct}=="a293", TAG+="uaccess"
KERNEL=="hidraw*", ATTRS{idVendor}=="04d9", ATTRS{idProduct}=="a292", TAG+="uaccess"
KERNEL=="hidraw*", ATTRS{idVendor}=="04d9", ATTRS{idProduct}=="8008", TAG+="uaccess"
KERNEL=="hidraw*", ATTRS{idVendor}=="04d9", ATTRS{idProduct}=="8009", TAG+="uaccess"`

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
      <aside class="warning"><strong>{{ t('requirements.duplicateTitle') }}</strong><p>{{ t('requirements.duplicateHelp') }}</p><code>sudoedit /etc/udev/rules.d/obinskit-kdb.rules</code></aside>
      <p class="source-note">{{ t('requirements.linuxEvidence') }} <a href="https://www.spinics.net/lists/linux-input/msg67824.html" target="_blank" rel="noreferrer">Linux HID patch</a> · <a href="https://askubuntu.com/questions/1261721/keyboard-periodically-stops-working-in-ubuntu-20-04" target="_blank" rel="noreferrer">community report</a></p>
    </div>
    <div v-else-if="selected === 'windows'" class="platform-guide"><p>{{ t('requirements.windowsHelp') }}</p></div>
    <div v-else class="platform-guide"><p>{{ t('requirements.macosHelp') }}</p></div>
  </section>
</template>
