import { parseLianaFrame } from './liana.ts'

export interface McuUuidResponse {
  bytes: Uint8Array
  rawFrame: Uint8Array
  trailingLength: number
}

/** Native readMcuUUID dispatches MCU_MAIN command/action 01/04 without arguments. */
export function createReadMcuUuidRequest(): Uint8Array {
  return new Uint8Array([0x7b, 0x10, 0x31, 0x10, 2, 0, 0, 0x7d, 0x01, 0x04])
}

export function parseMcuUuidResponse(data: Uint8Array): McuUuidResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x01 || frame.action !== 0x04) throw new Error('Response is not readMcuUUID (01/04)')
  if (frame.payload.byteLength === 0) throw new Error('MCU UUID response is empty')
  return {
    bytes: frame.payload.slice(),
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
