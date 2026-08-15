import { parseLianaFrame } from './liana.ts'

const C18_BLANK_LEDS = [41, 43, 55, 57, 60, 61, 63, 64, 69] as const
const MAX_LIGHTS = 32

export interface LightEffect {
  name: string
  type: number
  colors: string[]
}

export interface LightWriteAck {
  packet: number
  rawFrame: Uint8Array
  trailingLength: number
}

function parseColor(color: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Invalid RGB color ${color}`)
  return [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16))
}

export function requiredLightColorCount(type: number): number {
  if (!Number.isInteger(type) || type < 1 || type > 25) throw new RangeError('Light type must be 1–25')
  return type === 1 ? 1 : type === 2 ? 61 : 12
}

export function encodeLightRgb(effect: LightEffect): Uint8Array {
  const required = requiredLightColorCount(effect.type)
  if (effect.colors.length !== required) {
    throw new Error(`Light type ${effect.type} requires ${required} colors, got ${effect.colors.length}`)
  }
  const bytes = effect.colors.flatMap(parseColor)
  if (effect.type === 2) {
    for (const blank of C18_BLANK_LEDS) bytes.splice(blank * 3, 0, 0, 0, 0)
  }
  return new Uint8Array(bytes)
}

function createLightRequests(action: 0x03 | 0x04, slot: number, effect: LightEffect): Uint8Array[] {
  if (!Number.isInteger(slot) || slot < 0 || slot > 0xff) throw new RangeError('Light slot must be 0–255')
  const rgb = encodeLightRgb(effect)
  const body = new Uint8Array(2 + rgb.byteLength)
  body.set([slot, effect.type])
  body.set(rgb, 2)
  const requests: Uint8Array[] = []
  for (let offset = 0, packet = 0; offset < body.byteLength; offset += 54, packet += 1) {
    const payload = body.slice(offset, offset + 54)
    const hasMore = offset + payload.byteLength < body.byteLength
    requests.push(new Uint8Array([
      0x7b, 0x12, 0x31, packet | (hasMore ? 0x80 : 0),
      payload.byteLength + 2, 0, 0, 0x7d, 0x20, action, ...payload,
    ]))
  }
  return requests
}

export function createPreviewLightRequests(effect: LightEffect): Uint8Array[] {
  return createLightRequests(0x04, 0xff, effect)
}

export function createDownloadLightRequests(slot: number, effect: LightEffect): Uint8Array[] {
  if (slot >= MAX_LIGHTS) throw new RangeError(`Light slot must be below ${MAX_LIGHTS}`)
  return createLightRequests(0x03, slot, effect)
}

export function createWriteLightListRequest(count: number): Uint8Array {
  if (!Number.isInteger(count) || count < 0 || count > MAX_LIGHTS) {
    throw new RangeError(`Light list count must be 0–${MAX_LIGHTS}`)
  }
  return new Uint8Array([
    0x7b, 0x12, 0x31, 0, 3, 0, 0, 0x7d, 0x20, 0x04, count,
  ])
}

export function parseLightWriteAck(action: 0x03 | 0x04, packet: number, data: Uint8Array): LightWriteAck {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== action) throw new Error('Response is not the expected light write')
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== packet) {
    throw new Error(`Light acknowledgement does not match packet ${packet}`)
  }
  return { packet, rawFrame: data.slice(0, 8 + frame.payloadLength), trailingLength: frame.trailing.byteLength }
}

export function parseWriteLightListAck(data: Uint8Array): Uint8Array {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x04 || frame.payload.byteLength < 1) {
    throw new Error('Response is not writeLightList (20/04)')
  }
  return frame.payload.slice()
}
