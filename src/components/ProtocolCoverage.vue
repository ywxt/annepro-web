<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n({ useScope: 'global' })
const groups = [
  { state: 'ready', title: 'coverage.ready', items: 'coverage.readyItems' },
  { state: 'gated', title: 'coverage.gated', items: 'coverage.gatedItems' },
  { state: 'blocked', title: 'coverage.blocked', items: 'coverage.blockedItems' },
] as const
</script>

<template>
  <section class="card protocol-coverage">
    <div class="section-heading"><div><p class="eyebrow">PROTOCOL MATRIX</p><h2>{{ t('coverage.title') }}</h2><p class="empty">{{ t('coverage.help') }}</p></div></div>
    <div class="coverage-grid">
      <article v-for="group in groups" :key="group.state" :class="['coverage-item', group.state]">
        <span class="coverage-state">{{ t(group.title) }}</span><p>{{ t(group.items) }}</p>
      </article>
    </div>
  </section>
</template>
