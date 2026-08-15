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
  ack: 'zero' | 'echo'
}

const SETTING_COMMANDS: Readonly<Record<HardwareSettingKey, SettingCommand>> = {
  userLayout: { command: 0x10, action: 0x06, width: 1, min: 0, max: 1, ack: 'zero' },
  magicFn: { command: 0x10, action: 0x03, width: 1, min: 0, max: 2, ack: 'zero' },
  macroTrigger: { command: 0x30, action: 0x03, width: 1, min: 0, max: 1, ack: 'zero' },
  capslockLed: { command: 0x10, action: 0x07, width: 1, min: 0, max: 1, ack: 'zero' },
  backlightBrightness: { command: 0x20, action: 0x15, width: 1, min: 1, max: 10, ack: 'echo' },
  ledHold: { command: 0x20, action: 0x0d, width: 1, min: 0, max: 1, ack: 'zero' },
  tapStatus: { command: 0x10, action: 0x05, width: 1, min: 0, max: 1, ack: 'zero' },
  tapActMode: { command: 0x10, action: 0x11, width: 1, min: 2, max: 3, ack: 'zero' },
  tapTimeoutValue: { command: 0x10, action: 0x13, width: 1, min: 10, max: 200, ack: 'zero' },
  sleepTimeoutRaw: { command: 0x01, action: 0x0f, width: 2, min: 10, max: 3600, ack: 'zero' },
  ledPowerMode: { command: 0x20, action: 0x1f, width: 1, min: 1, max: 2, ack: 'echo' },
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
    0x7b, 0x10, 0x31, 0x10, payload.length + 2, 0, 0, 0x7d,
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
  const expectedAck = definition.ack === 'echo' ? value : 0
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== expectedAck) {
    throw new Error(`write ${key} acknowledgement must be ${expectedAck}`)
  }
  return {
    key, value, ackPayload: frame.payload.slice(),
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
