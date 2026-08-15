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
  createWriteKeyboardLayerRequests,
  parseKeyboardLayerResponse,
  parseWriteKeyboardLayerAck,
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
  createPrepareMacroImageRequest,
  createDownloadMacroRequests,
  parseMacroWriteAck,
  serializeMacroImage,
  type ActiveMacroBinding,
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
import {
  createWriteHardwareSettingRequest,
  parseWriteHardwareSettingResponse,
  type HardwareSettingKey,
  type SettingWriteResult,
} from '../protocol/settings-write.ts'
import {
  createDownloadLightRequests,
  createPreviewLightRequests,
  createWriteLightListRequest,
  parseLightWriteAck,
  parseWriteLightListAck,
  type LightEffect,
} from '../protocol/lighting.ts'
import {
  createReadBatteryRequest,
  createReadPowerOnTimeRequest,
  parseBatteryResponse,
  parsePowerOnTimeResponse,
  type BatteryResponse,
  type PowerOnTimeResponse,
} from '../protocol/runtime-info.ts'
import { createAudioVisualizeRequests } from '../protocol/audio-visualize.ts'
import {
  createDeleteBleHostRequest,
  createReadBleMacRequest,
  createReadUdidRequest,
  parseBleMacResponse,
  parseDeleteBleHostAck,
  parseUdidResponse,
  type BleMacAddress,
  type DeviceUdid,
} from '../protocol/device-identity.ts'
import {
  createReadIndicatorColorRequest,
  createWriteIndicatorColorRequest,
  parseIndicatorColorResponse,
  parseWriteIndicatorColorAck,
  type IndicatorColorResponse,
} from '../protocol/indicator-color.ts'

export type InputReportListener = (report: InputReportRecord) => void

/** Typed, bounded Anne Pro operations only; no arbitrary report API is exposed. */
export class AnneProHidTransport {
  private listener: ((event: HIDInputReportEvent) => void) | null = null
  private confirmedReadPending = false

  constructor(readonly device: HIDDevice) {}

  async open(): Promise<void> {
    if (!this.device.opened) await this.device.open()
  }

  async close(): Promise<void> {
    this.stopListening()
    if (this.device.opened) await this.device.close()
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

  /** Captured, independently verified read-only query. */
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

  async readBattery(timeoutMs = 1500): Promise<BatteryResponse> {
    return this.requestConfirmedRead(createReadBatteryRequest(), parseBatteryResponse, timeoutMs)
  }

  async readPowerOnTime(timeoutMs = 1500): Promise<PowerOnTimeResponse> {
    return this.requestConfirmedRead(createReadPowerOnTimeRequest(), parsePowerOnTimeResponse, timeoutMs)
  }

  async readUdid(timeoutMs = 1500): Promise<DeviceUdid> {
    return this.requestConfirmedRead(createReadUdidRequest(), parseUdidResponse, timeoutMs)
  }

  async readBleMac(timeoutMs = 1500): Promise<BleMacAddress> {
    return this.requestConfirmedRead(createReadBleMacRequest(), parseBleMacResponse, timeoutMs)
  }

  async deleteBleHosts(timeoutMs = 1500): Promise<void> {
    return this.requestConfirmedRead(createDeleteBleHostRequest(), parseDeleteBleHostAck, timeoutMs)
  }

  async readIndicatorColor(timeoutMs = 1500): Promise<IndicatorColorResponse> {
    return this.requestConfirmedRead(createReadIndicatorColorRequest(), parseIndicatorColorResponse, timeoutMs)
  }

  async writeIndicatorColor(hex: string, timeoutMs = 1500): Promise<IndicatorColorResponse> {
    await this.requestConfirmedRead(createWriteIndicatorColorRequest(hex), parseWriteIndicatorColorAck, timeoutMs)
    const readback = await this.readIndicatorColor(timeoutMs)
    if (readback.hex.toLowerCase() !== hex.toLowerCase()) throw new Error(`Indicator color readback ${readback.hex} does not match ${hex}`)
    return readback
  }

  async writeHardwareSetting(
    key: HardwareSettingKey,
    value: number,
    timeoutMs = 1500,
  ): Promise<SettingWriteResult> {
    return this.requestConfirmedRead(
      createWriteHardwareSettingRequest(key, value),
      data => parseWriteHardwareSettingResponse(key, value, data),
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

  async writeMacros(
    macros: readonly Pick<StoredMacro, 'icon' | 'name' | 'events'>[],
    bindings: readonly ActiveMacroBinding[],
    timeoutMs = 2500,
  ): Promise<MacroBackup> {
    const image = macros.length === 0 && bindings.length === 0
      ? new Uint8Array()
      : serializeMacroImage(macros, bindings)
    await this.requestConfirmedRead(
      createPrepareMacroImageRequest(image.byteLength),
      response => parseMacroWriteAck(0x0a, response),
      timeoutMs,
    )
    for (const request of createDownloadMacroRequests(image)) {
      await this.requestConfirmedRead(
        request,
        response => parseMacroWriteAck(0x05, response),
        timeoutMs,
      )
    }
    // ObinsKit commits the staged image by toggling writeMacroFn after all chunks.
    await this.writeHardwareSetting('macroTrigger', bindings.length === 0 ? 0 : 1, timeoutMs)
    const readback = await this.readMacroBackup(timeoutMs)
    if (readback.macros.length !== macros.length || readback.activeList.length !== bindings.length) {
      throw new Error('Macro readback count does not match written image')
    }
    for (const [index, expected] of macros.entries()) {
      const actual = readback.macros[index]
      if (actual.name !== expected.name || actual.icon !== expected.icon
        || actual.events.byteLength !== expected.events.byteLength
        || !actual.events.every((value, offset) => value === expected.events[offset])) {
        throw new Error(`Macro ${index} readback does not match written data`)
      }
    }
    for (const [index, expected] of bindings.entries()) {
      const actual = readback.activeList[index]
      if (!actual || actual.layer !== expected.layer
        || actual.matrixPosition !== expected.matrixPosition
        || actual.macroIndex !== expected.macroIndex) {
        throw new Error(`Macro binding ${index} readback does not match written data`)
      }
    }
    return readback
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

  async writeKeyboardLayer(
    layer: number,
    data: Uint8Array,
    timeoutMs = 2000,
  ): Promise<KeyboardLayerResponse> {
    const requests = createWriteKeyboardLayerRequests(layer, data)
    for (const [packet, request] of requests.entries()) {
      await this.requestConfirmedRead(
        request,
        response => parseWriteKeyboardLayerAck(packet, response),
        timeoutMs,
      )
    }
    const readback = await this.readKeyboardLayer(layer, timeoutMs)
    if (!readback.data.every((value, index) => value === data[index])) {
      throw new Error(`Layer ${layer} readback does not match written data`)
    }
    return readback
  }

  /** Mirrors ObinsKit: download all four layers, then activate/reload User layout. */
  async writeKeyboardLayers(
    layers: readonly Uint8Array[],
    timeoutMs = 5000,
  ): Promise<{ layers: KeyboardLayerResponse[]; state: HardwareState }> {
    if (layers.length !== 4) throw new Error(`Expected four keyboard layers, got ${layers.length}`)
    let stage = 'preparing layout'
    try {
      for (const [layer, data] of layers.entries()) {
        const requests = createWriteKeyboardLayerRequests(layer, data)
        for (const [packet, request] of requests.entries()) {
          stage = `downloading Layer ${layer}, packet ${packet + 1}/${requests.length}`
          await this.requestConfirmedRead(
            request,
            response => parseWriteKeyboardLayerAck(packet, response),
            timeoutMs,
          )
        }
      }
      stage = 'activating User layout'
      await this.writeHardwareSetting('userLayout', 1, timeoutMs)
      await new Promise(resolve => globalThis.setTimeout(resolve, 150))
      stage = 'verifying User layout state'
      const state = await this.readHardwareState(timeoutMs)
      if (state.userLayout !== 1) throw new Error(`readback is ${state.userLayout}, expected 1`)
      const activeReadbacks: KeyboardLayerResponse[] = []
      for (const [layer, expected] of layers.entries()) {
        stage = `verifying active Layer ${layer}`
        const active = await this.readKeyboardLayer(layer, timeoutMs)
        if (!active.data.every((value, index) => value === expected[index])) {
          throw new Error('readback changed after User layout activation')
        }
        activeReadbacks.push(active)
      }
      return { layers: activeReadbacks, state }
    } catch (error) {
      throw new Error(`${stage}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
  }

  /** Preview is fire-and-forget in ObinsKit and produced no input acknowledgement on C18. */
  async previewLight(effect: LightEffect): Promise<void> {
    const requests = createPreviewLightRequests(effect)
    if (this.confirmedReadPending) throw new Error('Another HID operation is already pending')
    this.confirmedReadPending = true
    try {
      for (const request of requests) await this.device.sendReport(0, request)
    } finally {
      this.confirmedReadPending = false
    }
  }

  /** Bounded fire-and-forget frame; callers must rate-limit and await each frame. */
  async sendAudioVisualizeFrame(rgb: Uint8Array): Promise<void> {
    const requests = createAudioVisualizeRequests(rgb)
    if (this.confirmedReadPending) throw new Error('Another HID operation is already pending')
    this.confirmedReadPending = true
    try {
      for (const request of requests) await this.device.sendReport(0, request)
    } finally {
      this.confirmedReadPending = false
    }
  }

  async installLights(effects: readonly LightEffect[], timeoutMs = 2000): Promise<void> {
    await this.requestConfirmedRead(
      createWriteLightListRequest(effects.length),
      parseWriteLightListAck,
      timeoutMs,
    )
    for (const [slot, effect] of effects.entries()) {
      const requests = createDownloadLightRequests(slot, effect)
      for (const [packet, request] of requests.entries()) {
        await this.requestConfirmedRead(
          request,
          response => parseLightWriteAck(0x03, packet, response),
          timeoutMs,
        )
      }
    }
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
