import { describe, expect, it } from 'vitest'
import {
  OBINSKIT_AUDIO_INTERVAL_MS,
  OBINSKIT_RETRY_MS,
  OBINSKIT_TIMEOUT_MS,
  SETTINGS_AUTOSAVE_DELAY_MS,
} from '../src/protocol/timing.ts'

describe('bounded protocol timing', () => {
  it('matches the native HID watchdog thresholds', () => {
    expect(OBINSKIT_RETRY_MS).toBe(600)
    expect(OBINSKIT_TIMEOUT_MS).toBe(1200)
  })

  it('matches renderer audio pacing and keeps UI debounce separate', () => {
    expect(OBINSKIT_AUDIO_INTERVAL_MS).toBe(20)
    expect(SETTINGS_AUTOSAVE_DELAY_MS).toBe(350)
  })
})
