import { getObinsModel } from '../device-registry.ts'
import { parseLianaFrame } from './liana.ts'

export const DEFAULT_LIGHT_PALETTE = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080'] as const
export const MAX_LIGHT_PALETTE_COLORS = 16
export interface LightingProfile { keycapCount: number; rowLengths: readonly number[]; blankRgb: readonly number[]; maxEffects: number }
export const C18_LIGHTING_PROFILE: LightingProfile = { keycapCount: 61, rowLengths: [14, 14, 13, 12, 8], blankRgb: [41, 43, 55, 57, 60, 61, 63, 64, 69], maxEffects: 16 }
export function lightingProfileForModel(modelId: number): LightingProfile {
  const hardware = getObinsModel(modelId)?.hardware
  return hardware ? { keycapCount: hardware.keycapCount, rowLengths: hardware.rowLengths, blankRgb: hardware.blankRgb, maxEffects: modelId === 1 || modelId === 2 ? 3 : 16 } : C18_LIGHTING_PROFILE
}

export interface LightEffect { name: string; type: number; staticColors: string[]; dynamicColors: string[] }
export interface EncodedLightEffect { type: number; rgb: Uint8Array }
export interface LightWriteAck { packet: number; rawFrame: Uint8Array; trailingLength: number }

function parseColor(color: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Invalid RGB color ${color}`)
  return [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16))
}
function validateType(type: number): void {
  if (!Number.isInteger(type) || type < 1 || type > 25) throw new RangeError('Light type must be 1–25')
}

/** Migrates the former web format while validating native-style lighting data. */
export function normalizeLightEffect(value: unknown, profile: LightingProfile = C18_LIGHTING_PROFILE): LightEffect {
  if (!value || typeof value !== 'object') throw new Error('Light effect must be an object')
  const source = value as Record<string, unknown>
  if (typeof source.name !== 'string' || source.name.length > 40 || typeof source.type !== 'number') throw new Error('Light effect metadata is malformed')
  validateType(source.type)
  const legacy = Array.isArray(source.colors) ? source.colors : null
  const staticSource = Array.isArray(source.staticColors) ? source.staticColors : source.type <= 2 ? legacy : null
  const dynamicSource = Array.isArray(source.dynamicColors) ? source.dynamicColors : source.type > 2 ? legacy : null
  const staticColors = staticSource?.map(String) ?? Array(profile.keycapCount).fill('#000000')
  const dynamicColors = dynamicSource?.map(String) ?? [...DEFAULT_LIGHT_PALETTE]
  if (staticColors.length === 1) staticColors.splice(0, 1, ...Array(profile.keycapCount).fill(staticColors[0]))
  const result = { name: source.name, type: source.type, staticColors, dynamicColors }
  encodeLightEffect(result, profile)
  return result
}
export function normalizeLightEffects(values: unknown, profile: LightingProfile = C18_LIGHTING_PROFILE): LightEffect[] {
  if (!Array.isArray(values)) throw new Error('Lights must be an array')
  if (values.length > profile.maxEffects) throw new Error(`Lights must contain at most ${profile.maxEffects} effects`)
  return values.map(value => normalizeLightEffect(value, profile))
}

/** ObinsKit reduces a static effect to type 1 only when every key is the same color. */
export function encodeLightEffect(effect: LightEffect, profile: LightingProfile = C18_LIGHTING_PROFILE): EncodedLightEffect {
  validateType(effect.type)
  if (effect.staticColors.length !== profile.keycapCount) throw new Error(`Static lighting requires ${profile.keycapCount} key colors, got ${effect.staticColors.length}`)
  if (effect.dynamicColors.length < 1 || effect.dynamicColors.length > MAX_LIGHT_PALETTE_COLORS) throw new Error(`Dynamic palette requires 1–${MAX_LIGHT_PALETTE_COLORS} colors, got ${effect.dynamicColors.length}`)
  effect.staticColors.forEach(parseColor)
  effect.dynamicColors.forEach(parseColor)
  if (effect.type > 2) return { type: effect.type, rgb: new Uint8Array(effect.dynamicColors.flatMap(parseColor)) }
  const uniform = effect.staticColors.every(color => color.toLowerCase() === effect.staticColors[0].toLowerCase())
  if (uniform) return { type: 1, rgb: new Uint8Array(parseColor(effect.staticColors[0])) }
  const bytes = effect.staticColors.flatMap(parseColor)
  for (const blank of profile.blankRgb) bytes.splice(blank * 3, 0, 0, 0, 0)
  return { type: 2, rgb: new Uint8Array(bytes) }
}
export function encodeLightRgb(effect: LightEffect, profile: LightingProfile = C18_LIGHTING_PROFILE): Uint8Array { return encodeLightEffect(effect, profile).rgb }

function createLightRequests(action: 0x02 | 0x03, slot: number, effect: LightEffect, profile: LightingProfile): Uint8Array[] {
  if (!Number.isInteger(slot) || slot < 0 || slot > 0xff) throw new RangeError('Light slot must be 0–255')
  const encoded = encodeLightEffect(effect, profile)
  const requests: Uint8Array[] = []
  const rgbPerPacket = 51
  const packetCount = Math.ceil(encoded.rgb.byteLength / rgbPerPacket)
  const route = action === 0x03 ? 0x41 : 0x31
  for (let offset = 0, packet = 0; offset < encoded.rgb.byteLength; offset += rgbPerPacket, packet += 1) {
    const colors = encoded.rgb.slice(offset, offset + rgbPerPacket)
    const payload = new Uint8Array(2 + colors.byteLength)
    payload.set([slot, encoded.type]); payload.set(colors, 2)
    requests.push(new Uint8Array([0x7b, 0x10, route, packetCount << 4 | packet, payload.byteLength + 2, 0, 0, 0x7d, 0x20, action, ...payload]))
  }
  return requests
}
export function createPreviewLightRequests(effect: LightEffect, profile: LightingProfile = C18_LIGHTING_PROFILE): Uint8Array[] { return createLightRequests(0x03, 0xff, effect, profile) }
export function createDownloadLightRequests(slot: number, effect: LightEffect, profile: LightingProfile = C18_LIGHTING_PROFILE): Uint8Array[] {
  if (slot >= profile.maxEffects) throw new RangeError(`Light slot must be below ${profile.maxEffects}`)
  return createLightRequests(0x02, slot, effect, profile)
}
export function createWriteLightListRequest(count: number, profile: LightingProfile = C18_LIGHTING_PROFILE): Uint8Array {
  if (!Number.isInteger(count) || count < 0 || count > profile.maxEffects) throw new RangeError(`Light list count must be 0–${profile.maxEffects}`)
  return new Uint8Array([0x7b, 0x10, 0x31, 0x10, 3, 0, 0, 0x7d, 0x20, 0x04, count])
}
export function parseLightWriteAck(action: 0x02 | 0x03, packet: number, data: Uint8Array): LightWriteAck {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== action) throw new Error('Response is not the expected light write')
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0) throw new Error(`Light acknowledgement for packet ${packet} is not successful`)
  return { packet, rawFrame: data.slice(0, 8 + frame.payloadLength), trailingLength: frame.trailing.byteLength }
}
export function parseWriteLightListAck(data: Uint8Array): Uint8Array {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x04 || frame.payload.byteLength !== 1 || frame.payload[0] !== 0) throw new Error('Response is not writeLightList (20/04)')
  return frame.payload.slice()
}
