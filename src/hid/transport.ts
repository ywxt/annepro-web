import type { InputReportRecord } from './types.ts'
import {
  createReadDeviceTypeRequest,
  parseDeviceTypeResponse,
  type DeviceTypeResponse,
} from '../protocol/device-info.ts'
import {
  createReadFirmwareVersionRequest,
  parseFirmwareVersionResponse,
  type FirmwareVersions,
} from '../protocol/firmware-info.ts'

export type InputReportListener = (report: InputReportRecord) => void

/** Read-only operations only; the sole output path is the confirmed readDeviceType query. */
export class ReadonlyHidTransport {
  private listener: ((event: HIDInputReportEvent) => void) | null = null
  private confirmedReadPending = false

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
    return this.requestConfirmedRead(
      createReadDeviceTypeRequest(),
      parseDeviceTypeResponse,
      timeoutMs,
    )
  }

  async readFirmwareVersion(timeoutMs = 1500): Promise<FirmwareVersions> {
    return this.requestConfirmedRead(
      createReadFirmwareVersionRequest(),
      parseFirmwareVersionResponse,
      timeoutMs,
    )
  }

  private async requestConfirmedRead<T>(
    request: Uint8Array,
    parseResponse: (data: Uint8Array) => T,
    timeoutMs: number,
  ): Promise<T> {
    if (this.confirmedReadPending) throw new Error('Another confirmed read is already pending')
    this.confirmedReadPending = true

    return new Promise<T>((resolve, reject) => {
      const finish = (): void => {
        clearTimeout(timeout)
        this.device.removeEventListener('inputreport', onInput)
        this.confirmedReadPending = false
      }
      const onInput = (event: HIDInputReportEvent): void => {
        if (event.reportId !== 0) return
        const bytes = new Uint8Array(
          event.data.buffer.slice(event.data.byteOffset, event.data.byteOffset + event.data.byteLength),
        )
        try {
          const result = parseResponse(bytes)
          finish()
          resolve(result)
        } catch {
          // Ignore unrelated input reports while the bounded request is pending.
        }
      }
      const timeout = window.setTimeout(() => {
        finish()
        reject(new Error(`Confirmed read timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      this.device.addEventListener('inputreport', onInput)
      this.device.sendReport(0, request).catch((error: unknown) => {
        finish()
        reject(error)
      })
    })
  }
}
