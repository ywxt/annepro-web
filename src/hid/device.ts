import type { CollectionMetadata, ReportMetadata } from './types.ts'

function reportSizeBits(items: readonly HIDReportItem[] | undefined): number {
  return (items ?? []).reduce(
    (total, item) => total + (item.reportSize ?? 0) * (item.reportCount ?? 0),
    0,
  )
}

function mapReports(
  kind: ReportMetadata['kind'],
  reports: readonly HIDReportInfo[] | undefined,
): ReportMetadata[] {
  return (reports ?? []).map((report) => {
    const size = reportSizeBits(report.items)
    return {
      kind,
      reportId: report.reportId ?? 0,
      reportSizeBits: size,
      reportSizeBytes: Math.ceil(size / 8),
    }
  })
}

export function isVendorDefinedUsagePage(usagePage: number): boolean {
  return usagePage >= 0xff00 && usagePage <= 0xffff
}

export function isLikelyProtocolCollection(metadata: {
  usagePage: number
  usage: number
  reports: ReportMetadata[]
}): boolean {
  if (isVendorDefinedUsagePage(metadata.usagePage)) return true
  if (metadata.usagePage !== 0x0001 || metadata.usage !== 0x0000) return false
  return metadata.reports.some(
    (report) => report.kind === 'input' && report.reportSizeBytes === 64,
  ) && metadata.reports.some(
    (report) => report.kind === 'output' && report.reportSizeBytes === 64,
  )
}

export function collectMetadata(
  collections: readonly HIDCollectionInfo[],
  depth = 0,
): CollectionMetadata[] {
  return collections.flatMap((collection) => {
    const usagePage = collection.usagePage ?? 0
    const usage = collection.usage ?? 0
    const reports = [
      ...mapReports('input', collection.inputReports),
      ...mapReports('output', collection.outputReports),
      ...mapReports('feature', collection.featureReports),
    ]
    const base = {
      depth,
      usagePage,
      usage,
      vendorDefined: isVendorDefinedUsagePage(usagePage),
      reports,
    }
    return [
    { ...base, protocolCandidate: isLikelyProtocolCollection(base) },
    ...collectMetadata(collection.children ?? [], depth + 1),
    ]
  })
}
