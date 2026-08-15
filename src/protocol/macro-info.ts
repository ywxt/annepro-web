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
