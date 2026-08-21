<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })
const pressed = ref(new Set<string>())
const history = ref<string[]>([])
const focused = ref(false)

const rows = [
  ['Escape', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
  ['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'Fn', 'ControlRight'],
]

const labels: Record<string, string> = {
  Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', Backslash: '\\', CapsLock: 'Caps',
  Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  MetaLeft: 'Win', AltLeft: 'Alt', AltRight: 'Alt', Space: 'Space', Fn: 'Fn', Minus: '−', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
}

const count = computed(() => pressed.value.size)
function label(code: string): string { return labels[code] ?? code.replace(/^(Key|Digit)/, '') }
function update(code: string, down: boolean): void {
  if (!focused.value || code === 'Fn') return
  const next = new Set(pressed.value)
  if (down) {
    next.add(code)
    if (!history.value.includes(code)) history.value = [code, ...history.value].slice(0, 12)
  } else next.delete(code)
  pressed.value = next
}
function onKeyDown(event: KeyboardEvent): void { event.preventDefault(); update(event.code, true) }
function onKeyUp(event: KeyboardEvent): void { event.preventDefault(); update(event.code, false) }
function clear(): void { pressed.value = new Set(); history.value = [] }
function blur(): void { focused.value = false; pressed.value = new Set() }

onMounted(() => { window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) })
</script>

<template>
  <section class="card key-tester">
    <div class="section-heading">
      <div><p class="eyebrow">KEY TESTER</p><h2>{{ t('tester.title') }}</h2><p class="empty">{{ t('tester.help') }}</p></div>
      <button class="secondary compact" @click="clear">{{ t('tester.clear') }}</button>
    </div>
    <div class="tester-stats"><span>{{ t('tester.pressed', { count }) }}</span><span>{{ history.map(label).join(' · ') || '—' }}</span></div>
    <div class="tester-board" :class="{ focused }" tabindex="0" @focus="focused = true" @blur="blur" @click="($event.currentTarget as HTMLElement).focus()">
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="tester-row">
        <div v-for="code in row" :key="code" class="tester-key" :class="[{ pressed: pressed.has(code) }, `code-${code}`]">{{ label(code) }}</div>
      </div>
      <p v-if="!focused" class="tester-overlay">{{ t('tester.focus') }}</p>
    </div>
    <p class="tester-note">{{ t('tester.note') }}</p>
  </section>
</template>
