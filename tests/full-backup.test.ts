import { describe, expect, it } from 'vitest'
import { parseFullBackup } from '../src/protocol/full-backup.ts'

function validBackup(): Record<string, unknown> {
  return {
    format: 'annepro-web-full-backup', version: 1,
    device: { vendorId: 0x04d9, productId: 0xa293, model: 5, type: 1 },
    settings: { userLayout: 1, magicFn: 1, macroTrigger: 0, capslockLed: 1, backlightBrightness: 7, ledHold: 0, tapStatus: 1, tapActMode: 3, tapTimeoutValue: 113, sleepTimeoutRaw: 600, ledPowerMode: 2, indicatorColor: '#ff9800' },
    layers: Array.from({ length: 4 }, (_, index) => ({ index, keycodes: Array(61).fill(index) })),
    macros: { items: [], activeList: [] },
    lights: [{ name: 'Red', type: 1, colors: ['#ff0000'] }],
  }
}

describe('full backup parser', () => {
  it('parses a complete v1 backup into protocol-ready values', () => {
    const parsed = parseFullBackup(validBackup())
    expect(parsed.device).toEqual({ vendorId: 0x04d9, productId: 0xa293, model: 5, type: 1 })
    expect(parsed.layers).toHaveLength(4)
    expect(parsed.settings.indicatorColor).toBe('#ff9800')
    expect(parsed.lights[0]).toMatchObject({ name: 'Red', type: 1, dynamicColors: expect.any(Array) })
    expect(parsed.lights[0].staticColors).toEqual(Array(61).fill('#ff0000'))
  })
  it('rejects missing, duplicated, malformed, or out-of-range device data', () => {
    const missing = validBackup(); missing.layers = [{ index: 0, keycodes: Array(61).fill(0) }]
    expect(() => parseFullBackup(missing)).toThrow('four layers')
    const setting = validBackup(); (setting.settings as Record<string, unknown>).backlightBrightness = 99
    expect(() => parseFullBackup(setting)).toThrow('backlightBrightness')
    const light = validBackup(); light.lights = [{ name: 'Bad', type: 2, colors: ['#fff'] }]
    expect(() => parseFullBackup(light)).toThrow()
    const nonC18 = validBackup(); (nonC18.device as Record<string, unknown>).model = 3
    expect(() => parseFullBackup(nonC18)).toThrow('supported Obins keyboard profile')
  })
  it('validates macro events and bindings', () => {
    const invalid = validBackup()
    invalid.macros = { items: [{ name: 'x', icon: 0, events: [2, 4] }], activeList: [{ layer: 0, matrixPosition: 0, macroIndex: 0 }] }
    expect(() => parseFullBackup(invalid)).toThrow()
  })
  it('allows an observed but non-restorable sleep timeout to be omitted', () => {
    const backup = validBackup()
    const settings = backup.settings as Record<string, unknown>
    delete settings.sleepTimeoutRaw
    settings.sleepTimeoutRawObserved = 31744
    expect(parseFullBackup(backup).settings.sleepTimeoutRaw).toBeUndefined()
  })
})
