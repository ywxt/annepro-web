import { describe, expect, it } from 'vitest'
import { AnneProHidTransport } from '../src/hid/transport.ts'

function frame(packet: number, payload: number[]): Uint8Array {
  return new Uint8Array([
    0x7b, 0x12, 0x13, packet, payload.length + 2, 0x00, 0x00, 0x7d,
    0x10, 0x02, ...payload,
  ])
}

class FakeHidDevice {
  opened = true
  sent: Array<{ reportId: number, data: Uint8Array }> = []
  protected listeners = new Set<(event: HIDInputReportEvent) => void>()

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

class MacroConfigHidDevice extends FakeHidDevice {
  override async sendReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
    this.sent.push({ reportId, data: bytes })
    const responseBytes = new Uint8Array([
      0x7b, 0x12, 0x13, 0x00, 0x04, 0x00, 0x00, 0x7d, 0x30, 0x06, 0x00, 0x00,
    ])
    queueMicrotask(() => {
      const event = {
        reportId: 0,
        data: new DataView(responseBytes.buffer),
      } as HIDInputReportEvent
      for (const listener of this.listeners) listener(event)
    })
  }
}

class LedPowerHidDevice extends FakeHidDevice {
  override async sendReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
    this.sent.push({ reportId, data: bytes })
    queueMicrotask(() => {
      this.emitReport(new Uint8Array([
        0x7b, 0x12, 0x13, 0, 3, 0, 0, 0x7d, 0x20, 0x1e, 2,
      ]))
    })
  }

  private emitReport(bytes: Uint8Array): void {
    const event = { reportId: 0, data: new DataView(bytes.buffer) } as HIDInputReportEvent
    for (const listener of this.listeners) listener(event)
  }
}

class LightPreviewHidDevice extends FakeHidDevice {
  override async sendReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
    this.sent.push({ reportId, data: bytes })
    queueMicrotask(() => {
      const ack = new Uint8Array([
        0x7b, 0x10, 0x14, 0x10, 3, 0, 0, 0x7d, 0x20, 0x03, 0,
      ])
      const event = { reportId: 0, data: new DataView(ack.buffer) } as HIDInputReportEvent
      for (const listener of this.listeners) listener(event)
    })
  }
}

class AudioVisualizeHidDevice extends FakeHidDevice {
  override async sendReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
    this.sent.push({ reportId, data: bytes })
    queueMicrotask(() => {
      const ack = new Uint8Array([
        0x7b, 0x10, 0x14, 0x10, 3, 0, 0, 0x7d, 0x20, 0x11, 0,
      ])
      const event = { reportId: 0, data: new DataView(ack.buffer) } as HIDInputReportEvent
      for (const listener of this.listeners) listener(event)
    })
  }
}

class LayerWriteHidDevice extends FakeHidDevice {
  private staged = new Map<number, number[]>()

  override async sendReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
    this.sent.push({ reportId, data: bytes })
    const command = bytes[8]
    const action = bytes[9]
    queueMicrotask(() => {
      if (command === 0x10 && action === 0x01) {
        const packet = bytes[3] & 0x0f
        const payload = Array.from(bytes.slice(10, 8 + bytes[4]))
        const layer = payload[0]
        if (packet === 0) this.staged.set(layer, payload.slice(1))
        else {
          const current = this.staged.get(layer)
          if (current) this.staged.set(layer, [...current, ...payload.slice(1)])
        }
        this.emitFrame(0x10, 0x01, [0], 0x10, 0x10)
      } else if (command === 0x10 && action === 0x02) {
        const layer = bytes[10]
        const data = this.staged.get(layer) ?? []
        this.emitFrame(0x10, 0x02, data.slice(0, 54), 0x80)
        this.emitFrame(0x10, 0x02, data.slice(54), 0x01)
      } else if (command === 0x10 && action === 0x06) {
        this.emitFrame(0x10, 0x06, [0], 0x10, 0x10)
      } else if (command === 0x01 && action === 0x09) {
        const state = Array(24).fill(0)
        state[12] = 1
        this.emitFrame(0x01, 0x09, state)
      }
    })
  }

  private emitFrame(command: number, action: number, payload: number[], packet = 0, protocol = 0x12): void {
    const bytes = new Uint8Array([0x7b, protocol, 0x13, packet, payload.length + 2, 0, 0, 0x7d, command, action, ...payload])
    const event = { reportId: 0, data: new DataView(bytes.buffer) } as HIDInputReportEvent
    for (const listener of this.listeners) listener(event)
  }
}

describe('typed Anne Pro HID transport', () => {
  it('sends the fixed Layer 0 request once and assembles exactly two reports', async () => {
    const device = new FakeHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    const result = await transport.readKeyboardLayer0(100)

    expect(device.sent).toHaveLength(1)
    expect(device.sent[0].reportId).toBe(0)
    expect(Array.from(device.sent[0].data)).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x03, 0x00, 0x00, 0x7d, 0x10, 0x02, 0x00,
    ])
    expect(result.packetCount).toBe(2)
    expect(Array.from(result.data)).toEqual(Array.from({ length: 61 }, (_, index) => index))
  })

  it('uses only a validated layer index in the fixed request', async () => {
    const device = new FakeHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    const result = await transport.readKeyboardLayer(3, 100)
    expect(device.sent[0].data.at(-1)).toBe(3)
    expect(result.layer).toBe(3)
    await expect(transport.readKeyboardLayer(4, 100)).rejects.toThrow(RangeError)
    expect(device.sent).toHaveLength(1)
  })

  it('writes and verifies all layers before reloading User layout', async () => {
    const device = new LayerWriteHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    const layers = Array.from({ length: 4 }, (_, layer) => new Uint8Array(Array.from({ length: 61 }, (_, key) => layer * 61 + key & 0xff)))
    const result = await transport.writeKeyboardLayers(layers, 100)
    expect(result.layers.map(layer => Array.from(layer.data))).toEqual(layers.map(layer => Array.from(layer)))
    expect(result.state.userLayout).toBe(1)
    const layoutWrites = device.sent.slice(0, 8).map(({ data }) => [data[1], data[3], data[10]])
    expect(layoutWrites).toEqual([
      [0x10, 0x20, 0], [0x10, 0x21, 0],
      [0x10, 0x20, 1], [0x10, 0x21, 1],
      [0x10, 0x20, 2], [0x10, 0x21, 2],
      [0x10, 0x20, 3], [0x10, 0x21, 3],
    ])
    expect(device.sent.map(({ data }) => [data[8], data[9]])).toEqual([
      [0x10, 0x01], [0x10, 0x01],
      [0x10, 0x01], [0x10, 0x01],
      [0x10, 0x01], [0x10, 0x01],
      [0x10, 0x01], [0x10, 0x01],
      [0x10, 0x06], [0x01, 0x09],
      [0x10, 0x02], [0x10, 0x02], [0x10, 0x02], [0x10, 0x02],
    ])
    await expect(transport.writeKeyboardLayers(layers.slice(0, 3), 100)).rejects.toThrow('Expected four')
  })

  it('identifies the exact layout stage when a confirmed read times out', async () => {
    class SilentHidDevice extends FakeHidDevice {
      override async sendReport(reportId: number, data: BufferSource): Promise<void> {
        const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
        this.sent.push({ reportId, data: bytes })
      }
    }
    const transport = new AnneProHidTransport(new SilentHidDevice() as unknown as HIDDevice)
    const layers = Array.from({ length: 4 }, () => new Uint8Array(61))
    await expect(transport.writeKeyboardLayers(layers, 5)).rejects.toThrow(
      'downloading Layer 0, packet 1/2: Confirmed read timed out after 5 ms',
    )
  })

  it('sends only the fixed macro-config query', async () => {
    const device = new MacroConfigHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    const result = await transport.readMacroConfig(100)
    expect(Array.from(device.sent[0].data)).toEqual([
      0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x30, 0x06,
    ])
    expect(result.hasMacros).toBe(false)
  })

  it('short-circuits a complete macro backup when config reports empty', async () => {
    const device = new MacroConfigHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    const backup = await transport.readMacroBackup(100)
    expect(device.sent).toHaveLength(1)
    expect(backup).toMatchObject({ map: [], macros: [], activeList: [] })
  })

  it('sends only the captured LED power-mode read', async () => {
    const device = new LedPowerHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    const result = await transport.readLedPowerMode(100)
    expect(device.sent).toHaveLength(1)
    expect(Array.from(device.sent[0].data)).toEqual([
      0x7b, 0x12, 0x31, 0, 2, 0, 0, 0x7d, 0x20, 0x1e,
    ])
    expect(result).toMatchObject({ mode: 2, modeName: 'High' })
  })

  it('waits for every native light-preview packet acknowledgement', async () => {
    const device = new LightPreviewHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    const staticColors = Array(61).fill('#112233'); staticColors[1] = '#445566'
    await transport.previewLight({ name: 'Keys', type: 2, staticColors, dynamicColors: ['#ff0000'] }, 100)
    expect(device.sent).toHaveLength(5)
    expect(device.sent.map(({ data }) => data[3])).toEqual([0x50, 0x51, 0x52, 0x53, 0x54])
    expect(device.sent.every(({ data }) => data[1] === 0x10 && data[2] === 0x41
      && data[8] === 0x20 && data[9] === 0x03 && data[10] === 0xff && data[11] === 2)).toBe(true)
  })

  it('waits for every native audio-visualize packet acknowledgement', async () => {
    const device = new AudioVisualizeHidDevice()
    const transport = new AnneProHidTransport(device as unknown as HIDDevice)
    await transport.sendAudioVisualizeFrame(new Uint8Array(192), 100)
    expect(device.sent).toHaveLength(4)
    expect(device.sent.map(({ data }) => data[3])).toEqual([0x40, 0x41, 0x42, 0x43])
    expect(device.sent.every(({ data }) => data[1] === 0x10 && data[2] === 0x41
      && data[8] === 0x20 && data[9] === 0x11 && data[10] === 0xff && data[11] === 2)).toBe(true)
  })

  it('times out after ignoring mismatched replies and releases the single-flight guard', async () => {
    class MismatchDevice extends FakeHidDevice {
      override async sendReport(reportId: number, data: BufferSource): Promise<void> {
        const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data as ArrayBuffer)
        this.sent.push({ reportId, data: bytes })
        queueMicrotask(() => this.emitMismatch())
      }
      private emitMismatch(): void {
        const bytes = new Uint8Array([0x7b,0x12,0x13,0,4,0,0,0x7d,1,1,5,1])
        const event = { reportId: 0, data: new DataView(bytes.buffer) } as HIDInputReportEvent
        for (const listener of this.listeners) listener(event)
      }
    }
    const transport = new AnneProHidTransport(new MismatchDevice() as unknown as HIDDevice)
    const pending = transport.readFirmwareVersion(10)
    await expect(transport.readDeviceType(10)).rejects.toThrow('already pending')
    await expect(pending).rejects.toThrow('timed out')
    await expect(transport.readFirmwareVersion(5)).rejects.toThrow('timed out')
  })
})
