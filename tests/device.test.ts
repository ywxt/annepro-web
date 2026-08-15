import { describe, expect, it } from 'vitest'
import { collectMetadata, isVendorDefinedUsagePage } from '../src/hid/device.ts'

describe('report metadata', () => {
  it('calculates report size from every report item', () => {
    const collections = [{
      usagePage: 0xff00,
      usage: 1,
      inputReports: [{ reportId: 2, items: [
        { reportSize: 8, reportCount: 8 },
        { reportSize: 1, reportCount: 3 },
      ] }],
      outputReports: [{ reportId: 3, items: [{ reportSize: 4, reportCount: 4 }] }],
      featureReports: [],
      children: [],
    }] as unknown as HIDCollectionInfo[]

    expect(collectMetadata(collections)).toEqual([{
      depth: 0,
      usagePage: 0xff00,
      usage: 1,
      vendorDefined: true,
      protocolCandidate: true,
      reports: [
        { kind: 'input', reportId: 2, reportSizeBits: 67, reportSizeBytes: 9 },
        { kind: 'output', reportId: 3, reportSizeBits: 16, reportSizeBytes: 2 },
      ],
    }])
  })

  it('recognizes only the HID vendor-defined usage-page range', () => {
    expect(isVendorDefinedUsagePage(0xfeff)).toBe(false)
    expect(isVendorDefinedUsagePage(0xff00)).toBe(true)
    expect(isVendorDefinedUsagePage(0xffff)).toBe(true)
  })
})
