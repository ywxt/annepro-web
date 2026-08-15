import { assembleLianaPayload } from './multipart.ts'

const LAYER_COUNT = 4

export interface KeyboardLayerResponse {
  layer: number
  data: Uint8Array
  packetCount: number
}

/** Builds the read-only uploadKbdLayout request observed in ObinsKit 1.2.11. */
export function createReadKeyboardLayerRequest(layer: number): Uint8Array {
  if (!Number.isInteger(layer) || layer < 0 || layer >= LAYER_COUNT) {
    throw new RangeError(`Keyboard layer must be an integer from 0 to ${LAYER_COUNT - 1}`)
  }
  return new Uint8Array([
    0x7b, 0x12, 0x31, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x10, 0x02, layer,
  ])
}

/** Parses captured reports only; this function performs no HID I/O. */
export function parseKeyboardLayerResponse(
  layer: number,
  reports: readonly Uint8Array[],
): KeyboardLayerResponse {
  createReadKeyboardLayerRequest(layer)
  const assembled = assembleLianaPayload(reports)
  if (assembled.command !== 0x10 || assembled.action !== 0x02) {
    throw new Error('Response is not uploadKbdLayout (10/02)')
  }
  if (assembled.payload.byteLength !== 61) {
    throw new Error(`Keyboard layer payload must be 61 bytes, got ${assembled.payload.byteLength}`)
  }
  return {
    layer,
    data: assembled.payload,
    packetCount: assembled.packetCount,
  }
}
