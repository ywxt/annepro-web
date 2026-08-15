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
import {
  createReadIapModeRequest,
  parseIapModeResponse,
  type IapModeResponse,
} from '../protocol/iap-info.ts'
import {
  createReadKeyboardLayerRequest,
  parseKeyboardLayerResponse,
  type KeyboardLayerResponse,
} from '../protocol/layout.ts'
import { tryParseLianaFrame } from '../protocol/liana.ts'
import {
  createReadMacroConfigRequest,
  createReadMacroActiveListRequest,
  createReadMacroMapRequest,
  createReadMacroRequest,
  parseMacroActiveListResponse,
  parseMacroConfigResponse,
  parseMacroMapResponse,
  parseStoredMacro,
  type MacroBackup,
  type MacroConfigResponse,
  type StoredMacro,
} from '../protocol/macro-info.ts'
import {
  createReadHardwareStateRequest,
  parseHardwareStateResponse,
  type HardwareState,
} from '../protocol/hardware-state.ts'
import {
  createReadLedPowerModeRequest,
  parseLedPowerModeResponse,
  type LedPowerModeResponse,
} from '../protocol/led-power.ts'

export type InputReportListener = (report: InputReportRecord) => void

/** Fixed, captured read-only operations only; no arbitrary report API is exposed. */
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

  async readIapMode(timeoutMs = 1500): Promise<IapModeResponse> {
    return this.requestConfirmedRead(
      createReadIapModeRequest(),
      parseIapModeResponse,
      timeoutMs,
    )
  }

  async readMacroConfig(timeoutMs = 1500): Promise<MacroConfigResponse> {
    return this.requestConfirmedRead(
      createReadMacroConfigRequest(),
      parseMacroConfigResponse,
      timeoutMs,
    )
  }

  async readHardwareState(timeoutMs = 1500): Promise<HardwareState> {
    return this.requestConfirmedRead(
      createReadHardwareStateRequest(),
      parseHardwareStateResponse,
      timeoutMs,
    )
  }

  async readLedPowerMode(timeoutMs = 1500): Promise<LedPowerModeResponse> {
    return this.requestConfirmedRead(
      createReadLedPowerModeRequest(),
      parseLedPowerModeResponse,
      timeoutMs,
    )
  }

  async readMacroBackup(timeoutMs = 2000): Promise<MacroBackup> {
    const config = await this.readMacroConfig(timeoutMs)
    if (!config.hasMacros) return { config, map: [], macros: [], activeList: [] }

    const map = await this.requestConfirmedMultipart(
      createReadMacroMapRequest(), 0x30, 0x08, parseMacroMapResponse, timeoutMs,
    )
    if (map.length > 64) throw new Error(`Refusing implausible macro map with ${map.length} entries`)
    const macros: StoredMacro[] = []
    for (const entry of map) {
      macros.push(await this.requestConfirmedMultipart(
        createReadMacroRequest(entry.index),
        0x30,
        0x09,
        (reports) => parseStoredMacro(entry, reports),
        timeoutMs,
      ))
    }
    const activeList = await this.requestConfirmedMultipart(
      createReadMacroActiveListRequest(),
      0x30,
      0x07,
      parseMacroActiveListResponse,
      timeoutMs,
    )
    return { config, map, macros, activeList }
  }

  /** All four C18 layer indices have been independently confirmed on physical hardware. */
  async readKeyboardLayer(layer: number, timeoutMs = 2000): Promise<KeyboardLayerResponse> {
    const request = createReadKeyboardLayerRequest(layer)
    if (this.confirmedReadPending) throw new Error('Another confirmed read is already pending')
    this.confirmedReadPending = true
    const reports: Uint8Array[] = []

    return new Promise<KeyboardLayerResponse>((resolve, reject) => {
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
        const frame = tryParseLianaFrame(bytes)
        if (!frame || frame.command !== 0x10 || frame.action !== 0x02) return
        reports.push(bytes)
        try {
          const result = parseKeyboardLayerResponse(layer, reports)
          finish()
          resolve(result)
        } catch {
          // The first confirmed response has its continuation bit set; await packet 01.
        }
      }
      const timeout = globalThis.setTimeout(() => {
        finish()
        reject(new Error(`Confirmed Layer ${layer} read timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      this.device.addEventListener('inputreport', onInput)
      this.device.sendReport(0, request).catch((error: unknown) => {
        finish()
        reject(error)
      })
    })
  }

  async readKeyboardLayer0(timeoutMs = 2000): Promise<KeyboardLayerResponse> {
    return this.readKeyboardLayer(0, timeoutMs)
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
      const timeout = globalThis.setTimeout(() => {
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

  private async requestConfirmedMultipart<T>(
    request: Uint8Array,
    command: number,
    action: number,
    parseResponse: (reports: readonly Uint8Array[]) => T,
    timeoutMs: number,
  ): Promise<T> {
    if (this.confirmedReadPending) throw new Error('Another confirmed read is already pending')
    this.confirmedReadPending = true
    const reports: Uint8Array[] = []

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
        const frame = tryParseLianaFrame(bytes)
        if (!frame || frame.command !== command || frame.action !== action) return
        reports.push(bytes)
        try {
          const result = parseResponse(reports)
          finish()
          resolve(result)
        } catch {
          // Continue until the final indexed packet makes the strict parser succeed.
        }
      }
      const timeout = globalThis.setTimeout(() => {
        finish()
        reject(new Error(`Confirmed multipart read timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      this.device.addEventListener('inputreport', onInput)
      this.device.sendReport(0, request).catch((error: unknown) => {
        finish()
        reject(error)
      })
    })
  }
}
