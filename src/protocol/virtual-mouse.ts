import { parseLianaFrame } from './liana.ts'

export interface VirtualMouseConfigResponse {
  rawConfig: Uint8Array
  rawFrame: Uint8Array
  trailingLength: number
}

function request(action: 0x01 | 0x02 | 0x03 | 0x05, payload = new Uint8Array()): Uint8Array {
  if (payload.byteLength > 53) throw new RangeError('Virtual mouse payload exceeds one HID report')
  return new Uint8Array([
    0x7b, 0x10, 0x31, 0x10, payload.byteLength + 2, 0, 0, 0x7d,
    0x60, action, ...payload,
  ])
}

/** Native action 01 accepts a buffer; its semantic curve format is absent from the renderer. */
export function createWriteVirtualMouseCursorSpeedRequest(curve: Uint8Array): Uint8Array {
  if (curve.byteLength === 0) throw new RangeError('Virtual mouse cursor curve cannot be empty')
  return request(0x01, curve)
}

function speed(name: string, value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${name} must be an integer from 0 to 255`)
  }
  return new Uint8Array([value])
}

export function createWriteVirtualMouseWheelSpeedRequest(value: number): Uint8Array {
  return request(0x02, speed('Virtual mouse wheel speed', value))
}

export function createWriteVirtualMousePanSpeedRequest(value: number): Uint8Array {
  return request(0x03, speed('Virtual mouse pan speed', value))
}

export function createReadVirtualMouseConfigRequest(): Uint8Array {
  return request(0x05)
}

export function parseVirtualMouseConfigResponse(data: Uint8Array): VirtualMouseConfigResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x60 || frame.action !== 0x05) {
    throw new Error('Response is not readVirtualMouseConfig (60/05)')
  }
  if (frame.payload.byteLength === 0) throw new Error('Virtual mouse config response is empty')
  return {
    rawConfig: frame.payload.slice(),
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}

export function parseVirtualMouseWriteAck(action: 0x01 | 0x02 | 0x03, data: Uint8Array): void {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x60 || frame.action !== action) {
    throw new Error(`Response is not virtual mouse 60/${action.toString(16).padStart(2, '0')}`)
  }
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0) {
    throw new Error('Virtual mouse write did not return success status 0')
  }
}
