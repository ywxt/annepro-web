export function bytesToHex(data: ArrayBuffer | ArrayBufferView): string {
  const bytes = data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
}

export function formatHex(value: number, width = 4): string {
  return `0x${value.toString(16).padStart(width, '0')}`
}
