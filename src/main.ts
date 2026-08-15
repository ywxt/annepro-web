import './style.css'
import { collectMetadata } from './hid/device.ts'
import { isWebHidSupported, requestAnneProDevice } from './hid/discovery.ts'
import { ReadonlyHidTransport } from './hid/transport.ts'
import type { InputReportRecord } from './hid/types.ts'
import { bytesToHex, formatHex } from './protocol/packet.ts'
import { tryParseLianaFrame } from './protocol/liana.ts'

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('Missing #app element')

app.innerHTML = `
  <header><p class="eyebrow">READ-ONLY WEBHID EXPLORER</p><h1>Anne Pro Web Configurator</h1>
  <p class="lede">檢視 Anne Pro 2 的 HID collections 與輸入報告。此版本不會向鍵盤傳送資料。</p></header>
  <section class="card status"><div><span class="dot"></span><span id="support"></span></div>
    <button id="connect" type="button">連接 Anne Pro 2</button></section>
  <p id="message" role="status" aria-live="polite"></p>
  <section id="device-section" class="card hidden"><div class="section-heading"><h2>裝置</h2><div><button id="read-device-type" class="secondary hidden" type="button">讀取裝置類型</button><button id="read-firmware-version" class="secondary hidden" type="button">讀取韌體版本</button></div></div><div id="device"></div><p id="device-type-result" class="decoded"></p><p id="firmware-version-result" class="decoded"></p></section>
  <section id="collections-section" class="hidden"><div class="section-heading"><h2>Collections</h2><div><span id="collection-count"></span><button id="export-metadata" class="secondary" type="button">匯出 metadata</button></div></div><div id="collections" class="collection-grid"></div></section>
  <section id="reports-section" class="card hidden"><div class="section-heading"><h2>Input reports</h2><div><button id="export" class="secondary" type="button">匯出 JSON</button><button id="clear" class="secondary" type="button">清除</button></div></div><div id="reports" class="reports"><p class="empty">等待輸入報告…</p></div></section>
  <footer>安全模式：只開啟裝置並監聽 inputreport</footer>`

const connectButton = document.querySelector<HTMLButtonElement>('#connect')!
const support = document.querySelector<HTMLElement>('#support')!
const message = document.querySelector<HTMLElement>('#message')!
const reportContainer = document.querySelector<HTMLElement>('#reports')!
const records: InputReportRecord[] = []
let connectedDevice: HIDDevice | null = null
let connectedTransport: ReadonlyHidTransport | null = null

const supported = isWebHidSupported()
support.textContent = supported ? 'WebHID 可用' : '此瀏覽器不支援 WebHID'
connectButton.disabled = !supported

function show(selector: string): void {
  document.querySelector(selector)?.classList.remove('hidden')
}

function renderDevice(device: HIDDevice): void {
  document.querySelector<HTMLElement>('#device')!.innerHTML = `
    <dl><div><dt>Vendor ID</dt><dd>${formatHex(device.vendorId)}</dd></div>
    <div><dt>Product ID</dt><dd>${formatHex(device.productId)}</dd></div>
    <div><dt>Product name</dt><dd>${device.productName || '—'}</dd></div>
    <div><dt>Opened</dt><dd>${device.opened ? 'Yes' : 'No'}</dd></div></dl>`
  show('#device-section')
}

function renderCollections(device: HIDDevice): void {
  const metadata = collectMetadata(device.collections)
  document.querySelector<HTMLElement>('#collection-count')!.textContent = `${metadata.length} total · ${metadata.filter((item) => item.protocolCandidate).length} protocol candidate`
  document.querySelector<HTMLElement>('#collections')!.innerHTML = metadata.map((collection, index) => `
    <article class="collection ${collection.protocolCandidate ? 'vendor' : ''}" style="margin-left:${Math.min(collection.depth, 4) * 12}px">
      <div class="collection-title"><h3>Collection ${index + 1}</h3>${collection.protocolCandidate ? `<span class="badge">${collection.vendorDefined ? 'Vendor-defined' : 'Protocol candidate'}</span>` : ''}</div>
      <p>Usage page <code>${formatHex(collection.usagePage)}</code> · Usage <code>${formatHex(collection.usage)}</code></p>
      ${collection.reports.length ? `<table><thead><tr><th>Type</th><th>Report ID</th><th>Size</th></tr></thead><tbody>${collection.reports.map((report) => `<tr><td>${report.kind}</td><td>${report.reportId}</td><td>${report.reportSizeBits} bits / ${report.reportSizeBytes} bytes</td></tr>`).join('')}</tbody></table>` : '<p class="empty">No reports exposed</p>'}
    </article>`).join('')
  show('#collections-section')
}

function renderReports(): void {
  reportContainer.innerHTML = records.length === 0 ? '<p class="empty">等待輸入報告…</p>' : records.map((record) => `
    <div class="report"><time>${record.timestamp}</time><span>ID ${record.reportId}</span><span>${record.bytes.byteLength} bytes</span><code>${bytesToHex(record.bytes) || '(empty)'}</code>${renderParsedFrame(record.bytes)}</div>`).join('')
}

function renderParsedFrame(bytes: Uint8Array): string {
  const frame = tryParseLianaFrame(bytes)
  if (!frame) return ''
  return `<small class="decoded">Liana ${formatHex(frame.protocol, 2)} · route ${frame.route} · sequence ${frame.sequence} · command ${formatHex(frame.command, 2)}/${formatHex(frame.action, 2)} · payload ${frame.payload.byteLength} bytes</small>`
}

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

connectButton.addEventListener('click', async () => {
  connectButton.disabled = true
  message.textContent = '等待選擇裝置…'
  try {
    const selection = await requestAnneProDevice()
    const { device } = selection
    if (!device) { message.textContent = '未選擇裝置。'; return }
    const transport = new ReadonlyHidTransport(device)
    await transport.open()
    connectedDevice = device
    connectedTransport = transport
    renderDevice(device)
    renderCollections(device)
    transport.listen((record) => { records.unshift(record); renderReports() })
    show('#reports-section')
    if (selection.hasProtocolCollection) {
      show('#read-device-type')
      show('#read-firmware-version')
    }
    message.textContent = selection.hasProtocolCollection
      ? `已從 ${selection.candidates.length} 個候選介面中連接協議候選 collection；正在唯讀監聽 input reports。`
      : `找到 ${selection.candidates.length} 個候選，但尚未選到 64-byte 協議介面；請再次連接並選擇另一個同名項目。`
  } catch (error) {
    message.textContent = `連接失敗：${error instanceof Error ? error.message : String(error)}`
  } finally { connectButton.disabled = false }
})

document.querySelector('#clear')?.addEventListener('click', () => { records.length = 0; renderReports() })
document.querySelector('#export')?.addEventListener('click', () => {
  const payload = records.map((record) => ({ ...record, bytes: bytesToHex(record.bytes), length: record.bytes.byteLength }))
  downloadJson(`annepro-input-reports-${Date.now()}.json`, payload)
})

document.querySelector('#export-metadata')?.addEventListener('click', () => {
  if (!connectedDevice) return
  downloadJson(`annepro-hid-metadata-${Date.now()}.json`, {
    capturedAt: new Date().toISOString(),
    vendorId: connectedDevice.vendorId,
    productId: connectedDevice.productId,
    productName: connectedDevice.productName,
    opened: connectedDevice.opened,
    collections: collectMetadata(connectedDevice.collections),
  })
})

document.querySelector('#read-device-type')?.addEventListener('click', async () => {
  if (!connectedTransport) return
  const approved = window.confirm(
    '這會向鍵盤傳送一次已由 ObinsKit capture 確認的唯讀 readDeviceType 封包。\n\nReport ID 0\n7b 12 31 00 02 00 00 7d 01 01\n\n確定繼續？',
  )
  if (!approved) return
  const button = document.querySelector<HTMLButtonElement>('#read-device-type')!
  const result = document.querySelector<HTMLElement>('#device-type-result')!
  button.disabled = true
  result.textContent = '等待 readDeviceType 回應…'
  try {
    const response = await connectedTransport.readDeviceType()
    result.textContent = `Model ${response.model} (${response.modelName}) · Type ${response.type} (${response.typeName}) · Frame ${bytesToHex(response.rawFrame)} · Ignored ${response.trailingLength} trailing bytes`
  } catch (error) {
    result.textContent = `readDeviceType 失敗：${error instanceof Error ? error.message : String(error)}`
  } finally {
    button.disabled = false
  }
})

document.querySelector('#read-firmware-version')?.addEventListener('click', async () => {
  if (!connectedTransport) return
  const approved = window.confirm(
    '這會向鍵盤傳送一次已由 ObinsKit capture 確認的唯讀 readFirmwareVersion 封包。\n\nReport ID 0\n7b 12 31 00 02 00 00 7d 01 03\n\n確定繼續？',
  )
  if (!approved) return
  const button = document.querySelector<HTMLButtonElement>('#read-firmware-version')!
  const result = document.querySelector<HTMLElement>('#firmware-version-result')!
  button.disabled = true
  result.textContent = '等待 readFirmwareVersion 回應…'
  try {
    const response = await connectedTransport.readFirmwareVersion()
    result.textContent = `Firmware · Key ${response.key} · LED ${response.led} · BLE ${response.ble} · Frame ${bytesToHex(response.rawFrame)} · Ignored ${response.trailingLength} trailing bytes`
  } catch (error) {
    result.textContent = `readFirmwareVersion 失敗：${error instanceof Error ? error.message : String(error)}`
  } finally {
    button.disabled = false
  }
})
