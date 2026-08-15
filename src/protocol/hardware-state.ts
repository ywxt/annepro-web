import { parseLianaFrame } from './liana.ts'

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
