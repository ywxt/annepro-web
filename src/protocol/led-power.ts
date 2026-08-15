import { parseLianaFrame } from './liana.ts'

const READ_LED_POWER_MODE_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x20, 0x1e,
])

export interface LedPowerModeResponse {
  mode: number
  modeName: string
  rawFrame: Uint8Array
  trailingLength: number
}

export function createReadLedPowerModeRequest(): Uint8Array {
  return READ_LED_POWER_MODE_REQUEST.slice()
}

export function parseLedPowerModeResponse(data: Uint8Array): LedPowerModeResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x1e) {
    throw new Error('Response is not readLedPowerMode (20/1e)')
  }
  if (frame.payload.byteLength !== 1) {
    throw new Error(`readLedPowerMode payload must be 1 byte, got ${frame.payload.byteLength}`)
  }
  const mode = frame.payload[0]
  return {
    mode,
    modeName: ({ 1: 'Low', 2: 'High' } as Record<number, string>)[mode] ?? 'Unknown',
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
