<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CollectionsView from './components/CollectionsView.vue'
import DevicePanel from './components/DevicePanel.vue'
import KeyboardLayout from './components/KeyboardLayout.vue'
import LightingPanel from './components/LightingPanel.vue'
import MacroPanel from './components/MacroPanel.vue'
import ReportsView from './components/ReportsView.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import RuntimeInfoPanel from './components/RuntimeInfoPanel.vue'
import AudioVisualizePanel from './components/AudioVisualizePanel.vue'
import AdvancedAudioPanel from './components/AdvancedAudioPanel.vue'
import IdentityPanel from './components/IdentityPanel.vue'
import FactoryResetPanel from './components/FactoryResetPanel.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import PlatformRequirements from './components/PlatformRequirements.vue'
import KeyTester from './components/KeyTester.vue'
import ProtocolCoverage from './components/ProtocolCoverage.vue'
import ModelSupport from './components/ModelSupport.vue'
import IndicatorLocationPanel from './components/IndicatorLocationPanel.vue'
import OledPanel from './components/OledPanel.vue'
import VirtualMouseProbe from './components/VirtualMouseProbe.vue'
import McuUuidProbe from './components/McuUuidProbe.vue'
import { appLocale } from './i18n.ts'
import { collectMetadata } from './hid/device.ts'
import { getPreferredGrantedAnneProDevice, isWebHidSupported, requestAnneProDevice } from './hid/discovery.ts'
import type { DeviceSelection } from './hid/types.ts'
import { AnneProHidTransport } from './hid/transport.ts'
import type { InputReportRecord } from './hid/types.ts'
import { deriveDeviceCapabilities } from './protocol/capabilities.ts'
import type { DeviceTypeResponse } from './protocol/device-info.ts'
import type { FirmwareVersions } from './protocol/firmware-info.ts'
import type { IapModeResponse } from './protocol/iap-info.ts'
import type { HardwareState } from './protocol/hardware-state.ts'
import { C18_LAYOUT_SPEC, decodeLayoutKeycodes, encodeLayoutKeycodes, keyboardLayoutSpecForModel, type KeyboardLayerResponse } from './protocol/layout.ts'
import type { ActiveMacroBinding, MacroBackup, StoredMacro } from './protocol/macro-info.ts'
import type { LedPowerModeResponse } from './protocol/led-power.ts'
import type { HardwareSettingKey } from './protocol/settings-write.ts'
import { C18_LIGHTING_PROFILE, lightingProfileForModel, normalizeLightEffects, type LightEffect } from './protocol/lighting.ts'
import { bytesToHex } from './protocol/packet.ts'
import type { BatteryResponse, PowerOnTimeResponse } from './protocol/runtime-info.ts'
import { audioRgbFromFrequencyData, type AudioSource, type AudioVisualizeMode } from './protocol/audio-visualize.ts'
import type { BleMacAddress, DeviceUdid } from './protocol/device-identity.ts'
import type { IndicatorColorResponse } from './protocol/indicator-color.ts'
import type { IndicatorLocationResponse } from './protocol/indicator-location.ts'
import { annePro2FactoryLights, ANNE_PRO_2_FACTORY_SETTINGS } from './protocol/factory-defaults.ts'
import { parseFullBackup } from './protocol/full-backup.ts'
import { isKnownObinsVendor } from './device-registry.ts'
import { OBINSKIT_AUDIO_INTERVAL_MS } from './protocol/timing.ts'
import { oledDateTimeFromDate } from './protocol/oled.ts'
import type { CombinationModeResponse } from './protocol/combination-mode.ts'
import { AdvancedAudioMode } from './protocol/advanced-audio.ts'
import type { VirtualMouseConfigResponse } from './protocol/virtual-mouse.ts'
import type { McuUuidResponse } from './protocol/mcu-uuid.ts'

const supported = isWebHidSupported()
const { t } = useI18n({ useScope: 'global' })
const connecting = ref(false)
const message = ref(supported ? '' : t('app.unsupported'))
watch(appLocale, () => { message.value = supported ? '' : t('app.unsupported') })
const device = shallowRef<HIDDevice | null>(null)
const transport = shallowRef<AnneProHidTransport | null>(null)
const protocolReady = ref(false)
const busy = ref<string | null>(null)
const records = ref<InputReportRecord[]>([])
const deviceType = ref<DeviceTypeResponse | null>(null)
const firmware = ref<FirmwareVersions | null>(null)
const iap = ref<IapModeResponse | null>(null)
const hardwareState = ref<HardwareState | null>(null)
const macroBackup = ref<MacroBackup | null>(null)
const originalMacroBackup = ref<MacroBackup | null>(null)
const ledPowerMode = ref<LedPowerModeResponse | null>(null)
const battery = ref<BatteryResponse | null>(null)
const powerOnTime = ref<PowerOnTimeResponse | null>(null)
const udid = ref<DeviceUdid | null>(null)
const bleMac = ref<BleMacAddress | null>(null)
const indicatorColor = ref<IndicatorColorResponse | null>(null)
const indicatorColorBackup = ref<string | null>(null)
const tenetIndicatorColorBackup = ref<[string, string] | null>(null)
const indicatorLocation = ref<IndicatorLocationResponse | null>(null)
const combinationMode = ref<CombinationModeResponse | null>(null)
const virtualMouseConfig = ref<VirtualMouseConfigResponse | null>(null)
const mcuUuid = ref<McuUuidResponse | null>(null)
const indicatorLocationBackup = ref<number[] | null>(null)
const indicatorBrightnessBackup = ref<number | null>(null)
const audioRunning = ref(false)
const audioMode = ref<AudioVisualizeMode>('pure')
const audioSource = ref<AudioSource>('system')
const audioColor = ref('#00ff80')
const audioFrames = ref(0)
const audioLevel = ref(0)
type WorkspaceSection = 'device' | 'keys' | 'tester' | 'lighting' | 'macros' | 'oled'
const activeSection = ref<WorkspaceSection>('device')
const DEBUG_STORAGE_KEY = 'annepro-web-debug-mode'
const debugMode = ref(localStorage.getItem(DEBUG_STORAGE_KEY) === 'true')
const activeLayer = ref(0)
const layoutNotice = ref('')
const writeError = ref<{ title: string; detail: string } | null>(null)
const settingsBackup = ref<{ state: HardwareState; ledPowerMode: LedPowerModeResponse | null } | null>(null)
const layers = shallowRef<Array<KeyboardLayerResponse | null>>([null, null, null, null])
const layerDrafts = shallowRef<Array<Uint8Array | null>>([null, null, null, null])
const layerBackups = shallowRef<Array<Uint8Array | null>>([null, null, null, null])
const LIGHT_STORAGE_KEY = 'annepro-web-light-effects-v1'
const lightEffects = ref<LightEffect[]>(loadLightEffects())
const collections = computed(() => device.value ? collectMetadata(device.value.collections) : [])
const loadedLayers = computed(() => layers.value.filter((layer): layer is KeyboardLayerResponse => layer !== null))
const allLayersLoaded = computed(() => loadedLayers.value.length === 4)
const layerChangeCount = computed(() => layerDrafts.value.reduce((total, draft, layer) => {
  const saved = layers.value[layer]?.data
  if (!draft || !saved) return total
  return total + draft.reduce((count, value, index) => count + (value === saved[index] ? 0 : 1), 0)
}, 0))
const capabilities = computed(() => deriveDeviceCapabilities(deviceType.value, firmware.value))
const keyboardLayoutSpec = computed(() => deviceType.value
  ? keyboardLayoutSpecForModel(deviceType.value.model) ?? C18_LAYOUT_SPEC
  : C18_LAYOUT_SPEC)
const lightingProfile = computed(() => deviceType.value ? lightingProfileForModel(deviceType.value.model) : C18_LIGHTING_PROFILE)
const navigation = computed<Array<{ id: WorkspaceSection; label: string }>>(() => {
  const items: Array<{ id: WorkspaceSection; label: string }> = [{ id: 'device', label: t('nav.device') }]
  if (capabilities.value?.keyboardLayers) items.push({ id: 'keys', label: t('nav.keys') })
  if (capabilities.value?.keyboardLayers) items.push({ id: 'tester', label: t('nav.tester') })
  if (capabilities.value?.hasLed) items.push({ id: 'lighting', label: t('nav.lighting') })
  if (capabilities.value?.macros) items.push({ id: 'macros', label: t('nav.macros') })
  if (capabilities.value?.oled) items.push({ id: 'oled', label: t('nav.oled') })
  return items
})
const fullBackupReady = computed(() => Boolean(
  capabilities.value?.profileKnown && deviceType.value && firmware.value && hardwareState.value && macroBackup.value && allLayersLoaded.value
  && (!capabilities.value?.ledPowerMode || ledPowerMode.value)
  && (!capabilities.value?.capslockColor || indicatorColor.value),
))
let stopListening: (() => void) | null = null
let audioStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let audioTimer: number | null = null
let audioSending = false
let audioFramePromise: Promise<void> | null = null

function loadLightEffects(profile = C18_LIGHTING_PROFILE, storageKey = LIGHT_STORAGE_KEY): LightEffect[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    return normalizeLightEffects(parsed, profile)
  } catch {
    return normalizeLightEffects([{ name: 'Red', type: 1, colors: ['#ff0000'] }], profile)
  }
}

watch(deviceType, current => {
  if (!current) return
  const profile = lightingProfileForModel(current.model)
  lightEffects.value = loadLightEffects(profile, `${LIGHT_STORAGE_KEY}-model-${current.model}`)
})
watch(lightEffects, effects => {
  const storageKey = deviceType.value ? `${LIGHT_STORAGE_KEY}-model-${deviceType.value.model}` : LIGHT_STORAGE_KEY
  localStorage.setItem(storageKey, JSON.stringify(effects))
}, { deep: true })
watch(debugMode, enabled => localStorage.setItem(DEBUG_STORAGE_KEY, String(enabled)))
watch(navigation, items => {
  if (!items.some(item => item.id === activeSection.value)) activeSection.value = 'device'
})

function showWriteError(name: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  const failure = t('notice.failed', { name, error: detail })
  message.value = failure
  writeError.value = { title: t('error.writeTitle', { name }), detail }
  return failure
}

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function resetDeviceSession(): void {
  deviceType.value = null
  firmware.value = null
  iap.value = null
  hardwareState.value = null
  macroBackup.value = null
  originalMacroBackup.value = null
  ledPowerMode.value = null
  battery.value = null
  powerOnTime.value = null
  udid.value = null
  bleMac.value = null
  indicatorColor.value = null
  indicatorColorBackup.value = null
  tenetIndicatorColorBackup.value = null
  indicatorLocation.value = null
  indicatorLocationBackup.value = null
  indicatorBrightnessBackup.value = null
  combinationMode.value = null
  virtualMouseConfig.value = null
  mcuUuid.value = null
  settingsBackup.value = null
  layers.value = [null, null, null, null]
  layerDrafts.value = [null, null, null, null]
  layerBackups.value = [null, null, null, null]
  records.value = []
  activeSection.value = 'device'
  activeLayer.value = 0
  layoutNotice.value = ''
  writeError.value = null
  audioFrames.value = 0
}

async function connect(): Promise<void> {
  if (busy.value || connecting.value) return
  connecting.value = true
  message.value = t('notice.selecting')
  try {
    await useSelection(await requestAnneProDevice())
  } catch (error) {
    message.value = t('notice.failed', { name: t('app.connect'), error: error instanceof Error ? error.message : String(error) })
  } finally { connecting.value = false }
}

async function useSelection(selection: DeviceSelection): Promise<void> {
  if (!selection.device) { message.value = t('notice.noDevice'); return }
  const previous = transport.value
  const nextTransport = new AnneProHidTransport(selection.device)
  await stopAudioVisualize(false)
  await nextTransport.open()
  stopListening?.()
  if (previous && previous.device !== selection.device) await previous.close().catch(() => undefined)
  resetDeviceSession()
  device.value = selection.device
  transport.value = nextTransport
  protocolReady.value = selection.hasProtocolCollection
  stopListening = nextTransport.listen((record) => records.value.unshift(record))
  message.value = selection.hasProtocolCollection ? t('notice.connected') : t('notice.noProtocol')
  if (selection.hasProtocolCollection) await readAll()
}

async function reconnectGranted(): Promise<void> {
  if (busy.value || connecting.value) return
  connecting.value = true
  message.value = t('notice.connecting')
  try { await useSelection(await getPreferredGrantedAnneProDevice()) }
  catch (error) { message.value = t('notice.failed', { name: t('app.reconnect'), error: error instanceof Error ? error.message : String(error) }) }
  finally { connecting.value = false }
}

function onHidDisconnect(event: HIDConnectionEvent): void {
  if (event.device !== device.value) return
  void stopAudioVisualize(false)
  stopListening?.()
  stopListening = null
  transport.value = null
  protocolReady.value = false
  message.value = t('notice.disconnected')
}

function onHidConnect(event: HIDConnectionEvent): void {
  if (isKnownObinsVendor(event.device.vendorId)) message.value = t('notice.reinserted')
}

onMounted(() => {
  if (!supported) return
  navigator.hid.addEventListener('disconnect', onHidDisconnect)
  navigator.hid.addEventListener('connect', onHidConnect)
})

async function confirmedRead<T>(name: string, read: () => Promise<T>, assign: (value: T) => void): Promise<void> {
  busy.value = name
  message.value = t('notice.waiting', { name })
  try { assign(await read()); message.value = t('notice.done', { name }) }
  catch (error) { message.value = t('notice.failed', { name, error: error instanceof Error ? error.message : String(error) }) }
  finally { busy.value = null }
}

const readDeviceType = () => transport.value && confirmedRead('readDeviceType', () => transport.value!.readDeviceType(), value => { deviceType.value = value })
const readFirmware = () => transport.value && confirmedRead('readFirmwareVersion', () => transport.value!.readFirmwareVersion(), value => { firmware.value = value })
const readIap = () => transport.value && confirmedRead('readIapMode', () => transport.value!.readIapMode(), value => { iap.value = value })
function readBatteryForModel() {
  if (!transport.value) return Promise.reject(new Error('No connected device'))
  return capabilities.value?.batteryPercentage
    ? transport.value.readBatteryPercentage()
    : transport.value.readBattery()
}
async function readAll(): Promise<void> {
  if (!transport.value) return
  busy.value = 'read all'
  try {
    deviceType.value = await transport.value.readDeviceType()
    if (!capabilities.value?.profileKnown) {
      firmware.value = await transport.value.readFirmwareVersion().catch(() => null)
      iap.value = await transport.value.readIapMode().catch(() => null)
      powerOnTime.value = await transport.value.readPowerOnTime().catch(() => null)
      hardwareState.value = await transport.value.readHardwareState().catch(() => null)
      if (capabilities.value?.macros) macroBackup.value = await transport.value.readMacroBackup().catch(() => null)
      if (capabilities.value?.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode().catch(() => null)
      if (capabilities.value?.capslockColor || capabilities.value?.indicatorColors) indicatorColor.value = await transport.value.readIndicatorColor().catch(() => null)
      if (capabilities.value?.combinationMode) combinationMode.value = await transport.value.readCombinationMode().catch(() => null)
      if (capabilities.value?.hasBattery) battery.value = await readBatteryForModel().catch(() => null)
      if (capabilities.value?.bluetooth) {
        udid.value = await transport.value.readUdid().catch(() => null)
        bleMac.value = await transport.value.readBleMac().catch(() => null)
      }
      if (capabilities.value?.indicatorLocation) indicatorLocation.value = await transport.value.readIndicatorLocation().catch(() => null)
      if (capabilities.value?.keyboardLayers) {
        const nextLayers: KeyboardLayerResponse[] = []
        for (let layer = 0; layer < 4; layer += 1) nextLayers.push(await transport.value.readKeyboardLayer(layer))
        layers.value = nextLayers
        layerDrafts.value = nextLayers.map(layer => layer.data.slice())
      }
      message.value = t('notice.loaded')
      return
    }
    firmware.value = await transport.value.readFirmwareVersion()
    iap.value = await transport.value.readIapMode()
    powerOnTime.value = await transport.value.readPowerOnTime()
    udid.value = await transport.value.readUdid()
    if (capabilities.value?.hasBattery) battery.value = await readBatteryForModel()
    if (capabilities.value?.generalSettings) hardwareState.value = await transport.value.readHardwareState()
    if (capabilities.value?.bluetooth) bleMac.value = await transport.value.readBleMac()
    if (capabilities.value?.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode()
    if (capabilities.value?.capslockColor) indicatorColor.value = await transport.value.readIndicatorColor()
    if (capabilities.value?.combinationMode) combinationMode.value = await transport.value.readCombinationMode()
    if (capabilities.value?.keyboardLayers) {
      const nextLayers: KeyboardLayerResponse[] = []
      for (let layer = 0; layer < 4; layer += 1) nextLayers.push(await transport.value.readKeyboardLayer(layer))
      layers.value = nextLayers
      layerDrafts.value = nextLayers.map(layer => layer.data.slice())
    }
    if (capabilities.value?.macros) macroBackup.value = await transport.value.readMacroBackup()
    message.value = t('notice.loaded')
  } catch (error) {
    message.value = t('notice.failed', { name: t('device.refresh'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}
const readLayer = (layer: number) => transport.value && confirmedRead(
  t(`layer.${layer}`),
  () => transport.value!.readKeyboardLayer(layer),
  value => {
    const next = layers.value.slice()
    next[layer] = value
    layers.value = next
    const drafts = layerDrafts.value.slice()
    drafts[layer] = value.data.slice()
    layerDrafts.value = drafts
  },
)
const readMacroBackup = () => transport.value && confirmedRead(
  t('macro.title'),
  () => transport.value!.readMacroBackup(),
  value => { macroBackup.value = value },
)
const readHardwareState = () => transport.value && confirmedRead(
  t('settings.title'),
  () => transport.value!.readHardwareState(),
  value => { hardwareState.value = value },
)
const readCombinationMode = () => transport.value && confirmedRead(
  t('oled.combination'),
  () => transport.value!.readCombinationMode(),
  value => { combinationMode.value = value },
)
const readVirtualMouseConfig = () => transport.value && confirmedRead(
  t('virtualMouse.title'),
  () => transport.value!.readVirtualMouseConfig(),
  value => { virtualMouseConfig.value = value },
)
const readMcuUuid = () => transport.value && confirmedRead(
  t('mcuUuid.title'),
  () => transport.value!.readMcuUuid(),
  value => { mcuUuid.value = value },
)
const readLedPowerMode = () => transport.value && confirmedRead(
  t('settings.ledPower'),
  () => transport.value!.readLedPowerMode(),
  value => { ledPowerMode.value = value },
)
const readIndicatorColor = () => transport.value && confirmedRead(
  t('settings.capsColor'),
  () => transport.value!.readIndicatorColor(),
  value => { indicatorColor.value = value },
)
async function applyIndicatorColor(hex: string): Promise<void> {
  if (!transport.value || !indicatorColor.value) return
  indicatorColorBackup.value ??= indicatorColor.value.hex
  busy.value = 'write indicator color'
  try { indicatorColor.value = await transport.value.writeIndicatorColor(hex); message.value = t('notice.settingSaved', { name: t('settings.capsColor') }) }
  catch (error) { showWriteError(t('settings.capsColor'), error) }
  finally { busy.value = null }
}
async function restoreIndicatorColor(): Promise<void> {
  if (!transport.value || !indicatorColorBackup.value) return
  busy.value = 'restore indicator color'
  try { indicatorColor.value = await transport.value.writeIndicatorColor(indicatorColorBackup.value); indicatorColorBackup.value = null; message.value = t('notice.layerRestored', { name: t('settings.capsColor') }) }
  catch (error) { showWriteError(t('settings.restoreColor'), error) }
  finally { busy.value = null }
}
async function readIndicatorLocation(): Promise<void> {
  if (!transport.value) return
  busy.value = 'read indicator settings'
  try {
    indicatorLocation.value = await transport.value.readIndicatorLocation()
    if (capabilities.value?.indicatorColors) indicatorColor.value = await transport.value.readIndicatorColor()
    hardwareState.value = await transport.value.readHardwareState()
    message.value = t('notice.done', { name: t('settings.capsLed') })
  } catch (error) { message.value = t('notice.failed', { name: t('settings.capsLed'), error: error instanceof Error ? error.message : String(error) }) }
  finally { busy.value = null }
}
async function applyTenetIndicatorColors(colors: [string, string]): Promise<void> {
  if (!transport.value || !indicatorColor.value || !capabilities.value?.indicatorColors) return
  tenetIndicatorColorBackup.value ??= [...indicatorColor.value.colors] as [string, string]
  busy.value = 'write Tenet indicator colors'
  try { indicatorColor.value = await transport.value.writeTenetIndicatorColors(colors); message.value = t('notice.settingSaved', { name: t('settings.capsColor') }) }
  catch (error) { showWriteError(t('settings.capsColor'), error) }
  finally { busy.value = null }
}
async function restoreTenetIndicatorColors(): Promise<void> {
  if (!transport.value || !tenetIndicatorColorBackup.value) return
  busy.value = 'restore Tenet indicator colors'
  try { indicatorColor.value = await transport.value.writeTenetIndicatorColors(tenetIndicatorColorBackup.value); tenetIndicatorColorBackup.value = null; message.value = t('notice.settingsRestored') }
  catch (error) { showWriteError(t('settings.restoreColor'), error) }
  finally { busy.value = null }
}
async function applyIndicatorLocation(locations: number[]): Promise<void> {
  if (!transport.value || !indicatorLocation.value) return
  indicatorLocationBackup.value ??= Array.from(indicatorLocation.value.locations)
  busy.value = 'write indicator LED positions'
  try { indicatorLocation.value = await transport.value.writeIndicatorLocation(locations); message.value = t('notice.settingSaved', { name: t('settings.capsLed') }) }
  catch (error) { showWriteError(t('settings.capsLed'), error) }
  finally { busy.value = null }
}
async function restoreIndicatorLocation(): Promise<void> {
  if (!transport.value || !indicatorLocationBackup.value) return
  busy.value = 'restore indicator LED positions'
  try { indicatorLocation.value = await transport.value.writeIndicatorLocation(indicatorLocationBackup.value); indicatorLocationBackup.value = null; message.value = t('notice.settingsRestored') }
  catch (error) { showWriteError(t('settings.capsLed'), error) }
  finally { busy.value = null }
}
async function applyIndicatorBrightness(value: number): Promise<void> {
  if (!transport.value || !hardwareState.value || !capabilities.value?.hasIndicatorLed) return
  indicatorBrightnessBackup.value ??= hardwareState.value.indicatorBrightness
  busy.value = 'write indicator brightness'
  try { hardwareState.value = await transport.value.writeIndicatorBrightness(value); message.value = t('notice.settingSaved', { name: t('settings.indicatorBrightness') }) }
  catch (error) { showWriteError(t('settings.indicatorBrightness'), error) }
  finally { busy.value = null }
}
async function restoreIndicatorBrightness(): Promise<void> {
  if (!transport.value || indicatorBrightnessBackup.value === null) return
  busy.value = 'restore indicator brightness'
  try { hardwareState.value = await transport.value.writeIndicatorBrightness(indicatorBrightnessBackup.value); indicatorBrightnessBackup.value = null; message.value = t('notice.settingsRestored') }
  catch (error) { showWriteError(t('settings.indicatorBrightness'), error) }
  finally { busy.value = null }
}
async function readRuntimeInfo(): Promise<void> {
  if (!transport.value) return
  busy.value = 'runtime info'
  try {
    powerOnTime.value = await transport.value.readPowerOnTime()
    battery.value = await readBatteryForModel()
    message.value = t('notice.done', { name: t('runtime.title') })
  } catch (error) {
    message.value = t('notice.failed', { name: t('runtime.title'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function readIdentity(): Promise<void> {
  if (!transport.value) return
  busy.value = 'identity info'
  try {
    udid.value = await transport.value.readUdid()
    bleMac.value = await transport.value.readBleMac()
    message.value = t('notice.done', { name: t('identity.title') })
  } catch (error) {
    message.value = t('notice.failed', { name: t('identity.title'), error: error instanceof Error ? error.message : String(error) })
  } finally { busy.value = null }
}

async function deleteBleHosts(): Promise<void> {
  if (!transport.value) return
  const confirmation = window.prompt(t('danger.clearBle'))
  if (confirmation !== 'DELETE BLE') return
  busy.value = 'delete BLE hosts'
  try {
    await transport.value.deleteBleHosts()
    message.value = t('notice.done', { name: t('identity.clear') })
  } catch (error) {
    showWriteError(t('identity.clear'), error)
  } finally { busy.value = null }
}

async function factoryReset(): Promise<void> {
  if (!transport.value || !hardwareState.value || !capabilities.value?.profileKnown) return
  const confirmation = window.prompt(t('danger.factory'))
  if (confirmation !== 'FACTORY RESET') return
  busy.value = 'factory reset'
  try {
    settingsBackup.value ??= { state: hardwareState.value, ledPowerMode: ledPowerMode.value }
    if (capabilities.value.capslockColor && !indicatorColor.value) indicatorColor.value = await transport.value.readIndicatorColor()
    if (indicatorColor.value) indicatorColorBackup.value ??= indicatorColor.value.hex
    const currentMacros = macroBackup.value ?? await transport.value.readMacroBackup()
    macroBackup.value = currentMacros
    originalMacroBackup.value ??= cloneMacroBackup(currentMacros)
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && !capabilities.value.sleepTimeout) continue
      await transport.value.writeHardwareSetting(key, ANNE_PRO_2_FACTORY_SETTINGS[key])
    }
    if (capabilities.value.ledPowerMode) await transport.value.writeHardwareSetting('ledPowerMode', ANNE_PRO_2_FACTORY_SETTINGS.ledPowerMode)
    if (capabilities.value.capslockColor) indicatorColor.value = await transport.value.writeIndicatorColor('#ff0000')
    macroBackup.value = await transport.value.writeMacros([], [])
    const defaults = annePro2FactoryLights()
    await transport.value.installLights(defaults)
    lightEffects.value = defaults
    await transport.value.deleteBleHosts()
    const stateReadback = await transport.value.readHardwareState()
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && !capabilities.value.sleepTimeout) continue
      if (stateReadback[key] !== ANNE_PRO_2_FACTORY_SETTINGS[key]) throw new Error(t('validation.readback', { name: settingName(key), actual: stateReadback[key], expected: ANNE_PRO_2_FACTORY_SETTINGS[key] }))
    }
    hardwareState.value = stateReadback
    if (capabilities.value.ledPowerMode) {
      ledPowerMode.value = await transport.value.readLedPowerMode()
      if (ledPowerMode.value.mode !== ANNE_PRO_2_FACTORY_SETTINGS.ledPowerMode) throw new Error(t('validation.readback', { name: t('settings.ledPower'), actual: ledPowerMode.value.mode, expected: ANNE_PRO_2_FACTORY_SETTINGS.ledPowerMode }))
    }
    message.value = t('notice.done', { name: t('factory.title') })
  } catch (error) {
    showWriteError(t('factory.title'), error)
  } finally { busy.value = null }
}

const STATE_KEYS: readonly Exclude<HardwareSettingKey, 'ledPowerMode'>[] = [
  'userLayout', 'magicFn', 'macroTrigger', 'capslockLed', 'backlightBrightness',
  'ledHold', 'tapStatus', 'tapActMode', 'tapTimeoutValue', 'sleepTimeoutRaw',
]
function settingName(key: HardwareSettingKey): string {
  const names: Record<HardwareSettingKey, string> = {
    userLayout: t('settings.layout'), magicFn: 'Magic Fn', macroTrigger: t('settings.macroTrigger'),
    capslockLed: t('settings.capsLed'), backlightBrightness: t('settings.backlight'), ledHold: t('settings.autoSleep'),
    tapStatus: 'Tap', tapActMode: t('settings.tapMode'), tapTimeoutValue: t('settings.tapTime'),
    sleepTimeoutRaw: t('settings.sleepTime'), ledPowerMode: t('settings.ledPower'),
  }
  return names[key]
}
function supportsSetting(key: Exclude<HardwareSettingKey, 'ledPowerMode'>): boolean {
  if (!capabilities.value) return false
  if (key === 'ledHold') return capabilities.value.hasBattery === true
  if (key === 'sleepTimeoutRaw') return capabilities.value.sleepTimeout === true
  if (key === 'backlightBrightness' || key === 'tapActMode' || key === 'tapTimeoutValue') return capabilities.value.modernTapSettings === true
  return true
}

async function applySettings(changes: Array<{ key: HardwareSettingKey; value: number }>): Promise<void> {
  if (!transport.value || !hardwareState.value || changes.length === 0) return
  settingsBackup.value ??= { state: hardwareState.value, ledPowerMode: ledPowerMode.value }
  busy.value = 'write settings'
  try {
    for (const { key, value } of changes) await transport.value.writeHardwareSetting(key, value)
    const stateChanges = changes.filter(({ key }) => key !== 'ledPowerMode')
    const powerChange = changes.find(({ key }) => key === 'ledPowerMode')
    if (stateChanges.length) {
      const readback = await transport.value.readHardwareState()
      for (const { key, value } of stateChanges) {
        if (key === 'ledPowerMode') continue
        if (readback[key] !== value) throw new Error(t('validation.readback', { name: settingName(key), actual: readback[key], expected: value }))
      }
      hardwareState.value = readback
    }
    if (powerChange) {
      const readback = await transport.value.readLedPowerMode()
      if (readback.mode !== powerChange.value) throw new Error(t('validation.readback', { name: settingName(powerChange.key), actual: readback.mode, expected: powerChange.value }))
      ledPowerMode.value = readback
    }
    message.value = t('notice.settingsSaved', { count: changes.length })
  } catch (error) {
    showWriteError(t('settings.edit'), error)
  } finally { busy.value = null }
}

async function restoreSettings(): Promise<void> {
  if (!transport.value || !settingsBackup.value) return
  busy.value = 'restore settings'
  const backup = settingsBackup.value
  try {
    for (const key of STATE_KEYS) {
      if (!supportsSetting(key)) continue
      if (key === 'sleepTimeoutRaw' && (
        !capabilities.value?.sleepTimeout
        || backup.state.sleepTimeoutRaw < 10
        || backup.state.sleepTimeoutRaw > 3600
      )) continue
      await transport.value.writeHardwareSetting(key, backup.state[key])
    }
    if (backup.ledPowerMode && capabilities.value?.ledPowerMode) {
      await transport.value.writeHardwareSetting('ledPowerMode', backup.ledPowerMode.mode)
    }
    const readback = await transport.value.readHardwareState()
    for (const key of STATE_KEYS) {
      if (!supportsSetting(key)) continue
      if (key === 'sleepTimeoutRaw' && (
        !capabilities.value?.sleepTimeout
        || backup.state.sleepTimeoutRaw < 10
        || backup.state.sleepTimeoutRaw > 3600
      )) continue
      if (readback[key] !== backup.state[key]) throw new Error(t('validation.readback', { name: settingName(key), actual: readback[key], expected: backup.state[key] }))
    }
    hardwareState.value = readback
    if (backup.ledPowerMode) ledPowerMode.value = await transport.value.readLedPowerMode()
    settingsBackup.value = null
    message.value = t('notice.settingsRestored')
  } catch (error) {
    showWriteError(t('settings.restore'), error)
  } finally { busy.value = null }
}

function exportMetadata(): void {
  if (!device.value) return
  downloadJson(`annepro-hid-metadata-${Date.now()}.json`, { capturedAt: new Date().toISOString(), vendorId: device.value.vendorId, productId: device.value.productId, productName: device.value.productName, opened: device.value.opened, collections: collections.value })
}
function exportReports(): void {
  downloadJson(`annepro-input-reports-${Date.now()}.json`, records.value.map(record => ({ ...record, bytes: bytesToHex(record.bytes), length: record.bytes.byteLength })))
}
function exportLayers(): void {
  if (!allLayersLoaded.value || layerDrafts.value.some(layer => !layer)) return
  downloadJson(`annepro-layout-backup-${Date.now()}.json`, {
    format: 'annepro-web-layout-backup',
    version: 1,
    capturedAt: new Date().toISOString(),
    device: device.value ? { vendorId: device.value.vendorId, productId: device.value.productId, productName: device.value.productName } : null,
    model: deviceType.value?.model,
    keycodeWidth: keyboardLayoutSpec.value.keycodeWidth,
    layers: layerDrafts.value.map((data, index) => ({ index, keycodes: Array.from(decodeLayoutKeycodes(data!, keyboardLayoutSpec.value)), rawHex: bytesToHex(data!) })),
  })
}
function exportMacros(): void {
  if (!macroBackup.value) return
  downloadJson(`annepro-macro-backup-${Date.now()}.json`, {
    format: 'annepro-web-macro-backup',
    version: 1,
    capturedAt: new Date().toISOString(),
    config: { ...macroBackup.value.config, rawFrame: bytesToHex(macroBackup.value.config.rawFrame) },
    map: macroBackup.value.map.map(entry => ({ ...entry, raw: bytesToHex(entry.raw) })),
    macros: macroBackup.value.macros.map(macro => ({ ...macro, events: Array.from(macro.events), separator: Array.from(macro.separator) })),
    activeList: macroBackup.value.activeList,
  })
}

function exportFullBackup(): void {
  if (!fullBackupReady.value || !device.value || !deviceType.value || !firmware.value || !hardwareState.value || !macroBackup.value) return
  downloadJson(`annepro-full-backup-${Date.now()}.json`, {
    format: 'annepro-web-full-backup', version: 1, capturedAt: new Date().toISOString(),
    device: { vendorId: device.value.vendorId, productId: device.value.productId, productName: device.value.productName, model: deviceType.value.model, type: deviceType.value.type },
    firmware: { key: firmware.value.key, led: firmware.value.led, ble: firmware.value.ble },
    runtime: { batteryPercent: battery.value?.percent, batteryVoltage: battery.value?.voltage, powerOnHours: powerOnTime.value?.hours },
    settings: {
      ...hardwareState.value,
      rawFrame: bytesToHex(hardwareState.value.rawFrame),
      sleepTimeoutRaw: capabilities.value?.sleepTimeout && hardwareState.value.sleepTimeoutRaw >= 10 && hardwareState.value.sleepTimeoutRaw <= 3600 ? hardwareState.value.sleepTimeoutRaw : undefined,
      sleepTimeoutRawObserved: hardwareState.value.sleepTimeoutRaw,
      ledPowerMode: ledPowerMode.value?.mode,
      indicatorColor: indicatorColor.value?.hex,
    },
    layers: loadedLayers.value.map(layer => ({ index: layer.layer, keycodes: Array.from(layer.data) })),
    macros: {
      map: macroBackup.value.map.map(entry => ({ ...entry, raw: bytesToHex(entry.raw) })),
      items: macroBackup.value.macros.map(macro => ({ ...macro, events: Array.from(macro.events), separator: Array.from(macro.separator) })),
      activeList: macroBackup.value.activeList,
    },
    lights: lightEffects.value,
    privacy: { udidExcluded: true, bleMacExcluded: true },
  })
}

async function importFullBackup(file: File): Promise<void> {
  if (!transport.value || !device.value || !deviceType.value || !hardwareState.value || !macroBackup.value || !allLayersLoaded.value) return
  let stage = t('backup.parse')
  try {
    const backup = parseFullBackup(JSON.parse(await file.text()) as unknown)
    if (backup.device.model !== deviceType.value.model) throw new Error(t('backup.modelMismatch', { source: backup.device.model, current: deviceType.value.model }))
    const productWarning = backup.device.productId === device.value.productId ? '' : t('danger.pidWarning', { source: `0x${backup.device.productId.toString(16)}`, current: `0x${device.value.productId.toString(16)}` })
    const confirmation = window.prompt(t('danger.fullRestore', { count: backup.lights.length, warning: productWarning }))
    if (confirmation !== 'RESTORE FULL BACKUP') return

    settingsBackup.value ??= { state: hardwareState.value, ledPowerMode: ledPowerMode.value }
    if (indicatorColor.value) indicatorColorBackup.value ??= indicatorColor.value.hex
    originalMacroBackup.value ??= cloneMacroBackup(macroBackup.value)
    const savedLayers = layerBackups.value.slice()
    for (let index = 0; index < 4; index += 1) savedLayers[index] ??= layers.value[index]!.data.slice()
    layerBackups.value = savedLayers
    busy.value = 'restore full backup'

    stage = t('backup.layers')
    const layoutResult = await transport.value.writeKeyboardLayers(backup.layers)
    layers.value = layoutResult.layers
    layerDrafts.value = layoutResult.layers.map(layer => layer.data.slice())
    hardwareState.value = layoutResult.state

    stage = t('backup.macros')
    macroBackup.value = await transport.value.writeMacros(backup.macros, backup.bindings)

    stage = t('backup.lights')
    await transport.value.installLights(backup.lights)
    lightEffects.value = backup.lights

    stage = t('backup.settings')
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && (!capabilities.value?.sleepTimeout || backup.settings.sleepTimeoutRaw === undefined)) continue
      const value = backup.settings[key]
      if (value === undefined) continue
      await transport.value.writeHardwareSetting(key, value)
    }
    if (capabilities.value?.ledPowerMode && backup.settings.ledPowerMode !== undefined) {
      await transport.value.writeHardwareSetting('ledPowerMode', backup.settings.ledPowerMode)
    }
    if (capabilities.value?.capslockColor && backup.settings.indicatorColor) {
      indicatorColor.value = await transport.value.writeIndicatorColor(backup.settings.indicatorColor)
    }

    stage = t('backup.verify')
    const readback = await transport.value.readHardwareState()
    for (const key of STATE_KEYS) {
      if (key === 'sleepTimeoutRaw' && (!capabilities.value?.sleepTimeout || backup.settings.sleepTimeoutRaw === undefined)) continue
      if (readback[key] !== backup.settings[key]) throw new Error(t('validation.readback', { name: settingName(key), actual: readback[key], expected: backup.settings[key] }))
    }
    hardwareState.value = readback
    if (capabilities.value?.ledPowerMode && backup.settings.ledPowerMode !== undefined) {
      ledPowerMode.value = await transport.value.readLedPowerMode()
      if (ledPowerMode.value.mode !== backup.settings.ledPowerMode) throw new Error(t('validation.readback', { name: t('settings.ledPower'), actual: ledPowerMode.value.mode, expected: backup.settings.ledPowerMode }))
    }
    message.value = t('backup.restored', { file: file.name, macros: backup.macros.length, lights: backup.lights.length })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    message.value = t('backup.failed', { stage, error: detail })
    writeError.value = { title: t('error.writeTitle', { name: stage }), detail }
  } finally { busy.value = null }
}

function cloneMacroBackup(backup: MacroBackup): MacroBackup {
  return {
    config: { ...backup.config, rawFrame: backup.config.rawFrame.slice() },
    map: backup.map.map(entry => ({ ...entry, raw: entry.raw.slice() })),
    macros: backup.macros.map(macro => ({ ...macro, events: macro.events.slice(), separator: macro.separator.slice() })),
    activeList: backup.activeList.map(binding => ({ ...binding })),
  }
}

async function applyMacros(macros: StoredMacro[], bindings: ActiveMacroBinding[]): Promise<void> {
  if (!transport.value || !macroBackup.value) return
  originalMacroBackup.value ??= cloneMacroBackup(macroBackup.value)
  busy.value = 'write macros'
  try {
    macroBackup.value = await transport.value.writeMacros(macros, bindings)
    hardwareState.value = await transport.value.readHardwareState()
    message.value = t('notice.macroSaved')
  } catch (error) {
    showWriteError(t('macro.apply'), error)
  } finally { busy.value = null }
}

async function restoreMacros(): Promise<void> {
  if (!transport.value || !originalMacroBackup.value) return
  busy.value = 'restore macros'
  try {
    const backup = originalMacroBackup.value
    macroBackup.value = await transport.value.writeMacros(backup.macros, backup.activeList)
    hardwareState.value = await transport.value.readHardwareState()
    originalMacroBackup.value = null
    message.value = t('notice.macroRestored')
  } catch (error) {
    showWriteError(t('macro.restore'), error)
  } finally { busy.value = null }
}

async function importMacros(file: File): Promise<void> {
  if (!transport.value) return
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; macros?: Array<Record<string, unknown>>; activeList?: ActiveMacroBinding[] }
    if (parsed.format !== 'annepro-web-macro-backup' || !Array.isArray(parsed.macros) || !Array.isArray(parsed.activeList)) throw new Error(t('validation.format'))
    if (parsed.macros.length > 16 || parsed.activeList.length > 64) throw new Error(t('validation.macroLimit'))
    const macros: StoredMacro[] = parsed.macros.map((item, index) => {
      if (!Array.isArray(item.events) || !item.events.every(value => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255)) throw new Error(t('validation.macroEvents', { index: index + 1 }))
      const name = String(item.name ?? '')
      const icon = Number(item.icon ?? 0)
      if (name.length > 64 || !Number.isInteger(icon) || icon < 0 || icon > 65535) throw new Error(t('validation.macroMetadata', { index: index + 1 }))
      return { id: index, uuid: String(item.uuid ?? '0'), name, icon, events: new Uint8Array(item.events as number[]), separator: new Uint8Array([0, 0, 0]) }
    })
    const bindings = parsed.activeList.map((binding, index) => {
      if (![binding.layer, binding.matrixPosition, binding.macroIndex].every(Number.isInteger)
        || binding.layer < 0 || binding.layer > 3 || binding.matrixPosition < 0 || binding.matrixPosition > 255
        || binding.macroIndex < 0 || binding.macroIndex >= macros.length) throw new Error(t('validation.binding', { index: index + 1 }))
      return { ...binding }
    })
    if (!macroBackup.value) macroBackup.value = await transport.value.readMacroBackup()
    await applyMacros(macros, bindings)
  } catch (error) { message.value = t('notice.failed', { name: t('macro.import'), error: error instanceof Error ? error.message : String(error) }) }
}

async function importLayout(file: File): Promise<void> {
  if (!allLayersLoaded.value) return
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; layers?: Array<{ index?: number; keycodes?: number[] }> }
    if (parsed.format !== 'annepro-web-layout-backup' || !Array.isArray(parsed.layers) || parsed.layers.length !== 4) throw new Error(t('validation.layout'))
    const imported = Array.from({ length: 4 }, (_, index) => {
      const layer = parsed.layers!.find(candidate => candidate.index === index)
      const maximum = keyboardLayoutSpec.value.keycodeWidth === 16 ? 0xffff : 0xff
      if (!layer || !Array.isArray(layer.keycodes) || layer.keycodes.length !== keyboardLayoutSpec.value.keycapCount || !layer.keycodes.every(value => Number.isInteger(value) && value >= 0 && value <= maximum)) throw new Error(t('validation.layer', { name: t(`layer.${index}`) }))
      return encodeLayoutKeycodes(Uint16Array.from(layer.keycodes), keyboardLayoutSpec.value)
    })
    layerDrafts.value = imported
    message.value = t('notice.layersImported')
    layoutNotice.value = t('notice.layersImported')
  } catch (error) { message.value = t('notice.failed', { name: t('app.importLayers'), error: error instanceof Error ? error.message : String(error) }) }
  finally { busy.value = null }
}

function pickLayoutFile(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) void importLayout(file) }

function updateLayerDraft(layer: number, data: Uint8Array): void {
  const drafts = layerDrafts.value.slice()
  drafts[layer] = data
  layerDrafts.value = drafts
  layoutNotice.value = t('notice.layersPending', { count: layerChangeCount.value })
}

async function applyLayers(): Promise<void> {
  if (!transport.value || !allLayersLoaded.value || layerDrafts.value.some(layer => !layer)) return
  if (!hardwareState.value) { showWriteError(t('app.keyboardLayers'), new Error('Hardware state preflight is unavailable')); return }
  const drafts = layerDrafts.value as Uint8Array[]
  layerBackups.value = layers.value.map((layer, index) => layerBackups.value[index] ?? layer!.data.slice())
  busy.value = 'write all layers'
  layoutNotice.value = t('notice.layersWriting')
  try {
    const result = await transport.value.writeKeyboardLayers(drafts)
    layers.value = result.layers
    layerDrafts.value = result.layers.map(layer => layer.data.slice())
    hardwareState.value = result.state
    message.value = t('notice.layersSaved')
    layoutNotice.value = t('notice.layersSaved')
  } catch (error) {
    layoutNotice.value = showWriteError(t('app.keyboardLayers'), error)
  } finally { busy.value = null }
}

async function restoreLayers(): Promise<void> {
  if (!transport.value || layerBackups.value.some(layer => !layer)) return
  busy.value = 'restore all layers'
  try {
    const result = await transport.value.writeKeyboardLayers(layerBackups.value as Uint8Array[])
    layers.value = result.layers
    layerDrafts.value = result.layers.map(layer => layer.data.slice())
    hardwareState.value = result.state
    layerBackups.value = [null, null, null, null]
    message.value = t('notice.layersRestored')
    layoutNotice.value = t('notice.layersRestored')
  } catch (error) {
    showWriteError(t('layer.restoreAll'), error)
  } finally { busy.value = null }
}

async function previewLight(effect: LightEffect): Promise<void> {
  if (!transport.value) return
  busy.value = 'preview light'
  try {
    await transport.value.previewLight(effect)
    message.value = t('notice.previewed', { name: effect.name })
  } catch (error) {
    showWriteError(t('lighting.preview'), error)
  } finally { busy.value = null }
}

async function installLights(): Promise<void> {
  if (!transport.value || lightEffects.value.length === 0) return
  if (!window.confirm(t('danger.lights', { count: lightEffects.value.length }))) return
  busy.value = 'install lights'
  try {
    await transport.value.installLights(lightEffects.value)
    message.value = t('notice.lightsInstalled', { count: lightEffects.value.length })
  } catch (error) {
    showWriteError(t('lighting.install', { count: lightEffects.value.length }), error)
  } finally { busy.value = null }
}

function exportLights(): void {
  downloadJson(`annepro-light-profile-${Date.now()}.json`, {
    format: 'annepro-web-light-profile', version: 1, effects: lightEffects.value,
  })
}

async function importLights(file: File): Promise<void> {
  try {
    const parsed = JSON.parse(await file.text()) as { format?: string; effects?: unknown }
    if (parsed.format !== 'annepro-web-light-profile') throw new Error(t('validation.format'))
    const effects = normalizeLightEffects(parsed.effects, lightingProfile.value)
    lightEffects.value = effects
    message.value = t('notice.lightsImported', { count: effects.length })
  } catch (error) {
    message.value = t('notice.failed', { name: t('lighting.import'), error: error instanceof Error ? error.message : String(error) })
  }
}

function selectedAudioColor(): [number, number, number] {
  return [1, 3, 5].map(offset => Number.parseInt(audioColor.value.slice(offset, offset + 2), 16)) as [number, number, number]
}

async function configureAdvancedAudio(mode: AdvancedAudioMode): Promise<void> {
  if (!transport.value || !capabilities.value?.advancedAudioProtocol || !debugMode.value) return
  if (!window.confirm(t('danger.advancedAudio', { mode: t(`advancedAudio.mode.${mode}`) }))) return
  busy.value = 'configure advanced audio'
  try {
    await transport.value.configureAdvancedAudio(mode)
    message.value = t('notice.advancedAudioConfigured', { mode: t(`advancedAudio.mode.${mode}`) })
  } catch (error) {
    showWriteError(t('advancedAudio.title'), error)
  } finally { busy.value = null }
}

async function startAudioVisualize(): Promise<void> {
  if (!transport.value || audioRunning.value) return
  busy.value = 'start audio visualize'
  try {
    audioStream = audioSource.value === 'system'
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ audio: true })
    if (audioStream.getAudioTracks().length === 0) {
      audioStream.getTracks().forEach(track => track.stop())
      audioStream = null
      throw new Error(t('audio.noAudioTrack'))
    }
    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(audioStream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    const frequencies = new Uint8Array(analyser.frequencyBinCount)
    audioFrames.value = 0
    audioLevel.value = 0
    audioRunning.value = true
    audioTimer = window.setInterval(() => {
      if (!audioRunning.value || audioSending || !transport.value) return
      analyser.getByteFrequencyData(frequencies)
      audioLevel.value = Math.round(frequencies.reduce((sum, value) => sum + value, 0) / frequencies.length / 255 * 100)
      const rgb = audioRgbFromFrequencyData(audioMode.value, frequencies, selectedAudioColor())
      audioSending = true
      const framePromise = transport.value.sendAudioVisualizeFrame(rgb)
      audioFramePromise = framePromise
      framePromise
        .then(() => { audioFrames.value += 1 })
        .catch((error: unknown) => { showWriteError(t('audio.title'), error); void stopAudioVisualize(false) })
        .finally(() => {
          audioSending = false
          if (audioFramePromise === framePromise) audioFramePromise = null
        })
    }, OBINSKIT_AUDIO_INTERVAL_MS)
    message.value = t('notice.audioStarted')
  } catch (error) {
    message.value = t('notice.failed', { name: t('audio.start'), error: error instanceof Error ? error.message : String(error) })
    await stopAudioVisualize(false)
  } finally { busy.value = null }
}

async function stopAudioVisualize(restore = true): Promise<void> {
  audioRunning.value = false
  if (audioTimer !== null) window.clearInterval(audioTimer)
  audioTimer = null
  audioStream?.getTracks().forEach(track => track.stop())
  audioStream = null
  if (audioContext) await audioContext.close().catch(() => undefined)
  audioContext = null
  audioLevel.value = 0
  // The interval is single-flight, but its last ACK may still be pending when Stop is clicked.
  // Native ObinsKit serializes the restore behind that frame; do the same before previewing.
  if (restore && audioFramePromise) await audioFramePromise.catch(() => undefined)
  if (restore && transport.value && lightEffects.value[0]) {
    try { await transport.value.previewLight(lightEffects.value[0]); message.value = t('notice.audioStopped') }
    catch (error) { showWriteError(t('audio.stop'), error) }
  }
}

async function runOledWrite(name: string, write: () => Promise<void>, replaceDisplay = false): Promise<void> {
  if (!transport.value || replaceDisplay && !window.confirm(t('oled.confirm'))) return
  busy.value = name
  try { await write(); message.value = t('notice.done', { name }) }
  catch (error) { showWriteError(name, error) }
  finally { busy.value = null }
}
const syncOledDate = () => runOledWrite(t('oled.syncDate'), () => transport.value!.writeOledDateTime(oledDateTimeFromDate(new Date())))
const writeOledImage = (packed: Uint8Array) => runOledWrite(t('oled.writeImage'), () => transport.value!.writeOledImage(packed), true)
const writeOledText = (packed: Uint8Array) => runOledWrite(t('oled.writeText'), () => transport.value!.writeOledCharacter(packed), true)
const writeOledScroll = (enabled: boolean) => runOledWrite(t('oled.scroll'), () => transport.value!.writeOledScroll(enabled))
const writeOledMonitor = (values: Uint8Array) => runOledWrite(t('oled.monitor'), () => transport.value!.writeOledMonitor(values), true)

onBeforeUnmount(() => {
  void stopAudioVisualize(false)
  stopListening?.()
  if (supported) {
    navigator.hid.removeEventListener('disconnect', onHidDisconnect)
    navigator.hid.removeEventListener('connect', onHidConnect)
  }
  void transport.value?.close()
})
</script>

<template>
  <div :key="appLocale" class="app-shell">
    <aside class="app-sidebar">
      <div class="brand-mark"><span>OB</span><div><strong>ObinsLab</strong><small>Configurator</small></div></div>
      <nav v-if="device && protocolReady" class="workspace-nav" :aria-label="t('app.title')"><button v-for="item in navigation" :key="item.id" class="nav-button" :class="{ active: activeSection === item.id }" @click="activeSection = item.id"><span class="nav-icon" aria-hidden="true">{{ ({ device: '⌨', keys: '⌘', tester: '✓', lighting: '✦', macros: '◆', oled: '▰' } as const)[item.id] }}</span>{{ item.label }}</button></nav>
      <div v-else class="sidebar-empty">{{ t('shell.connectHint') }}</div>
      <div class="sidebar-footer"><label class="debug-switch"><input v-model="debugMode" type="checkbox"><span>{{ t('shell.debug') }}</span></label><LanguageSwitcher /></div>
    </aside>
    <div class="app-main">
      <div class="command-bar"><div class="device-heading"><span class="connection-dot" :class="{ online: device?.opened }"></span><div><strong>{{ device?.productName || t('shell.noDevice') }}</strong><small>{{ device ? `0x${device.vendorId.toString(16).padStart(4, '0')}:0x${device.productId.toString(16).padStart(4, '0')}` : t('shell.ready') }}</small></div></div><div class="actions"><button class="secondary compact" :disabled="!supported || connecting || busy !== null" @click="reconnectGranted">{{ t('app.reconnect') }}</button><button class="compact" :disabled="!supported || connecting || busy !== null" @click="connect">{{ t('app.connect') }}</button></div></div>
      <div v-if="!device" class="welcome"><p class="eyebrow">WEBHID CONFIGURATOR</p><h1>{{ t('app.title') }}</h1><p class="lede">{{ t('app.subtitle') }}</p></div>
      <PlatformRequirements v-if="!device" />
      <p v-if="message" id="message" role="status" aria-live="polite">{{ message }}</p>
      <div class="workspace-content">
        <IndicatorLocationPanel v-if="device && deviceType && activeSection === 'device' && capabilities?.indicatorLocation" :model-id="deviceType.model" :value="indicatorLocation" :colors="indicatorColor" :brightness="capabilities.hasIndicatorLed ? hardwareState?.indicatorBrightness ?? null : null" :busy="busy !== null" :has-backup="indicatorLocationBackup !== null" :has-brightness-backup="indicatorBrightnessBackup !== null" :has-color-backup="tenetIndicatorColorBackup !== null" @read="readIndicatorLocation" @apply="applyIndicatorLocation" @restore="restoreIndicatorLocation" @apply-brightness="applyIndicatorBrightness" @restore-brightness="restoreIndicatorBrightness" @apply-colors="applyTenetIndicatorColors" @restore-colors="restoreTenetIndicatorColors" />
        <VirtualMouseProbe v-if="device && activeSection === 'device' && debugMode && capabilities && !capabilities.profileKnown" :value="virtualMouseConfig" :busy="busy !== null" @read="readVirtualMouseConfig" />
        <McuUuidProbe v-if="device && activeSection === 'device' && debugMode && capabilities && !capabilities.profileKnown" :value="mcuUuid" :busy="busy !== null" @read="readMcuUuid" />
        <div v-if="device && activeSection === 'device'" class="device-dashboard"><DevicePanel class="dashboard-primary" :device="device" :device-type="deviceType" :firmware="firmware" :iap="iap" :capabilities="capabilities" :busy="busy" :protocol-ready="protocolReady" :full-backup-ready="fullBackupReady" :debug="debugMode" @read-all="readAll" @export-full-backup="exportFullBackup" @import-full-backup="importFullBackup" @read-device-type="readDeviceType" @read-firmware="readFirmware" @read-iap="readIap" @read-layer="readLayer" /><ModelSupport v-if="deviceType && capabilities && !capabilities.profileKnown" class="dashboard-primary" :model-id="deviceType.model" :capabilities="capabilities" /><SettingsPanel v-if="protocolReady && capabilities?.generalSettings" class="dashboard-primary" section="device" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><RuntimeInfoPanel v-if="protocolReady && capabilities?.hasBattery" :battery="battery" :power-on-time="powerOnTime" :busy="busy !== null" @read="readRuntimeInfo" /><IdentityPanel v-if="protocolReady && capabilities?.bluetooth" :udid="udid" :ble-mac="bleMac" :busy="busy !== null" @read="readIdentity" @delete-ble-hosts="deleteBleHosts" /><FactoryResetPanel v-if="protocolReady && capabilities?.factoryReset" class="dashboard-primary" :busy="busy !== null" :ready="hardwareState !== null" @reset="factoryReset" /></div>
        <section v-if="activeSection === 'keys'" class="card keys-workspace"><SettingsPanel v-if="protocolReady && capabilities?.generalSettings" class="embedded-settings" section="keys" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><div v-if="allLayersLoaded" class="layer-workspace"><div class="layer-title"><p class="eyebrow">4 LAYERS · VERIFIED WRITE</p><h2>{{ t('app.keyboardLayers') }}</h2></div><div class="layer-toolbar-row"><div class="layer-tabs"><button v-for="index in 4" :key="index" class="secondary" :class="{ active: activeLayer === index - 1 }" @click="activeLayer = index - 1">{{ t(`layer.${index - 1}`) }}</button></div><div class="actions layer-actions"><label class="file-button">{{ t('app.importLayers') }}<input type="file" accept="application/json" :disabled="busy !== null" @change="pickLayoutFile"></label><button class="secondary" @click="exportLayers">{{ t('app.exportLayers') }}</button><button v-if="layerBackups.every(layer => layer !== null)" class="secondary" :disabled="busy !== null" @click="restoreLayers">{{ t('layer.restoreAll') }}</button><button :disabled="busy !== null || layerDrafts.some(layer => !layer)" @click="applyLayers">{{ t('layer.applyAll') }}</button></div></div><div class="layout-meta"><span class="layout-status" :class="{ active: hardwareState?.userLayout === 1 }">{{ hardwareState?.userLayout === 1 ? t('layer.userActive') : t('layer.userInactive') }}</span><span>{{ t('layer.totalChanges', { count: layerChangeCount }) }}</span><span v-if="layoutNotice" role="status" aria-live="polite">{{ layoutNotice }}</span></div><KeyboardLayout v-if="layers[activeLayer] && layerDrafts[activeLayer]" :layer="layers[activeLayer]!" :draft="layerDrafts[activeLayer]!" :spec="keyboardLayoutSpec" :busy="busy !== null" @update="updateLayerDraft" /></div></section>
        <KeyTester v-if="device && protocolReady && activeSection === 'tester'" />
        <div v-if="device && protocolReady && activeSection === 'lighting'" class="feature-surface"><SettingsPanel v-if="capabilities?.generalSettings" section="lighting" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><LightingPanel v-if="capabilities?.hasLed" :effects="lightEffects" :profile="lightingProfile" :busy="busy !== null" @update="lightEffects = $event" @preview="previewLight" @install="installLights" @export="exportLights" @import="importLights" /><AudioVisualizePanel v-if="capabilities?.audioVisualization" :running="audioRunning" :mode="audioMode" :source="audioSource" :color="audioColor" :busy="busy !== null" :frames="audioFrames" :level="audioLevel" @start="startAudioVisualize" @stop="stopAudioVisualize" @update-mode="audioMode = $event" @update-source="audioSource = $event" @update-color="audioColor = $event" /><AdvancedAudioPanel v-if="debugMode && capabilities?.advancedAudioProtocol" :busy="busy !== null" @configure="configureAdvancedAudio" /></div>
        <div v-if="device && protocolReady && activeSection === 'macros' && capabilities?.macros" class="feature-surface"><SettingsPanel v-if="capabilities?.generalSettings" section="macros" :state="hardwareState" :led-power-mode="ledPowerMode" :indicator-color="indicatorColor" :capabilities="capabilities" :busy="busy !== null" :has-backup="settingsBackup !== null" :has-color-backup="indicatorColorBackup !== null" @read-state="readHardwareState" @read-led-power-mode="readLedPowerMode" @read-indicator-color="readIndicatorColor" @apply-settings="applySettings" @apply-indicator-color="applyIndicatorColor" @restore-settings="restoreSettings" @restore-indicator-color="restoreIndicatorColor" /><MacroPanel :backup="macroBackup" :busy="busy !== null" :has-backup="originalMacroBackup !== null" @read-backup="readMacroBackup" @export-backup="exportMacros" @import-backup="importMacros" @apply="applyMacros" @restore="restoreMacros" /></div>
        <OledPanel v-if="device && protocolReady && activeSection === 'oled' && capabilities?.oled" :busy="busy !== null" :debug="debugMode" :combination-mode="combinationMode" @read-combination="readCombinationMode" @sync-date="syncOledDate" @write-image="writeOledImage" @write-text="writeOledText" @scroll="writeOledScroll" @monitor="writeOledMonitor" />
        <div v-if="device && debugMode" class="debug-workspace"><div class="debug-banner"><span>DEBUG</span>{{ t('app.developerHint') }}</div><ProtocolCoverage /><CollectionsView :collections="collections" @export-metadata="exportMetadata" /><ReportsView :records="records" @clear="records = []" @export-reports="exportReports" /></div>
      </div>
      <footer>{{ t('app.footer') }}</footer>
    </div>
    <div v-if="writeError" class="modal-backdrop" @click.self="writeError = null">
      <section class="error-modal" role="alertdialog" aria-modal="true" :aria-label="writeError.title">
        <p class="eyebrow">{{ t('error.writeEyebrow') }}</p><h2>{{ writeError.title }}</h2>
        <p class="error-detail">{{ writeError.detail }}</p><p>{{ t('error.writeHelp') }}</p>
        <div class="actions"><button @click="writeError = null">{{ t('common.close') }}</button></div>
      </section>
    </div>
  </div>
</template>
