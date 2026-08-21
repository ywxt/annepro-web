import { parseLianaFrame } from './liana.ts'

export interface CombinationModeResponse {
  enabled: boolean
  rawValue: number
  rawFrame: Uint8Array
  trailingLength: number
}

/** Native getCombinationMode: MCU_MAIN command/action 01/f1 with no arguments. */
export function createReadCombinationModeRequest(): Uint8Array {
  return new Uint8Array([0x7b, 0x10, 0x31, 0x10, 2, 0, 0, 0x7d, 0x01, 0xf1])
}

export function parseCombinationModeResponse(data: Uint8Array): CombinationModeResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x01 || frame.action !== 0xf1) {
    throw new Error('Response is not getCombinationMode (01/f1)')
  }
  if (frame.payload.byteLength !== 1) throw new Error('Combination mode response must contain one byte')
  return {
    enabled: frame.payload[0] !== 0,
    rawValue: frame.payload[0],
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
