import { parseLianaFrame } from './liana.ts'

const READ_FIRMWARE_VERSION_REQUEST = new Uint8Array([
  0x7b, 0x12, 0x31, 0x00, 0x02, 0x00, 0x00, 0x7d, 0x01, 0x03,
])

export interface FirmwareVersions {
  key: string
  led: string
  ble: string
  rawFrame: Uint8Array
  trailingLength: number
}

export function createReadFirmwareVersionRequest(): Uint8Array {
  return READ_FIRMWARE_VERSION_REQUEST.slice()
}

function padded(value: number): string {
  return value.toString().padStart(2, '0')
}

function decodeLegacyVersion(value: number): string {
  return value > 15
    ? `${Math.floor(value / 16)}.${padded(value % 16)}`
    : `0.${padded(value)}`
}

export function parseFirmwareVersionResponse(data: Uint8Array): FirmwareVersions {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x01 || frame.action !== 0x03) {
    throw new Error('Response is not readFirmwareVersion (01/03)')
  }
  if (frame.payload.byteLength !== 3 && frame.payload.byteLength !== 6) {
    throw new Error(`readFirmwareVersion payload must be 3 or 6 bytes, got ${frame.payload.byteLength}`)
  }

  const [key, led, ble] = frame.payload.byteLength === 6
    ? [
        `${frame.payload[1]}.${padded(frame.payload[0])}`,
        `${frame.payload[3]}.${padded(frame.payload[2])}`,
        `${frame.payload[5]}.${padded(frame.payload[4])}`,
      ]
    : Array.from(frame.payload, decodeLegacyVersion)

  return {
    key,
    led,
    ble,
    rawFrame: data.slice(0, 8 + frame.payloadLength),
    trailingLength: frame.trailing.byteLength,
  }
}
