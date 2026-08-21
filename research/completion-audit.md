# ObinsKit 1.2.11 completion audit

This audit compares the unpacked renderer, native operation dispatch, official
hardware profiles, and the current web configurator. Firmware/IAP/erase is an
explicitly excluded product area, not an unfinished ordinary setting.

## Renderer-visible configuration

| Area | Current status | Verification strength |
| --- | --- | --- |
| Identity/state | Model, firmware, IAP read, uptime, hardware state, battery variants, UDID and BLE MAC implemented | C18 captures plus native/model dispatch |
| General settings | Layout, Tap, Magic Fn, macro trigger, CapsLock behavior, brightness, power and sleep use the official model/firmware gates | C18 round trips plus renderer gate tests |
| Key layers | Four-layer 8-bit layouts for every official profile and Tenet 70 UInt16LE layouts; edit/import/export/write/readback | C18 physical round trip; other geometries static profile parity |
| Macros | Renderer-wide known-model workspace; config/map/active/index reads and staged full-image write/readback | C18 physical staging/round trip; model matrix offsets from official profiles |
| Lighting | Model profiles, palettes, per-key RGB, preview and persistent list installation; Fuji65 RGB bottom-light expansion | C18 physical traces; other profiles static |
| Audio | Anne Pro 2/ISO `20/11` visualization; alternate MCU-LED `21/01` remains Debug-only because the shipped data sender is a no-op | C18 physical traces plus renderer/native dispatch |
| D87 | Indicator functions, brightness, CapsLock color route and verified readback | Native/model gates; matching hardware still required |
| Discovery | Direct battery percentage, MCU-BLE tools and CapsLock color route | Native/model gates; matching hardware still required |
| Tenet 70 | UInt16LE layout, two indicator functions/colors, OLED image/text/scroll/date/monitor and combination-mode read | Native/renderer transfer loops; matching hardware still required |
| ISO | 62-key geometry, common protocol workspaces, audio/BLE gates and local US/Danish/Swedish/Norwegian character preference | Official profile and renderer behavior |
| Backup/reset | Symmetric full backup and composed factory defaults | Limited to the physically verified Anne Pro 2 profile |

## Write-safety review

- Every ordinary setting, layer, macro, indicator, and LED-power write has a typed
  encoder, bounded single-flight transport, acknowledgement parser, and semantic
  readback where the firmware provides a read command.
- Lighting lists have typed acknowledgements but no device upload command, so the UI
  calls them host-managed and never claims readback verification.
- OLED bitmap writes have no display readback. The UI requires confirmation for
  image/text replacement and does not present the canvas as device state.
- BLE host clearing and factory reset require destructive confirmation. Factory
  reset, full backup parsing and full restore require exact model 5 and cannot fall
  through to model 3 or any non-C18 profile.
- Static-only model writes are selected only after `readDeviceType`; unknown model
  IDs remain metadata-only. Raw arbitrary output is not exposed.

## Deliberate exclusions

| Group | Reason |
| --- | --- |
| `writeIapMode`, `writeIapMemory`, `writeEraseMemory` | Firmware/flash recovery is outside the product safety boundary |
| `writeUDID` | Identity/activation mutation, not an ordinary user configuration |
| `resetPowerOnTime` | Destructive diagnostic-state mutation |
| `writeBacklightAuto` | Internal operation with no renderer-visible configuration contract |
| Virtual-mouse writes `60/01–03` | Native symbols exist, but the renderer has no consumer or supported-model gate; only the read probe is Debug-only |
| MCU UUID | Sensitive read remains masked, excluded from exports, and Debug-only for non-C18 devices |
| Advanced audio data `21/02` | The shipped renderer's sender is a no-op; no normal product stream is claimed |

## Remaining external validation

The code surface represented by ObinsKit 1.2.11 is implemented or deliberately
excluded above. Physical validation is still unavailable for D87, Discovery, Tenet,
ISO, Fuji65 and the other extended PID families. Their writes therefore remain
labelled static/model-gated rather than “physically verified.” Adding such evidence
requires the corresponding hardware and does not justify probing a different model.
