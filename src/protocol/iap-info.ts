import { parseLianaFrame } from './liana.ts'

const READ_IAP_MODE_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x02, 0x02,
])

export interface IapModeResponse {
  mode: number
  rawFrame: Uint8Array
  trailingLength: number
}

export function createReadIapModeRequest(): Uint8Array {
  return READ_IAP_MODE_REQUEST.slice()
}

export function parseIapModeResponse(data: Uint8Array): IapModeResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x02 || frame.action !== 0x02) {
    throw new Error('Response is not readIapMode (02/02)')
  }
  if (frame.payload.byteLength !== 1) {
    throw new Error(`readIapMode payload must be 1 byte, got ${frame.payload.byteLength}`)
  }
  return {
    mode: frame.payload[0],
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
