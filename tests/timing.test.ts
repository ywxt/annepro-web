import { describe, expect, it } from 'vitest'
import {
  AUDIO_TIMEOUT_MS,
  INTER_LAYER_DELAY_MS,
  LAYOUT_ACTIVATION_DELAY_MS,
  LAYOUT_TRANSACTION_TIMEOUT_MS,
  MACRO_TIMEOUT_MS,
  MULTIPART_TIMEOUT_MS,
  OBINSKIT_TIMEOUT_MS,
  SETTINGS_AUTOSAVE_DELAY_MS,
} from '../src/protocol/timing.ts'

describe('bounded protocol timing', () => {
  it('keeps slower multipart transactions above ordinary reads', () => {
    expect(OBINSKIT_TIMEOUT_MS).toBe(1500)
    expect(MULTIPART_TIMEOUT_MS).toBeGreaterThan(OBINSKIT_TIMEOUT_MS)
    expect(MACRO_TIMEOUT_MS).toBeGreaterThanOrEqual(MULTIPART_TIMEOUT_MS)
    expect(LAYOUT_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(MACRO_TIMEOUT_MS)
  })

  it('retains the physically verified layout pacing and bounded audio timeout', () => {
    expect(INTER_LAYER_DELAY_MS).toBe(20)
    expect(LAYOUT_ACTIVATION_DELAY_MS).toBe(150)
    expect(AUDIO_TIMEOUT_MS).toBe(1000)
    expect(SETTINGS_AUTOSAVE_DELAY_MS).toBe(350)
  })
})
