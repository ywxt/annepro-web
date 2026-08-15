import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

export type AppLocale = 'zh-TW' | 'en'

export const messages = {
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
    nav: { device: '裝置', keys: '鍵位', lighting: '燈效', macros: '巨集', settings: '設定' },
    locale: { label: '語言', zh: '繁體中文', en: 'English' },
    layer: {
      0: 'Base Layer', 1: 'Fn1 Layer', 2: 'Fn2 Layer', 3: 'Tap Layer',
      keys: '{count} 個按鍵', changes: '{count} 項變更', restore: '復原原層', apply: '套用 {name}',
      selected: '按鍵 {index}', raw: '原始鍵位資料',
    },
    keyGroup: { Basic: '一般按鍵', Function: '功能鍵', Media: '媒體與系統', 'Anne Pro': 'Anne Pro 功能', Modifiers: '修飾鍵' },
    requirements: { eyebrow: '開始前', title: '平台與瀏覽器要求', linux: 'Linux', windows: 'Windows', macos: 'macOS', common: '使用最新版 Chrome 或 Edge，透過 USB 連接鍵盤，並先完全關閉 ObinsKit 或其他可能獨占 HID 裝置的程式。網站必須在 HTTPS 或 localhost 開啟。', linuxIntro: 'Linux 通常需要 udev 權限才能讓瀏覽器開啟 hidraw。請只安裝一份對應規則，不要使用對所有 input 裝置開放 MODE="0666" 的寬泛規則。', udevTitle: '建議的 udev 規則', copy: '複製規則', copied: '已複製', linuxStep1: '將規則儲存為 /etc/udev/rules.d/70-anne-pro-web.rules。', linuxStep2: '執行 sudo udevadm control --reload-rules && sudo udevadm trigger。', linuxStep3: '拔除並重新接上鍵盤，然後重新啟動瀏覽器。', windowsHelp: 'Windows 不需要 udev 或額外驅動。使用 Chrome／Edge，允許網站存取裝置；若選擇器看不到鍵盤，關閉 ObinsKit、拔插 USB，並確認使用資料傳輸線。', macosHelp: 'macOS 不需要 udev 或額外驅動。使用 Chrome／Edge，允許網站存取裝置；若無法開啟，先完全退出 ObinsKit，再拔插鍵盤。Safari 和 Firefox 不支援 WebHID。' },
    device: {
      title: '鍵盤', loading: '正在讀取鍵盤設定…', refresh: '重新整理全部', export: '匯出完整備份', restore: '還原完整備份',
      model: '型號', firmware: '韌體', connection: '連線', connected: '已連線', unavailable: '未知',
      protocolTools: '協議診斷', readType: '讀取裝置類型', readFirmware: '讀取韌體版本', readIap: '讀取 IAP 狀態', readLayer: '讀取 {name}', capabilities: '裝置能力', supported: '支援', unsupported: '不支援', waiting: '等待版本資訊', rgb: 'RGB 燈效', indicator: '獨立指示燈', battery: '電池與休眠', audio: '音訊燈效', tap: 'Tap 進階設定', ledPower: 'LED 功率模式',
    },
    common: { read: '重新讀取', notRead: '尚未讀取', show: '顯示', hide: '遮蔽', mode: '模式', color: '顏色', clear: '清除', exportJson: '匯出 JSON' },
    runtime: { title: '電池與使用時間', estimate: '電量估算', voltage: '電池電壓', uptime: '累計使用', hours: '{count} 小時', raw: '原始運行資料' },
    identity: { title: '裝置識別與藍牙', help: 'UDID 是裝置唯一識別碼，預設遮蔽且不會加入一般匯出。清除配對會移除鍵盤記住的所有 BLE 主機。', clear: '清除所有藍牙配對' },
    audio: { title: '音訊燈效', start: '開始麥克風燈效', stop: '停止並恢復燈效', help: '音訊只在瀏覽器內分析，不會錄製或上傳。瀏覽器會詢問麥克風權限，停止、斷線或離開頁面時會關閉音軌。', running: '運行中 · {count} 幀', stopped: '已停止' },
    factory: { title: '恢復 ObinsKit 原廠設定', help: '重設一般設定、清空巨集、安裝 14 個 Anne Pro 2 原廠燈效，並清除 BLE 配對。保留鍵位資料，不切換 IAP，也不修改韌體。', action: '恢復原廠設定' },
    lighting: { title: '燈效', import: '匯入', export: '匯出', add: '新增', install: '安裝全部（{count}）', help: '鍵盤不提供燈效讀回，因此效果清單儲存在這個瀏覽器。預覽不會永久寫入；安裝會替換鍵盤上的燈效清單。', keyboardPreview: '鍵盤顏色預覽', colors: '{count} 種顏色', collapse: '收合顏色', perKey: '逐鍵顏色', palette: '編輯色盤', preview: '預覽', remove: '刪除', effectName: 'Effect {count}' },
    macro: { title: '巨集', import: '匯入備份', export: '匯出備份', refresh: '重新讀取', restore: '復原首次備份', apply: '套用變更', empty: '尚未取得巨集資料。', summary: '{macros} / 16 個巨集 · {bindings} / 64 個綁定', changed: '有未套用變更', synced: '與鍵盤一致', invalid: '每個裝置內巨集都必須至少綁定一個鍵位。', addMacro: '新增巨集', addBinding: '新增綁定', name: '名稱', remove: '移除', addEvent: '新增事件', bindings: '鍵位綁定', keyUp: '按鍵放開', keyDown: '按鍵按下', delay: '延遲', mouseUp: '滑鼠放開', mouseDown: '滑鼠按下' },
    settings: { title: '一般設定', deviceSection: '電源與休眠', keysSection: '按鍵行為', lightingSection: '燈光設定', macrosSection: '巨集設定', refresh: '重新讀取', edit: '修改設定', restore: '復原修改前設定', help: '每次只套用一個選項，成功後會立即從鍵盤回讀驗證。', groupHelp: '修改需要的選項後，一次套用本區塊的所有變更並回讀驗證。', format: '資料格式', layout: '按鍵配置', defaultLayout: '預設配置', userLayout: '使用者配置', macroTrigger: '巨集觸發', capsLed: 'CapsLock 燈效', capsOnly: '僅 CapsLock 鍵', allKeys: '所有按鍵', indicatorBrightness: '指示燈亮度', backlight: '背光亮度', autoSleep: '自動休眠', tapMode: 'Tap 模式', tapTime: 'Tap 判定時間', sleepTime: '休眠時間', ledPower: 'LED 功率', enabled: '啟用', disabled: '停用', normal: '一般模式', combo: '組合模式', apply: '套用變更', seconds: '秒', capsColor: 'CapsLock 指示顏色', readColor: '重新讀取顏色', restoreColor: '復原原色', unknown: '未知（{value}）', unsupportedValue: '不支援（保留值 {value}）', inactive: '目前不生效', raw: '原始設定資料' },
    notice: { selecting: '等待選擇裝置…', connecting: '正在尋找已授權的 Anne Pro 2…', noDevice: '沒有可用的 Anne Pro 2 協議介面。', connected: '鍵盤已連線，設定已自動載入。', noProtocol: '找到鍵盤，但沒有可用的 64-byte 協議介面。', disconnected: 'Anne Pro 2 已斷線。重新插入後可快速重連。', reinserted: '偵測到鍵盤重新接入，可以快速重連。', waiting: '正在讀取 {name}…', done: '{name} 已完成。', failed: '{name} 失敗：{error}', loaded: '鍵盤資訊與所有支援的設定已載入。', settingSaved: '{name} 已套用並驗證。', settingsSaved: '已套用並驗證 {count} 項設定。', settingsRestored: '一般設定已復原並驗證。', layerSaved: '{name} 已套用並驗證。', layerRestored: '{name} 已復原並驗證。', macroSaved: '巨集已套用並驗證。', macroRestored: '巨集已復原並驗證。', previewed: '正在預覽 {name}。', lightsInstalled: '已安裝 {count} 個燈效。', lightsImported: '已匯入 {count} 個本機燈效，尚未安裝到鍵盤。', audioStarted: '音訊燈效已開始。', audioStopped: '音訊燈效已停止並恢復原燈效。' },
    danger: { clearBle: '這會刪除鍵盤記住的所有藍牙主機，且無法由本工具復原。\n\n請輸入 DELETE BLE 繼續：', factory: '這會覆寫一般設定與燈效、清空所有巨集及 BLE 配對。燈效與 BLE 配對無法自動復原。\n\n請輸入 FACTORY RESET 繼續：', lights: '這會以本機設定檔覆寫鍵盤的 {count} 個燈效。鍵盤無法讀回及備份目前燈效，確定繼續？', fullRestore: '這會完整覆寫四層鍵位、巨集、一般設定、CapsLock 顏色及 {count} 個燈效。所有可讀資料已保留在記憶體；燈效無法從裝置讀回。{warning}\n\n請輸入 RESTORE FULL BACKUP 繼續：', pidWarning: '\n注意：備份來源 PID {source}，目前鍵盤 PID {current}。' },
    backup: { parse: '解析備份', layers: '還原鍵位', macros: '還原巨集', lights: '還原燈效', settings: '還原一般設定', verify: '驗證一般設定', restored: '完整備份 {file} 已還原：4 層、{macros} 個巨集與一般設定均已驗證，{lights} 個燈效已寫入。', failed: '完整備份在「{stage}」失敗：{error}。已完成的階段不會自動回滾。', modelMismatch: '備份型號 {source} 與目前鍵盤型號 {current} 不符。' },
    validation: { format: '檔案格式不正確。', macroLimit: '巨集或綁定數量超出鍵盤限制。', macroEvents: 'Macro {index} 的事件資料無效。', macroMetadata: 'Macro {index} 的名稱或圖示無效。', binding: 'Binding {index} 無效。', layout: '備份必須包含四個鍵位層。', layer: '{name} 的鍵位資料無效。', lightLimit: '燈效不可超過 32 個。', readback: '{name} 回讀值 {actual}，預期 {expected}。' },
    developer: { collections: 'HID Collections', collectionCount: '共 {total} 個 · {candidates} 個協議候選', exportMetadata: '匯出 metadata', reports: 'Input reports', waiting: '等待輸入報告…' },
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
    nav: { device: 'Device', keys: 'Keys', lighting: 'Lighting', macros: 'Macros', settings: 'Settings' },
    locale: { label: 'Language', zh: '繁體中文', en: 'English' },
    layer: {
      0: 'Base Layer', 1: 'Fn1 Layer', 2: 'Fn2 Layer', 3: 'Tap Layer',
      keys: '{count} keys', changes: '{count} changes', restore: 'Restore original', apply: 'Apply {name}',
      selected: 'Key {index}', raw: 'Raw key data',
    },
    keyGroup: { Basic: 'Basic keys', Function: 'Function keys', Media: 'Media and system', 'Anne Pro': 'Anne Pro functions', Modifiers: 'Modifiers' },
    requirements: { eyebrow: 'BEFORE YOU START', title: 'Platform and browser requirements', linux: 'Linux', windows: 'Windows', macos: 'macOS', common: 'Use the latest Chrome or Edge, connect the keyboard over USB, and fully quit ObinsKit or any other program that may hold the HID device. Open this site over HTTPS or localhost.', linuxIntro: 'Linux usually needs a udev permission rule before the browser can open hidraw. Install only one matching rule set; avoid broad MODE="0666" rules that expose every input device.', udevTitle: 'Recommended udev rules', copy: 'Copy rules', copied: 'Copied', linuxStep1: 'Save the rules as /etc/udev/rules.d/70-anne-pro-web.rules.', linuxStep2: 'Run sudo udevadm control --reload-rules && sudo udevadm trigger.', linuxStep3: 'Unplug and reconnect the keyboard, then restart the browser.', windowsHelp: 'Windows needs no udev rule or additional driver. Use Chrome or Edge and grant device access. If the chooser cannot see the keyboard, quit ObinsKit, reconnect USB, and verify that the cable supports data.', macosHelp: 'macOS needs no udev rule or additional driver. Use Chrome or Edge and grant device access. If opening fails, fully quit ObinsKit and reconnect the keyboard. Safari and Firefox do not support WebHID.' },
    device: {
      title: 'Keyboard', loading: 'Reading keyboard configuration…', refresh: 'Refresh all', export: 'Export full backup', restore: 'Restore full backup',
      model: 'Model', firmware: 'Firmware', connection: 'Connection', connected: 'Connected', unavailable: 'Unknown',
      protocolTools: 'Protocol diagnostics', readType: 'Read device type', readFirmware: 'Read firmware', readIap: 'Read IAP state', readLayer: 'Read {name}', capabilities: 'Device capabilities', supported: 'Supported', unsupported: 'Unsupported', waiting: 'Waiting for firmware', rgb: 'RGB lighting', indicator: 'Dedicated indicator', battery: 'Battery and sleep', audio: 'Audio visualization', tap: 'Advanced Tap settings', ledPower: 'LED power mode',
    },
    common: { read: 'Refresh', notRead: 'Not read yet', show: 'Show', hide: 'Hide', mode: 'Mode', color: 'Color', clear: 'Clear', exportJson: 'Export JSON' },
    runtime: { title: 'Battery and usage', estimate: 'Battery estimate', voltage: 'Battery voltage', uptime: 'Total usage', hours: '{count} hours', raw: 'Raw runtime data' },
    identity: { title: 'Device identity and Bluetooth', help: 'The UDID uniquely identifies this device. It is masked by default and excluded from ordinary exports. Clearing pairings removes every BLE host remembered by the keyboard.', clear: 'Clear all Bluetooth pairings' },
    audio: { title: 'Audio visualization', start: 'Start microphone lighting', stop: 'Stop and restore lighting', help: 'Audio is analyzed only in your browser and is never recorded or uploaded. The browser asks for microphone access; tracks close when stopped, disconnected, or leaving the page.', running: 'Running · {count} frames', stopped: 'Stopped' },
    factory: { title: 'Restore ObinsKit defaults', help: 'Reset ordinary settings, clear macros, install the 14 Anne Pro 2 factory effects, and clear BLE pairings. Key data is preserved; IAP and firmware are not changed.', action: 'Restore factory defaults' },
    lighting: { title: 'Lighting', import: 'Import', export: 'Export', add: 'Add', install: 'Install all ({count})', help: 'The keyboard does not provide lighting readback, so the effect list is stored in this browser. Preview is temporary; install replaces the keyboard effect list.', keyboardPreview: 'Keyboard color preview', colors: '{count} colors', collapse: 'Collapse colors', perKey: 'Per-key colors', palette: 'Edit palette', preview: 'Preview', remove: 'Delete', effectName: 'Effect {count}' },
    macro: { title: 'Macros', import: 'Import backup', export: 'Export backup', refresh: 'Refresh', restore: 'Restore initial backup', apply: 'Apply changes', empty: 'Macro data has not been loaded.', summary: '{macros} / 16 macros · {bindings} / 64 bindings', changed: 'Unsaved changes', synced: 'Matches keyboard', invalid: 'Every stored macro must be bound to at least one key.', addMacro: 'Add macro', addBinding: 'Add binding', name: 'Name', remove: 'Remove', addEvent: 'Add event', bindings: 'Key bindings', keyUp: 'Key up', keyDown: 'Key down', delay: 'Delay', mouseUp: 'Mouse up', mouseDown: 'Mouse down' },
    settings: { title: 'General settings', deviceSection: 'Power and sleep', keysSection: 'Key behavior', lightingSection: 'Lighting settings', macrosSection: 'Macro settings', refresh: 'Refresh', edit: 'Edit settings', restore: 'Restore pre-change settings', help: 'Each option is applied separately and immediately verified by reading it back from the keyboard.', groupHelp: 'Change the options you need, then apply and verify this section in one operation.', format: 'Data format', layout: 'Key layout', defaultLayout: 'Default layout', userLayout: 'User layout', macroTrigger: 'Macro trigger', capsLed: 'CapsLock lighting', capsOnly: 'CapsLock key only', allKeys: 'All keys', indicatorBrightness: 'Indicator brightness', backlight: 'Backlight brightness', autoSleep: 'Auto sleep', tapMode: 'Tap mode', tapTime: 'Tap threshold', sleepTime: 'Sleep timeout', ledPower: 'LED power', enabled: 'Enabled', disabled: 'Disabled', normal: 'Normal mode', combo: 'Combination mode', apply: 'Apply changes', seconds: 'seconds', capsColor: 'CapsLock indicator color', readColor: 'Refresh color', restoreColor: 'Restore original', unknown: 'Unknown ({value})', unsupportedValue: 'Unsupported (reserved value {value})', inactive: 'currently inactive', raw: 'Raw settings data' },
    notice: { selecting: 'Waiting for device selection…', connecting: 'Looking for an authorized Anne Pro 2…', noDevice: 'No usable Anne Pro 2 protocol interface was found.', connected: 'Keyboard connected and settings loaded automatically.', noProtocol: 'Keyboard found, but no usable 64-byte protocol interface is available.', disconnected: 'Anne Pro 2 disconnected. Reconnect it to use quick reconnect.', reinserted: 'Keyboard reconnected; quick reconnect is available.', waiting: 'Reading {name}…', done: '{name} completed.', failed: '{name} failed: {error}', loaded: 'Keyboard information and all supported settings have loaded.', settingSaved: '{name} was applied and verified.', settingsSaved: 'Applied and verified {count} settings.', settingsRestored: 'General settings were restored and verified.', layerSaved: '{name} was applied and verified.', layerRestored: '{name} was restored and verified.', macroSaved: 'Macros were applied and verified.', macroRestored: 'Macros were restored and verified.', previewed: 'Previewing {name}.', lightsInstalled: 'Installed {count} lighting effects.', lightsImported: 'Imported {count} local effects; they have not been installed yet.', audioStarted: 'Audio visualization started.', audioStopped: 'Audio visualization stopped and the previous effect was restored.' },
    danger: { clearBle: 'This removes every Bluetooth host remembered by the keyboard and cannot be undone by this tool.\n\nType DELETE BLE to continue:', factory: 'This replaces ordinary settings and lighting, clears all macros, and removes BLE pairings. Lighting and pairings cannot be restored automatically.\n\nType FACTORY RESET to continue:', lights: 'This replaces the keyboard list with {count} local effects. The current keyboard effects cannot be read or backed up. Continue?', fullRestore: 'This completely replaces all four key layers, macros, general settings, CapsLock color, and {count} lighting effects. All readable data is retained in memory; lighting cannot be read back from the device.{warning}\n\nType RESTORE FULL BACKUP to continue:', pidWarning: '\nWarning: backup PID {source}; current keyboard PID {current}.' },
    backup: { parse: 'Parse backup', layers: 'Restore key layers', macros: 'Restore macros', lights: 'Restore lighting', settings: 'Restore general settings', verify: 'Verify general settings', restored: 'Full backup {file} restored: four layers, {macros} macros, and general settings were verified; {lights} lighting effects were written.', failed: 'Full backup failed during “{stage}”: {error}. Completed stages are not rolled back automatically.', modelMismatch: 'Backup model {source} does not match keyboard model {current}.' },
    validation: { format: 'The file format is invalid.', macroLimit: 'Macro or binding count exceeds the keyboard limit.', macroEvents: 'Macro {index} has invalid event data.', macroMetadata: 'Macro {index} has invalid name or icon metadata.', binding: 'Binding {index} is invalid.', layout: 'The backup must contain all four key layers.', layer: '{name} has invalid key data.', lightLimit: 'A profile cannot contain more than 32 effects.', readback: '{name} read back {actual}; expected {expected}.' },
    developer: { collections: 'HID Collections', collectionCount: '{total} total · {candidates} protocol candidates', exportMetadata: 'Export metadata', reports: 'Input reports', waiting: 'Waiting for input reports…' },
  },
} as const

const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem('annepro-web-locale')
const initialLocale: AppLocale = saved === 'en' ? 'en' : 'zh-TW'
export const appLocale = ref<AppLocale>(initialLocale)

export const i18n = createI18n({ legacy: false, locale: initialLocale, fallbackLocale: 'en', messages })

export function setAppLocale(locale: AppLocale): void {
  appLocale.value = locale
  i18n.global.locale.value = locale
  if (typeof localStorage !== 'undefined') localStorage.setItem('annepro-web-locale', locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}
