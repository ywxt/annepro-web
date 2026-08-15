import { parseLianaFrame } from './liana.ts'

const READ_INDICATOR_COLOR_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0, 2, 0, 0, 0x7d, 0x20, 0x1a,
])

export interface IndicatorColorResponse {
  rgb: readonly [number, number, number]
  hex: string
  rawFrame: Uint8Array
  trailingLength: number
}

function formatColor(rgb: readonly number[]): string {
  return `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('')}`
}

export function parseColorHex(hex: string): readonly [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Invalid RGB color ${hex}`)
  return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number]
}

export function createReadIndicatorColorRequest(): Uint8Array {
  return READ_INDICATOR_COLOR_REQUEST.slice()
}

export function createWriteIndicatorColorRequest(hex: string): Uint8Array {
  const rgb = parseColorHex(hex)
  return new Uint8Array([0x7b, 0x12, 0x31, 0, 5, 0, 0, 0x7d, 0x20, 0x1b, ...rgb])
}

export function parseIndicatorColorResponse(data: Uint8Array): IndicatorColorResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x1a) throw new Error('Response is not readLedIndicatorColor (20/1a)')
  if (frame.payload.byteLength !== 3) throw new Error(`Indicator color payload must be 3 bytes, got ${frame.payload.byteLength}`)
  const rgb = Array.from(frame.payload) as [number, number, number]
  return { rgb, hex: formatColor(rgb), rawFrame: data.slice(0, 8 + frame.payloadLength), trailingLength: frame.trailing.byteLength }
}

export function parseWriteIndicatorColorAck(data: Uint8Array): void {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x1b) throw new Error('Response is not writeLedIndicatorColor (20/1b)')
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0) throw new Error('writeLedIndicatorColor did not return success status 0')
}
