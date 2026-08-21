import { parseLianaFrame } from './liana.ts'
import { getObinsModel } from '../device-registry.ts'

const READ_DEVICE_TYPE_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x01,
])

export interface DeviceTypeResponse {
  model: number
  modelName: string
  type: number
  typeName: string
  rawFrame: Uint8Array
  trailingLength: number
}

const TYPE_NAMES: Readonly<Record<number, string>> = {
  1: 'Keyboard',
  2: 'Mouse',
}

/** Returns a fresh copy of the request confirmed by a controlled ObinsKit capture. */
export function createReadDeviceTypeRequest(): Uint8Array {
  return READ_DEVICE_TYPE_REQUEST.slice()
}

export function parseDeviceTypeResponse(data: Uint8Array): DeviceTypeResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x01 || frame.action !== 0x01) {
    throw new Error('Response is not readDeviceType (01/01)')
  }
  if (frame.payload.byteLength !== 2) {
    throw new Error(`readDeviceType payload must be 2 bytes, got ${frame.payload.byteLength}`)
  }
  const model = frame.payload[0]
  const type = frame.payload[1]
  return {
    model,
    modelName: getObinsModel(model)?.name ?? 'Unknown',
    type,
    typeName: TYPE_NAMES[type] ?? 'Unknown',
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
