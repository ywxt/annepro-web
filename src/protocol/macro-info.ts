import { parseLianaFrame } from './liana.ts'
import { assembleLianaPayload } from './multipart.ts'

const READ_MACRO_CONFIG_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x30, 0x06,
])

function readRequest(action: number, argument?: number): Uint8Array {
  const payloadLength = argument === undefined ? 2 : 3
  return new Uint8Array([
    0x7b, 0x12, 0x31, 0x00, payloadLength, 0x00, 0x00, 0x7d,
    0x30, action, ...(argument === undefined ? [] : [argument]),
  ])
}

function uint16Le(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8)
}

function uint32Le(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16)
    | (data[offset + 3] << 24)) >>> 0
}

function decodeUtf16Be(data: Uint8Array): string {
  if (data.byteLength % 2 !== 0) throw new Error('Macro alias must contain UTF-16BE pairs')
  let result = ''
  for (let index = 0; index < data.byteLength; index += 2) {
    result += String.fromCharCode((data[index] << 8) | data[index + 1])
  }
  return result
}

export interface MacroConfigResponse {
  storedMacroCount: number
  unknownByte: number
  hasMacros: boolean
  rawFrame: Uint8Array
  trailingLength: number
}

export interface MacroMapEntry {
  index: number
  uuid: string
  address: number
  macroLength: number
  aliasLength: number
  icon: number
  raw: Uint8Array
}

export interface StoredMacro {
  id: number
  uuid: string
  icon: number
  name: string
  events: Uint8Array
  separator: Uint8Array
}

export interface ActiveMacroBinding {
  layer: number
  matrixPosition: number
  macroIndex: number
}

export type MacroEventType = 1 | 2 | 3 | 4 | 5

export interface MacroEvent {
  type: MacroEventType
  value: number
}

export interface MacroBackup {
  config: MacroConfigResponse
  map: MacroMapEntry[]
  macros: StoredMacro[]
  activeList: ActiveMacroBinding[]
}

export function createReadMacroConfigRequest(): Uint8Array {
  return READ_MACRO_CONFIG_REQUEST.slice()
}

export function createReadMacroMapRequest(): Uint8Array {
  return readRequest(0x08)
}

export function createReadMacroActiveListRequest(): Uint8Array {
  return readRequest(0x07)
}

export function createReadMacroRequest(index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index > 0xff) {
    throw new RangeError('Macro index must be an integer from 0 to 255')
  }
  return readRequest(0x09, index)
}

export function parseMacroConfigResponse(data: Uint8Array): MacroConfigResponse {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x30 || frame.action !== 0x06) {
    throw new Error('Response is not readMacroConfig (30/06)')
  }
  if (frame.payload.byteLength !== 2) {
    throw new Error(`readMacroConfig payload must be 2 bytes, got ${frame.payload.byteLength}`)
  }
  return {
    storedMacroCount: frame.payload[0],
    unknownByte: frame.payload[1],
    hasMacros: frame.payload[0] !== 0,
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}

function uint16Bytes(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff]
}

function uint32Bytes(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
}

function encodeUtf16Be(value: string): number[] {
  const result: number[] = []
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    result.push(unit >>> 8, unit & 0xff)
  }
  return result
}

/** CRC-32/ISO-HDLC, matching the `crc` package used by ObinsKit 1.2.11. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function macroUuid(events: Uint8Array): number {
  return crc32(new TextEncoder().encode(JSON.stringify(Array.from(events))))
}

export function decodeMacroEvents(events: Uint8Array): MacroEvent[] {
  if (events.byteLength % 3 !== 0) throw new Error('Macro events must contain three-byte records')
  const result: MacroEvent[] = []
  for (let offset = 0; offset < events.byteLength; offset += 3) {
    const type = events[offset]
    if (type < 1 || type > 5) throw new Error(`Unknown macro event type ${type}`)
    result.push({ type: type as MacroEventType, value: uint16Le(events, offset + 1) })
  }
  return result
}

export function encodeMacroEvents(events: readonly MacroEvent[]): Uint8Array {
  const bytes: number[] = []
  for (const event of events) {
    if (!Number.isInteger(event.type) || event.type < 1 || event.type > 5) throw new RangeError('Macro event type must be 1–5')
    if (!Number.isInteger(event.value) || event.value < 0 || event.value > 0xffff) throw new RangeError('Macro event value must be 0–65535')
    bytes.push(event.type, ...uint16Bytes(event.value))
  }
  if (bytes.length > 4095) throw new RangeError('Macro event data exceeds ObinsKit limit of 4095 bytes')
  return new Uint8Array(bytes)
}

export function serializeMacroImage(
  macros: readonly Pick<StoredMacro, 'icon' | 'name' | 'events'>[],
  bindings: readonly ActiveMacroBinding[],
): Uint8Array {
  if (macros.length > 16) throw new RangeError('Anne Pro 2 supports at most 16 macros')
  if (bindings.length > 64) throw new RangeError('Anne Pro 2 supports at most 64 macro bindings')
  if ((macros.length === 0) !== (bindings.length === 0)) {
    throw new Error('On-device macros and bindings must either both be empty or both be present')
  }
  const active: number[] = []
  for (const binding of bindings) {
    if (![binding.layer, binding.matrixPosition, binding.macroIndex].every(value =>
      Number.isInteger(value) && value >= 0 && value <= 0xff)) throw new RangeError('Macro binding fields must be bytes')
    if (binding.layer > 3) throw new RangeError('Macro binding layer must be 0–3')
    if (binding.macroIndex >= macros.length) throw new RangeError('Macro binding refers to a missing macro')
    active.push(binding.layer, binding.matrixPosition, binding.macroIndex)
  }
  for (let index = 0; index < macros.length; index += 1) {
    if (!bindings.some(binding => binding.macroIndex === index)) {
      throw new Error(`On-device macro ${index} has no key binding`)
    }
  }

  const map: number[] = []
  const content: number[] = []
  const contentBase = 2 + active.length + macros.length * 14
  for (const macro of macros) {
    if (macro.events.byteLength % 3 !== 0 || macro.events.byteLength > 4095) throw new RangeError('Invalid macro event data length')
    if (!Number.isInteger(macro.icon) || macro.icon < 0 || macro.icon > 0xffff) throw new RangeError('Macro icon must be a UInt16')
    const alias = encodeUtf16Be(macro.name)
    if (alias.length > 0xffff) throw new RangeError('Macro name is too long')
    const address = contentBase + content.length
    map.push(
      ...uint32Bytes(macroUuid(macro.events)), ...uint32Bytes(address),
      ...uint16Bytes(macro.events.byteLength + 3), ...uint16Bytes(alias.length),
      ...uint16Bytes(macro.icon),
    )
    content.push(...macro.events, 0, 0, 0, ...alias)
  }
  const body = new Uint8Array([...active, ...map, ...content])
  return new Uint8Array([bindings.length, macros.length, ...body, ...uint32Bytes(crc32(body))])
}

function createWriteRequest(action: 0x05 | 0x0a, body: Uint8Array): Uint8Array {
  if (body.byteLength > 54) throw new RangeError('Macro write body exceeds one HID packet')
  return new Uint8Array([
    0x7b, 0x12, 0x31, 0, body.byteLength + 2, 0, 0, 0x7d, 0x30, action, ...body,
  ])
}

export function createPrepareMacroImageRequest(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0 || length > 0xffffffff) throw new RangeError('Macro image length must be a UInt32')
  return createWriteRequest(0x0a, new Uint8Array(uint32Bytes(length)))
}

export function createDownloadMacroRequests(image: Uint8Array): Uint8Array[] {
  const requests: Uint8Array[] = []
  for (let offset = 0; offset < image.byteLength; offset += 49) {
    const chunk = image.slice(offset, offset + 49)
    requests.push(createWriteRequest(0x05, new Uint8Array([...uint32Bytes(offset), ...chunk])))
  }
  return requests
}

export function parseMacroWriteAck(action: 0x05 | 0x0a, data: Uint8Array): Uint8Array {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x30 || frame.action !== action) throw new Error('Response is not the expected macro write')
  if (frame.payload.byteLength !== 1 || frame.payload[0] !== 0) throw new Error('Macro write acknowledgement is not success (00)')
  return frame.payload.slice()
}

export function parseMacroMapResponse(reports: readonly Uint8Array[]): MacroMapEntry[] {
  const assembled = assembleLianaPayload(reports)
  if (assembled.command !== 0x30 || assembled.action !== 0x08) {
    throw new Error('Response is not readMacroMap (30/08)')
  }
  if (assembled.payload.byteLength % 14 !== 0) {
    throw new Error(`Macro map length must be divisible by 14, got ${assembled.payload.byteLength}`)
  }
  const entries: MacroMapEntry[] = []
  for (let offset = 0; offset < assembled.payload.byteLength; offset += 14) {
    const raw = assembled.payload.slice(offset, offset + 14)
    entries.push({
      index: entries.length,
      uuid: uint32Le(raw, 0).toString(16),
      address: uint32Le(raw, 4),
      macroLength: uint16Le(raw, 8),
      aliasLength: uint16Le(raw, 10),
      icon: uint16Le(raw, 12),
      raw,
    })
  }
  return entries
}

export function parseStoredMacro(
  entry: MacroMapEntry,
  reports: readonly Uint8Array[],
): StoredMacro {
  const assembled = assembleLianaPayload(reports)
  if (assembled.command !== 0x30 || assembled.action !== 0x09) {
    throw new Error('Response is not readMacro (30/09)')
  }
  if (entry.macroLength < 3) throw new Error('Macro length omits the 3-byte separator')
  const expectedLength = entry.macroLength + entry.aliasLength
  if (assembled.payload.byteLength !== expectedLength) {
    throw new Error(`Stored macro must be ${expectedLength} bytes, got ${assembled.payload.byteLength}`)
  }
  const eventLength = entry.macroLength - 3
  if (eventLength % 3 !== 0) throw new Error('Macro event data must contain three-byte records')
  return {
    id: entry.index,
    uuid: entry.uuid,
    icon: entry.icon,
    name: decodeUtf16Be(assembled.payload.slice(entry.macroLength, expectedLength)),
    events: assembled.payload.slice(0, eventLength),
    separator: assembled.payload.slice(eventLength, entry.macroLength),
  }
}

export function parseMacroActiveListResponse(
  reports: readonly Uint8Array[],
): ActiveMacroBinding[] {
  const assembled = assembleLianaPayload(reports)
  if (assembled.command !== 0x30 || assembled.action !== 0x07) {
    throw new Error('Response is not readMacroActiveList (30/07)')
  }
  if (assembled.payload.byteLength % 3 !== 0) {
    throw new Error(`Macro active-list length must be divisible by 3, got ${assembled.payload.byteLength}`)
  }
  const bindings: ActiveMacroBinding[] = []
  for (let offset = 0; offset < assembled.payload.byteLength; offset += 3) {
    bindings.push({
      layer: assembled.payload[offset],
      matrixPosition: assembled.payload[offset + 1],
      macroIndex: assembled.payload[offset + 2],
    })
  }
  return bindings
}
