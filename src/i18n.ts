import { createI18n } from 'vue-i18n'

export type AppLocale = 'zh-TW' | 'en'

const messages = {
  'zh-TW': {
    app: {
      title: 'Anne Pro Web Configurator',
      subtitle: '直接在瀏覽器中查看、備份與設定 Anne Pro 2。一般設定會立即套用並回讀驗證；IAP、韌體與 flash erase 永遠停用。',
      available: 'WebHID 可用', unsupported: '此瀏覽器不支援 WebHID',
      reconnect: '快速重連', connect: '選擇 Anne Pro 2', keyboardLayers: '鍵位層',
      importLayers: '匯入四層備份', exportLayers: '匯出完整備份',
      developerTools: '開發工具', developerHint: 'HID collections、原始 report 與協議診斷資訊',
      footer: '一般設定會自動回讀驗證；危險操作需要明確確認；IAP、韌體與 flash erase 永遠停用。',
    },
    locale: { label: '語言', zh: '繁體中文', en: 'English' },
    layer: {
      0: 'Base Layer', 1: 'Fn1 Layer', 2: 'Fn2 Layer', 3: 'Tap Layer',
      keys: '{count} 個按鍵', changes: '{count} 項變更', restore: '復原原層', apply: '套用 {name}',
      selected: '按鍵 {index}', raw: '原始鍵位資料',
    },
    device: {
      title: '鍵盤', loading: '正在讀取鍵盤設定…', refresh: '重新整理全部', export: '匯出完整備份', restore: '還原完整備份',
      model: '型號', firmware: '韌體', connection: '連線', connected: '已連線', unavailable: '未知',
      protocolTools: '協議診斷', readType: '讀取裝置類型', readFirmware: '讀取韌體版本', readIap: '讀取 IAP 狀態', readLayer: '讀取 {name}', capabilities: '裝置能力', supported: '支援', unsupported: '不支援', waiting: '等待版本資訊',
    },
  },
  en: {
    app: {
      title: 'Anne Pro Web Configurator',
      subtitle: 'View, back up, and configure your Anne Pro 2 directly in the browser. Ordinary settings are applied immediately and verified by readback; IAP, firmware, and flash erase remain disabled.',
      available: 'WebHID available', unsupported: 'This browser does not support WebHID',
      reconnect: 'Quick reconnect', connect: 'Choose Anne Pro 2', keyboardLayers: 'Key layers',
      importLayers: 'Import four-layer backup', exportLayers: 'Export layer backup',
      developerTools: 'Developer tools', developerHint: 'HID collections, raw reports, and protocol diagnostics',
      footer: 'Ordinary settings are verified by readback; dangerous actions require explicit confirmation; IAP, firmware, and flash erase are always disabled.',
    },
    locale: { label: 'Language', zh: '繁體中文', en: 'English' },
    layer: {
      0: 'Base Layer', 1: 'Fn1 Layer', 2: 'Fn2 Layer', 3: 'Tap Layer',
      keys: '{count} keys', changes: '{count} changes', restore: 'Restore original', apply: 'Apply {name}',
      selected: 'Key {index}', raw: 'Raw key data',
    },
    device: {
      title: 'Keyboard', loading: 'Reading keyboard configuration…', refresh: 'Refresh all', export: 'Export full backup', restore: 'Restore full backup',
      model: 'Model', firmware: 'Firmware', connection: 'Connection', connected: 'Connected', unavailable: 'Unknown',
      protocolTools: 'Protocol diagnostics', readType: 'Read device type', readFirmware: 'Read firmware', readIap: 'Read IAP state', readLayer: 'Read {name}', capabilities: 'Device capabilities', supported: 'Supported', unsupported: 'Unsupported', waiting: 'Waiting for firmware',
    },
  },
} as const

const saved = localStorage.getItem('annepro-web-locale')
const locale: AppLocale = saved === 'en' ? 'en' : 'zh-TW'

export const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages })

export function setAppLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale
  localStorage.setItem('annepro-web-locale', locale)
  document.documentElement.lang = locale
}
