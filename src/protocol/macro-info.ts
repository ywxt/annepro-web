import { parseLianaFrame } from './liana.ts'

const READ_MACRO_CONFIG_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x30, 0x06,
])

export interface MacroConfigResponse {
  storedMacroCount: number
  unknownByte: number
  hasMacros: boolean
  rawFrame: Uint8Array
  trailingLength: number
}

export function createReadMacroConfigRequest(): Uint8Array {
  return READ_MACRO_CONFIG_REQUEST.slice()
}

export function parseMacroConfigResponse(data: Uint8Array): MacroConfigResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x30 || frame.action !== 0x06) {
    throw new Error('Response is not readMacroConfig (30/06)')
  }
  if (frame.payload.byteLength !== 2) {
    throw new Error(`readMacroConfig payload must be 2 bytes, got ${frame.payload.byteLength}`)
  }
  return {
    storedMacroCount: frame.payload[0],
    unknownByte: frame.payload[1],
    hasMacros: frame.payload[0] !== 0,
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
