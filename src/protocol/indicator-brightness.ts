import { parseLianaFrame } from './liana.ts'

export function createWriteIndicatorBrightnessRequest(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 1 || value > 10) throw new RangeError('Indicator brightness must be an integer from 1 to 10')
  return new Uint8Array([0x7b, 0x10, 0x31, 0x10, 3, 0, 0, 0x7d, 0x20, 0x14, value])
}

/** Static D87 path: native callbacks commonly return either status 0 or the echoed value. */
export function parseWriteIndicatorBrightnessAck(value: number, data: Uint8Array): void {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x20 || frame.action !== 0x14) throw new Error('Response is not writeIndicatorBrightness (20/14)')
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0 && frame.payload[0] !== value) {
    throw new Error(`Indicator brightness acknowledgement must be 0 or ${value}`)
  }
}
