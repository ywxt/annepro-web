import { describe, expect, it } from 'vitest'
import { ReadonlyHidTransport } from '../src/hid/transport.ts'

function frame(packet: number, payload: number[]): Uint8Array {
  return new Uint8Array([
    0x7b, 0x12, 0x13, packet, payload.length + 2, 0x00, 0x00, 0x7d,
    0x10, 0x02, ...payload,
  ])
}

class FakeHidDevice {
  opened = true
  sent: Array<{ reportId: number, data: Uint8Array }> = []
  private listeners = new Set<(event: HIDInputReportEvent) => void>()

  addEventListener(_type: string, listener: (event: HIDInputReportEvent) => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: (event: HIDInputReportEvent) => void): void {
    this.listeners.delete(listener)
  }

  async sendReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
    this.sent.push({ reportId, data: bytes })
    const all = Array.from({ length: 61 }, (_, index) => index)
    queueMicrotask(() => {
      this.emit(frame(0x80, all.slice(0, 54)))
      this.emit(new Uint8Array([...frame(0x01, all.slice(54)), 0xaa, 0xbb]))
    })
  }

  private emit(bytes: Uint8Array): void {
    const event = { reportId: 0, data: new DataView(bytes.buffer) } as HIDInputReportEvent
    for (const listener of this.listeners) listener(event)
  }
}

describe('read-only HID transport', () => {
  it('sends the fixed Layer 0 request once and assembles exactly two reports', async () => {
    const device = new FakeHidDevice()
    const transport = new ReadonlyHidTransport(device as unknown as HIDDevice)
    const result = await transport.readKeyboardLayer0(100)

    expect(device.sent).toHaveLength(1)
    expect(device.sent[0].reportId).toBe(0)
    expect(Array.from(device.sent[0].data)).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x10, 0x02, 0x00,
    ])
    expect(result.packetCount).toBe(2)
    expect(Array.from(result.data)).toEqual(Array.from({ length: 61 }, (_, index) => index))
  })
})
