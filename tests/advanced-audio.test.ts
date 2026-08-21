import { describe, expect, it } from 'vitest'
import {
  AdvancedAudioMode,
  createAdvancedAudioConfigRequest,
  createAdvancedAudioDataRequest,
  parseAdvancedAudioAck,
} from '../src/protocol/advanced-audio.ts'

describe('advanced MCU-LED audio protocol', () => {
  it('encodes the renderer mode as native writeAudioVisualConfig 21/01', () => {
    expect(Array.from(createAdvancedAudioConfigRequest(AdvancedAudioMode.Spectrum))).toEqual([
      0x7b, 0x10, 0x41, 0x10, 3, 0, 0, 0x7d, 0x21, 0x01, 5,
    ])
  })

  it('encodes one native writeAudioVisualData 21/02 buffer', () => {
    expect(Array.from(createAdvancedAudioDataRequest(new Uint8Array([20, 4, 1, 2])))).toEqual([
      0x7b, 0x10, 0x41, 0x10, 6, 0, 0, 0x7d, 0x21, 0x02, 20, 4, 1, 2,
    ])
  })

  it('enforces enum and single-report bounds', () => {
    expect(() => createAdvancedAudioConfigRequest(11 as AdvancedAudioMode)).toThrow('0 to 10')
    expect(() => createAdvancedAudioDataRequest(new Uint8Array())).toThrow('1 to 53')
    expect(() => createAdvancedAudioDataRequest(new Uint8Array(54))).toThrow('1 to 53')
  })

  it('requires a matching success acknowledgement', () => {
    const ack = new Uint8Array([0x7b, 0x10, 0x14, 0x10, 3, 0, 0, 0x7d, 0x21, 0x02, 0])
    expect(parseAdvancedAudioAck(0x02, ack)).toBeUndefined()
    ack[9] = 1
    expect(() => parseAdvancedAudioAck(0x02, ack)).toThrow('21/02')
  })
})
