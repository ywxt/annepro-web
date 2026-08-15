import { parseLianaFrame } from './liana.ts'
import type { DeviceCapabilities } from './capabilities.ts'

const READ_HARDWARE_STATE_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x09,
])

export interface HardwareState {
  format: 'legacy' | 'modern'
  userLayout: number
  magicFn: number
  macroTrigger: number
  capslockLed: number
  indicatorBrightness: number
  backlightBrightness: number
  ledHold: number
  tapStatus: number
  tapActMode: number
  tapTimeoutValue: number
  sleepTimeoutRaw: number
  reservedPrefix: Uint8Array
  rawFrame: Uint8Array
  trailingLength: number
}

export interface HardwareStateDescription {
  userLayout: string
  magicFn: string
  macroTrigger: string
  capslockLed: string
  indicatorBrightness: string
  backlightBrightness: string
  ledHold: string
  tapStatus: string
  tapActMode: string
  tapTimeout: string
  sleepTimeout: string
}

function option(value: number, labels: Record<number, string>): string {
  return labels[value] ?? `未知選項 (${value})`
}

function brightness(value: number): string {
  if (value < 1 || value > 10) return `異常／保留值 (${value})`
  return `${value * 10}%`
}

/** Matches ObinsKit's slider conversion: 10–59 seconds, then 1–60 minutes. */
export function describeSleepTimeout(rawSeconds: number): string {
  if (rawSeconds < 60) return `${Math.max(rawSeconds, 10)} 秒`
  const minutes = Math.min(Math.floor(rawSeconds / 60), 60)
  return `${minutes} 分鐘${rawSeconds > 3600 ? '（ObinsKit 上限；原始值超出範圍）' : ''}`
}

export function describeHardwareState(state: HardwareState, capabilities?: DeviceCapabilities | null): HardwareStateDescription {
  return {
    userLayout: option(state.userLayout, { 0: '預設配置', 1: '使用者配置' }),
    magicFn: option(state.magicFn, { 0: '停用', 1: 'Fn1', 2: 'Fn2' }),
    macroTrigger: option(state.macroTrigger, { 0: '停用', 1: '啟用' }),
    capslockLed: option(state.capslockLed, { 0: '僅 CapsLock 鍵', 1: '所有按鍵' }),
    indicatorBrightness: capabilities?.hasIndicatorLed === false
      ? `此型號不支援（保留值 ${state.indicatorBrightness}）`
      : brightness(state.indicatorBrightness),
    backlightBrightness: brightness(state.backlightBrightness),
    ledHold: state.ledHold === 1 ? '啟用（自動休眠）' : state.ledHold === 0 ? '停用（不自動休眠）' : `未知選項 (${state.ledHold})`,
    tapStatus: state.tapStatus >= 1 ? '啟用' : '停用',
    tapActMode: option(state.tapActMode, { 2: '一般模式', 3: '組合模式' }),
    tapTimeout: `${state.tapTimeoutValue * 10} ms`,
    sleepTimeout: capabilities?.sleepTimeout === false
      ? `韌體不支援（保留值 ${state.sleepTimeoutRaw}）`
      : `${describeSleepTimeout(state.sleepTimeoutRaw)}${state.ledHold === 0 ? '（目前不生效）' : ''}`,
  }
}

export function createReadHardwareStateRequest(): Uint8Array {
  return READ_HARDWARE_STATE_REQUEST.slice()
}

export function parseHardwareStateResponse(data: Uint8Array): HardwareState {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x01 || frame.action !== 0x09) {
    throw new Error('Response is not readHardwareState (01/09)')
  }
  const rawFrame = data.slice(0, 8 + frame.payloadLength)
  if (frame.payload.byteLength === 6) {
    return {
      format: 'legacy',
      userLayout: frame.payload[0], tapStatus: frame.payload[1], magicFn: frame.payload[2],
      macroTrigger: frame.payload[3], capslockLed: frame.payload[4], ledHold: frame.payload[5],
      indicatorBrightness: 0, backlightBrightness: 0, tapActMode: 0,
      tapTimeoutValue: 0, sleepTimeoutRaw: 0, reservedPrefix: new Uint8Array(),
      rawFrame, trailingLength: frame.trailing.byteLength,
    }
  }
  if (frame.payload.byteLength !== 24) {
    throw new Error(`readHardwareState payload must be 6 or 24 bytes, got ${frame.payload.byteLength}`)
  }
  return {
    format: 'modern',
    userLayout: frame.payload[12], magicFn: frame.payload[13],
    macroTrigger: frame.payload[14], capslockLed: frame.payload[15],
    indicatorBrightness: frame.payload[16], backlightBrightness: frame.payload[17],
    ledHold: frame.payload[18], tapStatus: frame.payload[19], tapActMode: frame.payload[20],
    tapTimeoutValue: frame.payload[21],
    sleepTimeoutRaw: frame.payload[22] | (frame.payload[23] << 8),
    reservedPrefix: frame.payload.slice(0, 12), rawFrame,
    trailingLength: frame.trailing.byteLength,
  }
}
