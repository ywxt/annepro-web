import { assembleLianaPayload } from './multipart.ts'

const LAYER_COUNT = 4
const ROW_LENGTHS = [14, 14, 13, 12, 8] as const

const KEY_NAMES: Readonly<Record<number, string>> = {
  0x28: 'Enter', 0x29: 'Esc', 0x2a: 'Backspace', 0x2b: 'Tab', 0x2c: 'Space',
  0x2d: '-', 0x2e: '=', 0x2f: '[', 0x30: ']', 0x31: '\\', 0x33: ';',
  0x34: "'", 0x35: '`', 0x36: ',', 0x37: '.', 0x38: '/',
  0xc0: 'Fn1', 0xc1: 'Fn2',
  0xe0: 'LCtrl', 0xe1: 'LShift', 0xe2: 'LAlt', 0xe3: 'LGui',
  0xe4: 'RCtrl', 0xe5: 'RShift', 0xe6: 'RAlt', 0xe7: 'RGui',
}

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

export function keyboardLayerRows(data: Uint8Array): Uint8Array[] {
  if (data.byteLength !== 61) {
    throw new Error(`Keyboard layer payload must be 61 bytes, got ${data.byteLength}`)
  }
  let offset = 0
  return ROW_LENGTHS.map((length) => {
    const row = data.slice(offset, offset + length)
    offset += length
    return row
  })
}

export function keycodeName(keycode: number): string {
  if (keycode >= 0x04 && keycode <= 0x1d) return String.fromCharCode(65 + keycode - 0x04)
  if (keycode >= 0x1e && keycode <= 0x26) return String(keycode - 0x1d)
  if (keycode === 0x27) return '0'
  return KEY_NAMES[keycode] ?? `0x${keycode.toString(16).padStart(2, '0')}`
}
