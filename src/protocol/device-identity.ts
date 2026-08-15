import { parseLianaFrame } from './liana.ts'

const READ_UDID_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x0d,
])

const READ_BLE_MAC_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x51, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x40, 0x30,
])

const DELETE_BLE_HOST_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x51, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x40, 0x05,
])

export interface DeviceUdid {
  bytes: Uint8Array
  rawFrame: Uint8Array
  trailingLength: number
}

export interface BleMacAddress {
  bytes: Uint8Array
  formatted: string
  rawFrame: Uint8Array
  trailingLength: number
}

export function createReadUdidRequest(): Uint8Array {
  return READ_UDID_REQUEST.slice()
}

export function createReadBleMacRequest(): Uint8Array {
  return READ_BLE_MAC_REQUEST.slice()
}

export function createDeleteBleHostRequest(): Uint8Array {
  return DELETE_BLE_HOST_REQUEST.slice()
}

export function parseUdidResponse(data: Uint8Array): DeviceUdid {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x01 || frame.action !== 0x0d) throw new Error('Response is not readUDID (01/0d)')
  if (frame.payload.byteLength !== 16) throw new Error(`readUDID payload must be 16 bytes, got ${frame.payload.byteLength}`)
  if (frame.payload.every(value => value === 0 || value === 0xff)) throw new Error('Device returned an unset UDID')
  return {
    bytes: frame.payload.slice(),
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}

export function parseBleMacResponse(data: Uint8Array): BleMacAddress {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x40 || frame.action !== 0x30) throw new Error('Response is not readBleMac (40/30)')
  if (frame.payload.byteLength < 6) throw new Error(`readBleMac payload must contain at least 6 bytes, got ${frame.payload.byteLength}`)
  const bytes = frame.payload.slice(0, 6)
  return {
    bytes,
    formatted: Array.from(bytes, value => value.toString(16).padStart(2, '0')).join(':').toUpperCase(),
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}

export function parseDeleteBleHostAck(data: Uint8Array): void {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x40 || frame.action !== 0x05) throw new Error('Response is not deleteBleHost (40/05)')
  if (frame.payload.byteLength > 1) throw new Error(`deleteBleHost acknowledgement is unexpectedly long (${frame.payload.byteLength})`)
  if (frame.payload.byteLength === 1 && frame.payload[0] !== 0) throw new Error(`deleteBleHost failed with status ${frame.payload[0]}`)
}
