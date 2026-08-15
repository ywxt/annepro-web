const LED_COUNT = 64

export type AudioVisualizeMode = 'pure' | 'colorful'

function byte(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Audio value must be finite')
  return Math.max(0, Math.min(255, Math.round(value)))
}

export function createAudioVisualizeRequests(rgb: Uint8Array): Uint8Array[] {
  if (rgb.byteLength !== 3 && rgb.byteLength !== LED_COUNT * 3) {
    throw new Error(`Audio RGB data must contain 3 or ${LED_COUNT * 3} bytes`)
  }
  const body = new Uint8Array(2 + rgb.byteLength)
  body.set([0xff, rgb.byteLength === 3 ? 1 : 2])
  body.set(rgb, 2)
  const requests: Uint8Array[] = []
  for (let offset = 0, packet = 0; offset < body.byteLength; offset += 54, packet += 1) {
    const payload = body.slice(offset, offset + 54)
    const more = offset + payload.byteLength < body.byteLength
    requests.push(new Uint8Array([
      0x7b, 0x12, 0x31, packet | (more ? 0x80 : 0),
      payload.byteLength + 2, 0, 0, 0x7d, 0x20, 0x11, ...payload,
    ]))
  }
  return requests
}

function hsv(hue: number, saturation: number, value: number): [number, number, number] {
  const section = ((hue % 360) + 360) % 360 / 60
  const chroma = value * saturation
  const x = chroma * (1 - Math.abs(section % 2 - 1))
  const m = value - chroma
  const [r, g, b] = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0]
    : section < 3 ? [0, chroma, x] : section < 4 ? [0, x, chroma]
      : section < 5 ? [x, 0, chroma] : [chroma, 0, x]
  return [byte((r + m) * 255), byte((g + m) * 255), byte((b + m) * 255)]
}

export function audioRgbFromFrequencyData(
  mode: AudioVisualizeMode,
  frequencyData: Uint8Array,
  pureColor: readonly [number, number, number],
): Uint8Array {
  if (frequencyData.byteLength === 0) throw new Error('Frequency data is empty')
  const level = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.byteLength / 255
  if (mode === 'pure') return new Uint8Array(pureColor.map(value => byte(value * level)))
  const result = new Uint8Array(LED_COUNT * 3)
  for (let led = 0; led < LED_COUNT; led += 1) {
    const bin = Math.min(frequencyData.byteLength - 1, Math.floor(led / LED_COUNT * frequencyData.byteLength))
    result.set(hsv(led / LED_COUNT * 360, 1, frequencyData[bin] / 255), led * 3)
  }
  return result
}
