export interface LianaFrame {
  protocol: number
  route: number
  sequence: number
  packet: number
  payloadLength: number
  reserved: number
  command: number
  action: number
  payload: Uint8Array
  trailing: Uint8Array
}

export class LianaFrameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LianaFrameError'
  }
}

/**
 * Parses an observed Liana frame without creating or transmitting a request.
 * WebHID supplies the report ID separately, so `data` starts at the 0x7b magic.
 */
export function parseLianaFrame(data: Uint8Array): LianaFrame {
  if (data.byteLength < 10) throw new LianaFrameError('Frame is shorter than 10 bytes')
  if (data[0] !== 0x7b) throw new LianaFrameError('Missing 0x7b frame magic')
  if (data[7] !== 0x7d) throw new LianaFrameError('Missing 0x7d header terminator')

  const payloadLength = data[4] | (data[5] << 8)
  if (payloadLength < 2) throw new LianaFrameError('Payload length omits command bytes')
  const frameLength = 8 + payloadLength
  if (frameLength > data.byteLength) {
    throw new LianaFrameError(`Frame declares ${frameLength} bytes but only ${data.byteLength} are available`)
  }

  return {
    protocol: data[1],
    route: data[2] >> 4,
    sequence: data[2] & 0x0f,
    packet: data[3],
    payloadLength,
    reserved: data[6],
    command: data[8],
    action: data[9],
    payload: data.slice(10, frameLength),
    trailing: data.slice(frameLength),
  }
}

export function tryParseLianaFrame(data: Uint8Array): LianaFrame | null {
  try {
    return parseLianaFrame(data)
  } catch (error) {
    if (error instanceof LianaFrameError) return null
    throw error
  }
}
