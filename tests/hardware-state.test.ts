import { describe, expect, it } from 'vitest'
import {
  createReadHardwareStateRequest,
  describeHardwareState,
  describeSleepTimeout,
  parseHardwareStateResponse,
} from '../src/protocol/hardware-state.ts'

describe('readHardwareState protocol', () => {
  it('creates the request directly identified in native dispatch', () => {
    expect(Array.from(createReadHardwareStateRequest())).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x09,
    ])
  })

  it('decodes the isolated modern response exactly like the renderer', () => {
    const response = new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x1a, 0x00, 0x00, 0x7d, 0x01, 0x09,
      0, 0, 0, 0, 1, 1, 1, 1, 0x57, 0x29, 0, 0,
      1, 1, 0, 1, 0x18, 7, 0, 1, 3, 0x71, 0, 0x7c,
    ])
    expect(parseHardwareStateResponse(response)).toMatchObject({
      format: 'modern', userLayout: 1, magicFn: 1, macroTrigger: 0,
      capslockLed: 1, indicatorBrightness: 24, backlightBrightness: 7,
      ledHold: 0, tapStatus: 1, tapActMode: 3, tapTimeoutValue: 113,
      sleepTimeoutRaw: 31744, trailingLength: 0,
    })
  })

  it('supports the renderer legacy six-byte format', () => {
    const response = new Uint8Array([
      0x7b, 0x12, 0x13, 0, 8, 0, 0, 0x7d, 1, 9, 2, 1, 2, 0, 1, 1,
    ])
    expect(parseHardwareStateResponse(response)).toMatchObject({
      format: 'legacy', userLayout: 2, tapStatus: 1, magicFn: 2,
      macroTrigger: 0, capslockLed: 1, ledHold: 1,
    })
  })

  it('maps raw options and units using the unpacked renderer behaviour', () => {
    const response = new Uint8Array([
      0x7b, 0x12, 0x13, 0, 0x1a, 0, 0, 0x7d, 1, 9,
      0, 0, 0, 0, 1, 1, 1, 1, 0x57, 0x29, 0, 0,
      1, 1, 0, 1, 24, 7, 0, 1, 3, 113, 0, 0x7c,
    ])
    expect(describeHardwareState(parseHardwareStateResponse(response))).toEqual({
      userLayout: '使用者配置', magicFn: 'Fn1', macroTrigger: '停用',
      capslockLed: '所有按鍵', indicatorBrightness: '異常／保留值 (24)',
      backlightBrightness: '70%', ledHold: '停用（不自動休眠）',
      tapStatus: '啟用', tapActMode: '組合模式', tapTimeout: '1130 ms',
      sleepTimeout: '60 分鐘（ObinsKit 上限；原始值超出範圍）（目前不生效）',
    })
  })

  it('matches ObinsKit sleep slider boundaries', () => {
    expect(describeSleepTimeout(5)).toBe('10 秒')
    expect(describeSleepTimeout(59)).toBe('59 秒')
    expect(describeSleepTimeout(600)).toBe('10 分鐘')
    expect(describeSleepTimeout(3600)).toBe('60 分鐘')
  })
})
