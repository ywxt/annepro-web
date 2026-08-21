import { parseLianaFrame } from './liana.ts'

export const OLED_WIDTH = 256
export const OLED_HEIGHT = 32
export const OLED_PACKED_BYTES = OLED_WIDTH * OLED_HEIGHT / 2
export const OLED_PAGE_BYTES = 32
export const OLED_PAGE_COUNT = OLED_PACKED_BYTES / OLED_PAGE_BYTES

export interface OledDateTime {
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
  second: number
}

function request(action: number, payload: Uint8Array): Uint8Array {
  if (payload.byteLength > 53) throw new RangeError('OLED payload exceeds one HID report')
  return new Uint8Array([
    0x7b, 0x10, 0x31, 0x10, payload.byteLength + 2, 0, 0, 0x7d,
    0x70, action, ...payload,
  ])
}

function integer(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`)
  }
  return value
}

export function createOledDateTimeRequest(value: OledDateTime): Uint8Array {
  return request(0x07, new Uint8Array([
    integer('Month', value.month, 1, 12),
    integer('Day', value.day, 1, 31),
    integer('Weekday', value.weekday, 1, 7),
    integer('Hour', value.hour, 0, 23),
    integer('Minute', value.minute, 0, 59),
    integer('Second', value.second, 0, 59),
  ]))
}

export function oledDateTimeFromDate(date: Date): OledDateTime {
  if (Number.isNaN(date.getTime())) throw new RangeError('OLED date must be valid')
  return {
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: date.getDay() || 7,
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  }
}

export function createOledScrollRequest(enabled: boolean): Uint8Array {
  return request(0x05, new Uint8Array([enabled ? 1 : 0]))
}

export function createOledMonitorRequest(values: Uint8Array): Uint8Array {
  if (values.byteLength === 0) throw new RangeError('OLED monitor data cannot be empty')
  return request(0x09, values)
}

/** Packs the official 256x32 RGBA canvas into two 4-bit grayscale pixels per byte. */
export function packOledRgba(rgba: Uint8ClampedArray, flipRows = true): Uint8Array {
  if (rgba.byteLength !== OLED_WIDTH * OLED_HEIGHT * 4) {
    throw new RangeError(`OLED RGBA data must contain ${OLED_WIDTH * OLED_HEIGHT * 4} bytes`)
  }
  const packed = new Uint8Array(OLED_PACKED_BYTES)
  for (let row = 0; row < OLED_HEIGHT; row += 1) {
    const sourceRow = flipRows ? OLED_HEIGHT - 1 - row : row
    for (let column = 0; column < OLED_WIDTH; column += 2) {
      const first = (sourceRow * OLED_WIDTH + column) * 4
      const second = first + 4
      const high = Math.floor(((rgba[first] + rgba[first + 1] + rgba[first + 2]) / 3) / 255 * 15)
      const low = Math.floor(((rgba[second] + rgba[second + 1] + rgba[second + 2]) / 3) / 255 * 15)
      packed[row * OLED_WIDTH / 2 + column / 2] = high << 4 | low
    }
  }
  return packed
}

function createOledBitmapRequests(action: 0x01 | 0x08, packed: Uint8Array): Uint8Array[] {
  if (packed.byteLength !== OLED_PACKED_BYTES) {
    throw new RangeError(`OLED bitmap must contain ${OLED_PACKED_BYTES} packed bytes`)
  }
  return Array.from({ length: OLED_PAGE_COUNT }, (_, page) => {
    const payload = new Uint8Array(1 + OLED_PAGE_BYTES)
    payload[0] = page
    payload.set(packed.slice(page * OLED_PAGE_BYTES, (page + 1) * OLED_PAGE_BYTES), 1)
    return request(action, payload)
  })
}

export function createOledImageRequests(packed: Uint8Array): Uint8Array[] {
  return createOledBitmapRequests(0x01, packed)
}

export function createOledCharacterRequests(packed: Uint8Array): Uint8Array[] {
  return createOledBitmapRequests(0x08, packed)
}

export function parseOledAck(action: 0x01 | 0x05 | 0x07 | 0x08 | 0x09, data: Uint8Array): void {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x70 || frame.action !== action) {
    throw new Error(`Response is not OLED 70/${action.toString(16).padStart(2, '0')}`)
  }
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0) {
    throw new Error('OLED command did not return success status 0')
  }
}
