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
  keyboardLayoutSpecForModel,
  C18_LAYOUT_SPEC,
  type KeyboardLayoutSpec,
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
  C18_LIGHTING_PROFILE,
  lightingProfileForModel,
  type LightEffect,
  type LightingProfile,
} from '../protocol/lighting.ts'
import {
  createReadBatteryRequest,
  createReadBatteryPercentageRequest,
  createReadPowerOnTimeRequest,
  parseBatteryResponse,
  parseBatteryPercentageResponse,
  parsePowerOnTimeResponse,
  type BatteryResponse,
  type PowerOnTimeResponse,
} from '../protocol/runtime-info.ts'
import { createAudioVisualizeRequests, parseAudioVisualizeAck } from '../protocol/audio-visualize.ts'
import {
  createAdvancedAudioConfigRequest,
  createAdvancedAudioDataRequest,
  parseAdvancedAudioAck,
  type AdvancedAudioMode,
} from '../protocol/advanced-audio.ts'
import {
  createOledCharacterRequests,
  createOledDateTimeRequest,
  createOledImageRequests,
  createOledMonitorRequest,
  createOledScrollRequest,
  parseOledAck,
  type OledDateTime,
} from '../protocol/oled.ts'
import {
  createReadCombinationModeRequest,
  parseCombinationModeResponse,
  type CombinationModeResponse,
} from '../protocol/combination-mode.ts'
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
import {
  createReadIndicatorLocationRequest,
  createWriteIndicatorLocationRequest,
  parseIndicatorLocationResponse,
  parseWriteIndicatorLocationAck,
  type IndicatorLocationResponse,
} from '../protocol/indicator-location.ts'
import { OBINSKIT_RETRY_MS, OBINSKIT_TIMEOUT_MS } from '../protocol/timing.ts'

export type InputReportListener = (report: InputReportRecord) => void

/** Typed, bounded Anne Pro operations only; no arbitrary report API is exposed. */
export class AnneProHidTransport {
  private listener: ((event: HIDInputReportEvent) => void) | null = null
  private confirmedReadPending = false
  private layoutSpec: KeyboardLayoutSpec = C18_LAYOUT_SPEC
  private lightingProfile: LightingProfile = C18_LIGHTING_PROFILE

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
  async readDeviceType(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<DeviceTypeResponse> {
    const response = await this.requestConfirmedRead(
      createReadDeviceTypeRequest(),
      parseDeviceTypeResponse,
      timeoutMs,
    )
    this.layoutSpec = keyboardLayoutSpecForModel(response.model) ?? C18_LAYOUT_SPEC
    this.lightingProfile = lightingProfileForModel(response.model)
    return response
  }

  async readFirmwareVersion(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<FirmwareVersions> {
    return this.requestConfirmedRead(
      createReadFirmwareVersionRequest(),
      parseFirmwareVersionResponse,
      timeoutMs,
    )
  }

  async readIapMode(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<IapModeResponse> {
    return this.requestConfirmedRead(
      createReadIapModeRequest(),
      parseIapModeResponse,
      timeoutMs,
    )
  }

  async readMacroConfig(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<MacroConfigResponse> {
    return this.requestConfirmedRead(
      createReadMacroConfigRequest(),
      parseMacroConfigResponse,
      timeoutMs,
    )
  }

  async readHardwareState(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<HardwareState> {
    return this.requestConfirmedRead(
      createReadHardwareStateRequest(),
      parseHardwareStateResponse,
      timeoutMs,
    )
  }

  async readLedPowerMode(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<LedPowerModeResponse> {
    return this.requestConfirmedRead(
      createReadLedPowerModeRequest(),
      parseLedPowerModeResponse,
      timeoutMs,
    )
  }

  async readBattery(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<BatteryResponse> {
    return this.requestConfirmedRead(createReadBatteryRequest(), parseBatteryResponse, timeoutMs)
  }

  async readBatteryPercentage(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<BatteryResponse> {
    return this.requestConfirmedRead(createReadBatteryPercentageRequest(), parseBatteryPercentageResponse, timeoutMs)
  }

  async readPowerOnTime(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<PowerOnTimeResponse> {
    return this.requestConfirmedRead(createReadPowerOnTimeRequest(), parsePowerOnTimeResponse, timeoutMs)
  }

  async readCombinationMode(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<CombinationModeResponse> {
    return this.requestConfirmedRead(
      createReadCombinationModeRequest(),
      parseCombinationModeResponse,
      timeoutMs,
    )
  }

  async readUdid(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<DeviceUdid> {
    return this.requestConfirmedRead(createReadUdidRequest(), parseUdidResponse, timeoutMs)
  }

  async readBleMac(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<BleMacAddress> {
    return this.requestConfirmedRead(createReadBleMacRequest(), parseBleMacResponse, timeoutMs)
  }

  async deleteBleHosts(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    return this.requestConfirmedRead(createDeleteBleHostRequest(), parseDeleteBleHostAck, timeoutMs)
  }

  async readIndicatorColor(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<IndicatorColorResponse> {
    return this.requestConfirmedRead(createReadIndicatorColorRequest(), parseIndicatorColorResponse, timeoutMs)
  }

  async writeIndicatorColor(hex: string, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<IndicatorColorResponse> {
    await this.requestConfirmedRead(createWriteIndicatorColorRequest(hex), parseWriteIndicatorColorAck, timeoutMs)
    const readback = await this.readIndicatorColor(timeoutMs)
    if (readback.hex.toLowerCase() !== hex.toLowerCase()) throw new Error(`Indicator color readback ${readback.hex} does not match ${hex}`)
    return readback
  }

  async readIndicatorLocation(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<IndicatorLocationResponse> {
    return this.requestConfirmedRead(createReadIndicatorLocationRequest(), parseIndicatorLocationResponse, timeoutMs)
  }

  async writeIndicatorLocation(locations: readonly number[], timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<IndicatorLocationResponse> {
    await this.requestConfirmedRead(createWriteIndicatorLocationRequest(locations), parseWriteIndicatorLocationAck, timeoutMs)
    const readback = await this.readIndicatorLocation(timeoutMs)
    if (readback.locations.length !== locations.length || !readback.locations.every((value, index) => value === locations[index])) {
      throw new Error('Indicator location readback does not match written values')
    }
    return readback
  }

  async writeHardwareSetting(
    key: HardwareSettingKey,
    value: number,
    timeoutMs = OBINSKIT_TIMEOUT_MS,
  ): Promise<SettingWriteResult> {
    return this.requestConfirmedRead(
      createWriteHardwareSettingRequest(key, value),
      data => parseWriteHardwareSettingResponse(key, value, data),
      timeoutMs,
    )
  }

  async readMacroBackup(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<MacroBackup> {
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
    timeoutMs = OBINSKIT_TIMEOUT_MS,
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
  async readKeyboardLayer(layer: number, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<KeyboardLayerResponse> {
    const request = createReadKeyboardLayerRequest(layer)
    if (this.confirmedReadPending) throw new Error('Another confirmed read is already pending')
    this.confirmedReadPending = true
    const reports: Uint8Array[] = []

    return new Promise<KeyboardLayerResponse>((resolve, reject) => {
      let retry: ReturnType<typeof globalThis.setTimeout> | undefined
      const finish = (): void => {
        clearTimeout(timeout)
        if (retry !== undefined) clearTimeout(retry)
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
          const result = parseKeyboardLayerResponse(layer, reports, this.layoutSpec)
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
      const send = (): void => { this.device.sendReport(0, request).catch((error: unknown) => {
        finish()
        reject(error)
      }) }
      send()
      if (timeoutMs > OBINSKIT_RETRY_MS) retry = globalThis.setTimeout(send, OBINSKIT_RETRY_MS)
    })
  }

  async readKeyboardLayer0(timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<KeyboardLayerResponse> {
    return this.readKeyboardLayer(0, timeoutMs)
  }

  async writeKeyboardLayer(
    layer: number,
    data: Uint8Array,
    timeoutMs = OBINSKIT_TIMEOUT_MS,
  ): Promise<KeyboardLayerResponse> {
    const requests = createWriteKeyboardLayerRequests(layer, data, this.layoutSpec)
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
    timeoutMs = OBINSKIT_TIMEOUT_MS,
  ): Promise<{ layers: KeyboardLayerResponse[]; state: HardwareState }> {
    if (layers.length !== 4) throw new Error(`Expected four keyboard layers, got ${layers.length}`)
    let stage = 'preparing layout'
    try {
      for (const [layer, data] of layers.entries()) {
        const requests = createWriteKeyboardLayerRequests(layer, data, this.layoutSpec)
        for (const [packet, request] of requests.entries()) {
          stage = `downloading Layer ${layer}, packet ${packet + 1}/${requests.length}`
          await this.requestConfirmedRead(
            request,
            response => parseWriteKeyboardLayerAck(packet, response),
            timeoutMs,
          )
        }
        // ObinsKit returns the completed native queue through its callback and
        // two IPC hops before the renderer starts the next layer. Preserve a
        // small, bounded equivalent gap instead of starting the next layer in
        // the same JavaScript microtask.
      }
      stage = 'activating User layout'
      await this.writeHardwareSetting('userLayout', 1, timeoutMs)
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

  /** Native ObinsKit advances each preview packet only after a success ACK. */
  async previewLight(effect: LightEffect, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    const requests = createPreviewLightRequests(effect, this.lightingProfile)
    for (const [packet, request] of requests.entries()) {
      await this.requestConfirmedRead(
        request,
        response => parseLightWriteAck(0x03, packet, response),
        timeoutMs,
      )
    }
  }

  /** Bounded native-style ACK queue; callers must still rate-limit each frame. */
  async sendAudioVisualizeFrame(rgb: Uint8Array, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    const requests = createAudioVisualizeRequests(rgb)
    for (const request of requests) {
      await this.requestConfirmedRead(request, parseAudioVisualizeAck, timeoutMs)
    }
  }

  /** Static/native parity API. Keep capability-gated: ObinsKit 1.2.11 never invokes its data sender. */
  async configureAdvancedAudio(mode: AdvancedAudioMode, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.requestConfirmedRead(
      createAdvancedAudioConfigRequest(mode),
      response => parseAdvancedAudioAck(0x01, response),
      timeoutMs,
    )
  }

  /** Sends one bounded analyser frame; callers must provide their own single-flight/rate guard. */
  async sendAdvancedAudioData(data: Uint8Array, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.requestConfirmedRead(
      createAdvancedAudioDataRequest(data),
      response => parseAdvancedAudioAck(0x02, response),
      timeoutMs,
    )
  }

  async writeOledDateTime(value: OledDateTime, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.requestConfirmedRead(
      createOledDateTimeRequest(value),
      response => parseOledAck(0x07, response),
      timeoutMs,
    )
  }

  async writeOledScroll(enabled: boolean, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.requestConfirmedRead(
      createOledScrollRequest(enabled),
      response => parseOledAck(0x05, response),
      timeoutMs,
    )
  }

  async writeOledMonitor(values: Uint8Array, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.requestConfirmedRead(
      createOledMonitorRequest(values),
      response => parseOledAck(0x09, response),
      timeoutMs,
    )
  }

  private async writeOledBitmap(
    kind: 'image' | 'character',
    packed: Uint8Array,
    timeoutMs: number,
  ): Promise<void> {
    const action = kind === 'image' ? 0x01 : 0x08
    const requests = kind === 'image' ? createOledImageRequests(packed) : createOledCharacterRequests(packed)
    for (const request of requests) {
      await this.requestConfirmedRead(
        request,
        response => parseOledAck(action, response),
        timeoutMs,
      )
    }
  }

  /** Exactly 128 acknowledged pages, matching ObinsKit's bounded 256x32 transfer. */
  async writeOledImage(packed: Uint8Array, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.writeOledBitmap('image', packed, timeoutMs)
  }

  /** Text is rendered by the browser; the device receives the same packed bitmap shape as an image. */
  async writeOledCharacter(packed: Uint8Array, timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.writeOledBitmap('character', packed, timeoutMs)
  }

  async installLights(effects: readonly LightEffect[], timeoutMs = OBINSKIT_TIMEOUT_MS): Promise<void> {
    await this.requestConfirmedRead(
      createWriteLightListRequest(effects.length, this.lightingProfile),
      parseWriteLightListAck,
      timeoutMs,
    )
    for (const [slot, effect] of effects.entries()) {
      const requests = createDownloadLightRequests(slot, effect, this.lightingProfile)
      for (const [packet, request] of requests.entries()) {
        await this.requestConfirmedRead(
          request,
          response => parseLightWriteAck(0x02, packet, response),
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
      let retry: ReturnType<typeof globalThis.setTimeout> | undefined
      const finish = (): void => {
        clearTimeout(timeout)
        if (retry !== undefined) clearTimeout(retry)
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
      const send = (): void => { this.device.sendReport(0, request).catch((error: unknown) => {
        finish()
        reject(error)
      }) }
      send()
      if (timeoutMs > OBINSKIT_RETRY_MS) retry = globalThis.setTimeout(send, OBINSKIT_RETRY_MS)
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
      let retry: ReturnType<typeof globalThis.setTimeout> | undefined
      const finish = (): void => {
        clearTimeout(timeout)
        if (retry !== undefined) clearTimeout(retry)
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
      const send = (): void => { this.device.sendReport(0, request).catch((error: unknown) => {
        finish()
        reject(error)
      }) }
      send()
      if (timeoutMs > OBINSKIT_RETRY_MS) retry = globalThis.setTimeout(send, OBINSKIT_RETRY_MS)
    })
  }
}
