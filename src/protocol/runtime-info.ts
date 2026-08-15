import { parseLianaFrame } from './liana.ts'

function readUInt32Le(data: Uint8Array): number {
  return (data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24)) >>> 0
}

function readRequest(action: 0x02 | 0x05): Uint8Array {
  return new Uint8Array([0x7b, 0x12, 0x31, 0, 2, 0, 0, 0x7d, 0x01, action])
}

export interface PowerOnTimeResponse {
  hours: number
  rawFrame: Uint8Array
  trailingLength: number
}

export interface BatteryResponse {
  adc: number
  voltage: number
  percent: number
  reserved: number
  rawFrame: Uint8Array
  trailingLength: number
}

export function createReadPowerOnTimeRequest(): Uint8Array { return readRequest(0x02) }
export function createReadBatteryRequest(): Uint8Array { return readRequest(0x05) }

export function batteryPercent(voltage: number): number {
  let value: number
  if (voltage >= 4.1) value = 100
  else if (voltage >= 4) value = 90 + (voltage - 4) / 0.15 * 10
  else if (voltage >= 3.9) value = 80 + (voltage - 3.9) / 0.1 * 10
  else if (voltage >= 3.8) value = 70 + (voltage - 3.8) / 0.1 * 10
  else if (voltage >= 3.75) value = 60 + (voltage - 3.75) / 0.05 * 10
  else if (voltage >= 3.7) value = 50 + (voltage - 3.7) / 0.05 * 10
  else if (voltage >= 3.65) value = 40 + (voltage - 3.65) / 0.05 * 10
  else if (voltage >= 3.6) value = 30 + (voltage - 3.6) / 0.05 * 10
  else if (voltage >= 3.5) value = 20 + (voltage - 3.5) / 0.1 * 10
  else if (voltage >= 3.4) value = 10 + (voltage - 3.4) / 0.1 * 10
  else value = 0
  return Math.round(value)
}

function parseRuntimeFrame(action: 0x02 | 0x05, data: Uint8Array): ReturnType<typeof parseLianaFrame> {
  const frame = parseLianaFrame(data)
  if (frame.command !== 0x01 || frame.action !== action) throw new Error('Response is not the expected runtime information')
  if (frame.payload.byteLength !== 4) throw new Error(`Runtime information payload must be 4 bytes, got ${frame.payload.byteLength}`)
  return frame
}

export function parsePowerOnTimeResponse(data: Uint8Array): PowerOnTimeResponse {
  const frame = parseRuntimeFrame(0x02, data)
  return { hours: readUInt32Le(frame.payload), rawFrame: data.slice(0, 8 + frame.payloadLength), trailingLength: frame.trailing.byteLength }
}

export function parseBatteryResponse(data: Uint8Array): BatteryResponse {
  const frame = parseRuntimeFrame(0x05, data)
  const adc = frame.payload[0] | (frame.payload[1] << 8)
  const voltage = adc * 2 * 3.1 / 4095
  return {
    adc, voltage, percent: batteryPercent(voltage),
    reserved: frame.payload[2] | (frame.payload[3] << 8),
    rawFrame: data.slice(0, 8 + frame.payloadLength), trailingLength: frame.trailing.byteLength,
  }
}
