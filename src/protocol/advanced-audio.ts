import { parseLianaFrame } from './liana.ts'

/** Exact AudioLightType enum exported by ObinsKit 1.2.11 module 50585. */
export enum AdvancedAudioMode {
  Reserved = 0,
  Pure = 1,
  Colorful = 2,
  Scroll = 3,
  Energy = 4,
  Spectrum = 5,
  Original = 6,
  Fft = 7,
  Wallpaper = 8,
  ScrollRms1024 = 9,
  ScrollRmsEnvelope = 10,
}

const MAX_DATA_BYTES = 53

function createRequest(action: 0x01 | 0x02, payload: Uint8Array): Uint8Array {
  return new Uint8Array([
    0x7b, 0x10, 0x41, 0x10, payload.byteLength + 2, 0, 0, 0x7d,
    0x21, action, ...payload,
  ])
}

export function createAdvancedAudioConfigRequest(mode: AdvancedAudioMode): Uint8Array {
  if (!Number.isInteger(mode) || mode < AdvancedAudioMode.Reserved || mode > AdvancedAudioMode.ScrollRmsEnvelope) {
    throw new RangeError('Advanced audio mode must be an ObinsKit AudioLightType value from 0 to 10')
  }
  return createRequest(0x01, new Uint8Array([mode]))
}

/**
 * Encodes the native writeAudioVisualData buffer as one HID report.
 * ObinsKit's analysed frames are 18 bytes; 53 is the protocol/report ceiling.
 */
export function createAdvancedAudioDataRequest(data: Uint8Array): Uint8Array {
  if (data.byteLength === 0 || data.byteLength > MAX_DATA_BYTES) {
    throw new RangeError(`Advanced audio data must contain 1 to ${MAX_DATA_BYTES} bytes`)
  }
  return createRequest(0x02, data)
}

export function parseAdvancedAudioAck(action: 0x01 | 0x02, data: Uint8Array): void {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x21 || frame.action !== action) {
    throw new Error(`Response is not advanced audio 21/${action.toString(16).padStart(2, '0')}`)
  }
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0) {
    throw new Error('Advanced audio command did not return success status 0')
  }
}
