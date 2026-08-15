import type { InputReportRecord } from './types.ts'
import {
  createReadDeviceTypeRequest,
  parseDeviceTypeResponse,
  type DeviceTypeResponse,
} from '../protocol/device-info.ts'

export type InputReportListener = (report: InputReportRecord) => void

/** Read-only operations only; the sole output path is the confirmed readDeviceType query. */
export class ReadonlyHidTransport {
  private listener: ((event: HIDInputReportEvent) => void) | null = null
  private readDeviceTypePending = false

  constructor(readonly device: HIDDevice) {}

  async open(): Promise<void> {
    if (!this.device.opened) await this.device.open()
  }

  listen(onReport: InputReportListener): () => void {
    this.stopListening()
    this.listener = (event) => {
      const bytes = new Uint8Array(
        event.data.buffer.slice(event.data.byteOffset, event.data.byteOffset + event.data.byteLength),
      )
      onReport({ timestamp: new Date().toISOString(), reportId: event.reportId, bytes })
    }
    this.device.addEventListener('inputreport', this.listener)
    return () => this.stopListening()
  }

  stopListening(): void {
    if (this.listener) this.device.removeEventListener('inputreport', this.listener)
    this.listener = null
  }

  /** The only allowed output: one captured and independently verified read-only query. */
  async readDeviceType(timeoutMs = 1500): Promise<DeviceTypeResponse> {
    if (this.readDeviceTypePending) throw new Error('readDeviceType is already pending')
    this.readDeviceTypePending = true

    return new Promise<DeviceTypeResponse>((resolve, reject) => {
      const finish = (): void => {
        clearTimeout(timeout)
        this.device.removeEventListener('inputreport', onInput)
        this.readDeviceTypePending = false
      }
      const onInput = (event: HIDInputReportEvent): void => {
        if (event.reportId !== 0) return
        const bytes = new Uint8Array(
          event.data.buffer.slice(event.data.byteOffset, event.data.byteOffset + event.data.byteLength),
        )
        try {
          const result = parseDeviceTypeResponse(bytes)
          finish()
          resolve(result)
        } catch {
          // Ignore unrelated input reports while the bounded request is pending.
        }
      }
      const timeout = window.setTimeout(() => {
        finish()
        reject(new Error(`readDeviceType timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      this.device.addEventListener('inputreport', onInput)
      this.device.sendReport(0, createReadDeviceTypeRequest()).catch((error: unknown) => {
        finish()
        reject(error)
      })
    })
  }
}
