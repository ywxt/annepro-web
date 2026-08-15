import { assembleLianaPayload } from './multipart.ts'
import { parseLianaFrame } from './liana.ts'

const LAYER_COUNT = 4
const ROW_LENGTHS = [14, 14, 13, 12, 8] as const

/** ANSI 60% physical key widths in the same matrix order as the 61-byte C18 layout. */
export const KEY_WIDTHS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
] as const

const KEY_NAMES: Readonly<Record<number, string>> = {
  0x00: 'Disabled', 0x01: 'Transparent',
  0x28: 'Enter', 0x29: 'Esc', 0x2a: 'Backspace', 0x2b: 'Tab', 0x2c: 'Space',
  0x2d: '-', 0x2e: '=', 0x2f: '[', 0x30: ']', 0x31: '\\', 0x33: ';',
  0x34: "'", 0x35: '`', 0x36: ',', 0x37: '.', 0x38: '/',
  0x39: 'CapsLock', 0x46: 'PrintScreen', 0x47: 'ScrollLock', 0x48: 'Pause',
  0x49: 'Insert', 0x4a: 'Home', 0x4b: 'PageUp', 0x4c: 'Delete', 0x4d: 'End',
  0x4e: 'PageDown', 0x4f: 'Right', 0x50: 'Left', 0x51: 'Down', 0x52: 'Up',
  0x53: 'NumLock', 0x54: 'KP /', 0x55: 'KP *', 0x56: 'KP -', 0x57: 'KP +',
  0x58: 'KP Enter', 0x59: 'KP 1', 0x5a: 'KP 2', 0x5b: 'KP 3', 0x5c: 'KP 4',
  0x5d: 'KP 5', 0x5e: 'KP 6', 0x5f: 'KP 7', 0x60: 'KP 8', 0x61: 'KP 9',
  0x62: 'KP 0', 0x63: 'KP .', 0x64: 'Non-US \\', 0x65: 'Application',
  0x66: 'Power', 0x67: 'KP =',
  0xa5: 'System Power', 0xa6: 'System Sleep', 0xa7: 'System Wake',
  0xa8: 'Mute', 0xa9: 'Volume +', 0xaa: 'Volume -', 0xab: 'Play/Pause',
  0xac: 'Next Track', 0xad: 'Previous Track', 0xae: 'Brightness +',
  0xaf: 'Brightness -',
  0xc0: 'Fn1', 0xc1: 'Fn2', 0xc2: 'Fn3', 0xc3: 'Fn4',
  0xc8: 'Bluetooth 1', 0xc9: 'Bluetooth 2', 0xca: 'Bluetooth 3',
  0xcb: 'Bluetooth 4', 0xcc: 'Bluetooth On', 0xcf: 'Fn Wheel',
  0xe0: 'LCtrl', 0xe1: 'LShift', 0xe2: 'LAlt', 0xe3: 'LGui',
  0xe4: 'RCtrl', 0xe5: 'RShift', 0xe6: 'RAlt', 0xe7: 'RGui',
  0xee: 'OLED Up', 0xef: 'OLED Down', 0xf0: 'Backlight Toggle',
  0xf1: 'Backlight Color', 0xf2: 'Backlight Level', 0xf3: 'Backlight +',
  0xf4: 'Backlight -', 0xf5: 'Backlight Rate', 0xf6: 'Backlight Battery',
  0xf7: 'QuickNumber', 0xf8: 'Mouse 1', 0xf9: 'Mouse 2', 0xfa: 'Mouse 3',
  0xfb: 'Mouse Up', 0xfc: 'Mouse Down', 0xfd: 'Mouse Left', 0xfe: 'Mouse Right',
}

export interface KeyboardLayerResponse {
  layer: number
  data: Uint8Array
  packetCount: number
}

export interface KeyboardLayerWriteAck {
  packet: number
  rawFrame: Uint8Array
  trailingLength: number
}

export interface KeycodeOption {
  value: number
  name: string
  group: 'Basic' | 'Function' | 'Media' | 'Anne Pro' | 'Modifiers'
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

export function createWriteKeyboardLayerRequests(layer: number, data: Uint8Array): Uint8Array[] {
  createReadKeyboardLayerRequest(layer)
  if (data.byteLength !== 61) {
    throw new Error(`Keyboard layer payload must be 61 bytes, got ${data.byteLength}`)
  }
  const requests: Uint8Array[] = []
  // Native multi_package_create receives the layer as a separate prefix vector.
  // USB's 0x35 (53) data limit therefore leaves 52 keycodes per packet, and it
  // prepends the layer byte to every packet, including continuations.
  for (let offset = 0, packet = 0; offset < data.byteLength; offset += 52, packet += 1) {
    const keycodes = data.slice(offset, offset + 52)
    const payload = new Uint8Array(1 + keycodes.byteLength)
    payload[0] = layer
    payload.set(keycodes, 1)
    const hasMore = offset + keycodes.byteLength < data.byteLength
    requests.push(new Uint8Array([
      0x7b, 0x12, 0x31, packet | (hasMore ? 0x80 : 0),
      payload.byteLength + 2, 0, 0, 0x7d, 0x10, 0x01, ...payload,
    ]))
  }
  return requests
}

export function parseWriteKeyboardLayerAck(packet: number, data: Uint8Array): KeyboardLayerWriteAck {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x10 || frame.action !== 0x01) {
    throw new Error('Response is not downloadKbdLayout (10/01)')
  }
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== packet) {
    throw new Error(`Layer write acknowledgement does not match packet ${packet}`)
  }
  return {
    packet,
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
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
  if (keycode >= 0x3a && keycode <= 0x45) return `F${keycode - 0x39}`
  if (keycode >= 0x68 && keycode <= 0x73) return `F${keycode - 0x5b}`
  return KEY_NAMES[keycode] ?? `0x${keycode.toString(16).padStart(2, '0')}`
}

/** Label rendered on a physical keycap. Transparent intentionally appears blank. */
export function keycapLabel(keycode: number): string {
  return keycode === 0x01 ? '' : keycodeName(keycode)
}

export function keycodeOptions(): KeycodeOption[] {
  const values = new Set<number>(Object.keys(KEY_NAMES).map(Number))
  for (let value = 0x04; value <= 0x73; value += 1) values.add(value)
  const group = (value: number): KeycodeOption['group'] => {
    if (value >= 0xe0 && value <= 0xe7) return 'Modifiers'
    if (value >= 0xa5 && value <= 0xaf) return 'Media'
    if (value >= 0xc0 || value >= 0xee) return 'Anne Pro'
    if ((value >= 0x3a && value <= 0x73) || value === 0x46 || value === 0x47 || value === 0x48) return 'Function'
    return 'Basic'
  }
  return Array.from(values, value => ({ value, name: keycodeName(value), group: group(value) }))
    .sort((left, right) => left.group.localeCompare(right.group) || left.value - right.value)
}
