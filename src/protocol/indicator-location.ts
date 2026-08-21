import { parseLianaFrame } from './liana.ts'

export interface IndicatorLocationResponse {
  locations: Uint8Array
  rawFrame: Uint8Array
  trailingLength: number
}

export function createReadIndicatorLocationRequest(): Uint8Array {
  return new Uint8Array([0x7b, 0x12, 0x31, 0, 2, 0, 0, 0x7d, 0x20, 0x18])
}

export function createWriteIndicatorLocationRequest(locations: readonly number[]): Uint8Array {
  if (locations.length < 1 || locations.length > 8 || locations.some(location => !Number.isInteger(location) || location < 0 || location > 0xff)) {
    throw new Error('Indicator locations must contain 1–8 byte values')
  }
  return new Uint8Array([0x7b, 0x10, 0x31, 0x10, locations.length + 2, 0, 0, 0x7d, 0x20, 0x19, ...locations])
}

export function parseIndicatorLocationResponse(data: Uint8Array): IndicatorLocationResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x18) throw new Error('Response is not readLedIndicatorLocation (20/18)')
  if (frame.payload.byteLength < 1 || frame.payload.byteLength > 8) throw new Error(`Indicator location payload must be 1–8 bytes, got ${frame.payload.byteLength}`)
  return { locations: frame.payload.slice(), rawFrame: data.slice(0, 8 + frame.payloadLength), trailingLength: frame.trailing.byteLength }
}

export function parseWriteIndicatorLocationAck(data: Uint8Array): void {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x19) throw new Error('Response is not writeLedIndicatorLocation (20/19)')
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0) throw new Error('writeLedIndicatorLocation did not return success status 0')
}
