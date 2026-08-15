export interface ReportMetadata {
  kind: 'input' | 'output' | 'feature'
  reportId: number
  reportSizeBits: number
  reportSizeBytes: number
}

export interface CollectionMetadata {
  depth: number
  usagePage: number
  usage: number
  vendorDefined: boolean
  protocolCandidate: boolean
  reports: ReportMetadata[]
}

export interface InputReportRecord {
  timestamp: string
  reportId: number
  bytes: Uint8Array
}

export interface DeviceSelection {
  device: HIDDevice | null
  candidates: HIDDevice[]
  hasProtocolCollection: boolean
}
