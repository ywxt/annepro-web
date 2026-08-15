import { parseLianaFrame } from './liana.ts'

export type HardwareSettingKey =
  | 'userLayout'
  | 'magicFn'
  | 'macroTrigger'
  | 'capslockLed'
  | 'backlightBrightness'
  | 'ledHold'
  | 'tapStatus'
  | 'tapActMode'
  | 'tapTimeoutValue'
  | 'sleepTimeoutRaw'
  | 'ledPowerMode'

interface SettingCommand {
  command: number
  action: number
  width: 1 | 2
  min: number
  max: number
}

const SETTING_COMMANDS: Readonly<Record<HardwareSettingKey, SettingCommand>> = {
  userLayout: { command: 0x10, action: 0x06, width: 1, min: 0, max: 1 },
  magicFn: { command: 0x10, action: 0x03, width: 1, min: 0, max: 2 },
  macroTrigger: { command: 0x30, action: 0x03, width: 1, min: 0, max: 1 },
  capslockLed: { command: 0x10, action: 0x07, width: 1, min: 0, max: 1 },
  backlightBrightness: { command: 0x20, action: 0x15, width: 1, min: 1, max: 10 },
  ledHold: { command: 0x20, action: 0x0d, width: 1, min: 0, max: 1 },
  tapStatus: { command: 0x10, action: 0x05, width: 1, min: 0, max: 1 },
  tapActMode: { command: 0x10, action: 0x11, width: 1, min: 2, max: 3 },
  tapTimeoutValue: { command: 0x10, action: 0x13, width: 1, min: 10, max: 200 },
  sleepTimeoutRaw: { command: 0x01, action: 0x0f, width: 2, min: 10, max: 3600 },
  ledPowerMode: { command: 0x20, action: 0x1f, width: 1, min: 1, max: 2 },
}

export interface SettingWriteResult {
  key: HardwareSettingKey
  value: number
  ackPayload: Uint8Array
  rawFrame: Uint8Array
  trailingLength: number
}

export function createWriteHardwareSettingRequest(key: HardwareSettingKey, value: number): Uint8Array {
  const definition = SETTING_COMMANDS[key]
  if (!Number.isInteger(value) || value < definition.min || value > definition.max) {
    throw new RangeError(`${key} must be an integer from ${definition.min} to ${definition.max}`)
  }
  const payload = definition.width === 1
    ? [value]
    : [value & 0xff, (value >> 8) & 0xff]
  return new Uint8Array([
    0x7b, 0x12, 0x31, 0, payload.length + 2, 0, 0, 0x7d,
    definition.command, definition.action, ...payload,
  ])
}

export function parseWriteHardwareSettingResponse(
  key: HardwareSettingKey,
  value: number,
  data: Uint8Array,
): SettingWriteResult {
  const definition = SETTING_COMMANDS[key]
  const frame = parseLianaFrame(data)
  if (frame.command !== definition.command || frame.action !== definition.action) {
    throw new Error(`Response is not write ${key}`)
  }
  if (frame.payload.byteLength < 1 || frame.payload.byteLength > 2) {
    throw new Error(`write ${key} response payload must be 1–2 bytes, got ${frame.payload.byteLength}`)
  }
  return {
    key, value, ackPayload: frame.payload.slice(),
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
