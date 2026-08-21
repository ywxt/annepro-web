<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SegmentedControl from './SegmentedControl.vue'

const { t } = useI18n({ useScope: 'global' })
const pressed = ref(new Set<string>())
const history = ref<string[]>([])
const focused = ref(false)
const platform = ref(0)

const commonRows = [
  [['AudioVolumeMute', 'AudioVolumeDown', 'AudioVolumeUp', 'MediaPlayPause']],
  [['Escape'], ['F1', 'F2', 'F3', 'F4'], ['F5', 'F6', 'F7', 'F8'], ['F9', 'F10', 'F11', 'F12'], ['PrintScreen', 'ScrollLock', 'Pause']],
  [['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'], ['Insert', 'Home', 'PageUp'], ['NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract']],
  [['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'], ['Delete', 'End', 'PageDown'], ['Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd']],
  [['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'], [], ['Numpad4', 'Numpad5', 'Numpad6']],
  [['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'], ['ArrowUp'], ['Numpad1', 'Numpad2', 'Numpad3', 'NumpadEnter']],
]
const rows = computed(() => [
  ...commonRows,
  platform.value === 1
    ? [['ControlLeft', 'AltLeft', 'MetaLeft', 'Space', 'MetaRight', 'AltRight', 'Fn'], ['ArrowLeft', 'ArrowDown', 'ArrowRight'], ['Numpad0', 'NumpadDecimal']]
    : [['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'MetaRight', 'ContextMenu', 'ControlRight'], ['ArrowLeft', 'ArrowDown', 'ArrowRight'], ['Numpad0', 'NumpadDecimal']],
])

const labels: Record<string, string> = {
  Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', Backslash: '\\', CapsLock: 'Caps',
  Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  MetaLeft: 'Win', AltLeft: 'Alt', AltRight: 'Alt', Space: 'Space', Fn: 'Fn', Minus: '−', Equal: '=',
  BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  Backquote: '`', MetaRight: 'Win', ContextMenu: 'Menu', PrintScreen: 'PrtSc', ScrollLock: 'ScrLk',
  Pause: 'Pause', Insert: 'Ins', Delete: 'Del', PageUp: 'PgUp', PageDown: 'PgDn', NumLock: 'Num',
  NumpadDivide: '÷', NumpadMultiply: '×', NumpadSubtract: '−', NumpadAdd: '+', NumpadEnter: 'Enter',
  NumpadDecimal: '.', AudioVolumeMute: '🔇', AudioVolumeDown: '🔉', AudioVolumeUp: '🔊', MediaPlayPause: '▶',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
}

const count = computed(() => pressed.value.size)
function label(code: string): string {
  const numpadDigit = /^Numpad([0-9])$/.exec(code)
  if (platform.value === 1) {
    if (code.startsWith('Meta')) return '⌘'
    if (code.startsWith('Alt')) return '⌥'
    if (code.startsWith('Control')) return '⌃'
  }
  return labels[code] ?? numpadDigit?.[1] ?? code.replace(/^(Key|Digit)/, '')
}
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
      <div class="tester-heading-actions"><SegmentedControl v-model="platform" :options="[{ value: 0, label: t('tester.windows'), icon: '⊞' }, { value: 1, label: t('tester.mac'), icon: '⌘' }]" /><button class="secondary compact" @click="clear">{{ t('tester.clear') }}</button></div>
    </div>
    <div class="tester-stats"><span>{{ t('tester.pressed', { count }) }}</span><span>{{ history.map(label).join(' · ') || '—' }}</span></div>
    <div class="tester-board" :class="{ focused, mac: platform === 1 }" tabindex="0" @focus="focused = true" @blur="blur" @click="($event.currentTarget as HTMLElement).focus()">
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="tester-row">
        <div v-for="(group, groupIndex) in row" :key="groupIndex" class="tester-key-group">
          <div v-for="code in group" :key="code" class="tester-key" :class="[{ pressed: pressed.has(code) }, `code-${code}`]" :title="code">{{ label(code) }}</div>
        </div>
      </div>
      <p v-if="!focused" class="tester-overlay">{{ t('tester.focus') }}</p>
    </div>
    <p class="tester-note">{{ t('tester.note') }}</p>
  </section>
</template>
