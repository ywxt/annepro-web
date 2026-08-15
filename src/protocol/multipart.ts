import { parseLianaFrame, type LianaFrame } from './liana.ts'

export interface AssembledLianaPayload {
  command: number
  action: number
  payload: Uint8Array
  packetCount: number
}

function packetIndex(frame: LianaFrame): number {
  return frame.packet & 0x7f
}

function hasMorePackets(frame: LianaFrame): boolean {
  return (frame.packet & 0x80) !== 0
}

/** Assembles the observed protocol-0x12 packet/index encoding without sending data. */
export function assembleLianaPayload(reports: readonly Uint8Array[]): AssembledLianaPayload {
  if (reports.length === 0) throw new Error('At least one report is required')
  const frames = reports.map(parseLianaFrame).sort((left, right) =>
    packetIndex(left) - packetIndex(right),
  )
  const { command, action, protocol } = frames[0]
  if (protocol !== 0x12) throw new Error(`Unsupported multipart protocol ${protocol}`)

  let payloadLength = 0
  for (const [index, frame] of frames.entries()) {
    if (frame.protocol !== protocol || frame.command !== command || frame.action !== action) {
      throw new Error('Multipart frames do not share protocol/command/action')
    }
    if (packetIndex(frame) !== index) throw new Error(`Missing multipart packet index ${index}`)
    const shouldHaveMore = index < frames.length - 1
    if (hasMorePackets(frame) !== shouldHaveMore) {
      throw new Error(`Invalid continuation flag on multipart packet ${index}`)
    }
    payloadLength += frame.payload.byteLength
  }

  const payload = new Uint8Array(payloadLength)
  let offset = 0
  for (const frame of frames) {
    payload.set(frame.payload, offset)
    offset += frame.payload.byteLength
  }
  return { command, action, payload, packetCount: frames.length }
}
