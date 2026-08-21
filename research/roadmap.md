# Implementation roadmap

The goal is functional interoperability with an independently maintained web UI.
Protocol work may directly reference the unpacked ObinsKit implementation. Every
device operation still moves through source analysis, offline tests, a bounded
device trial, and only then product UI.

## Safety levels

| Level | Meaning | Requirements |
| --- | --- | --- |
| R0 | Passive metadata/input observation | May be enabled by default |
| R1 | Confirmed read-only output request | Exact fixture, strict response parser, timeout, single-flight guard, confirmation |
| W1 | Reversible configuration write | Read-back backup, semantic diff, explicit confirmation, verification and restore path |
| W2 | Broad or difficult-to-reverse write | Separate expert mode and stronger recovery evidence |
| X | Firmware/IAP/erase | Excluded from normal releases until a dedicated recovery milestone |

## Milestones

### M1 — Transport and identity (complete)

- WebHID support detection and Anne Pro filters.
- Protocol-interface discovery for `0x04d9:0xa293`.
- Collection/report metadata and input logging/export.
- Liana frame parser.
- Captured `readDeviceType` and `readFirmwareVersion` queries.
- No arbitrary report-writing API.

### M2 — Complete read-only device information (complete for Anne Pro 2 C18)

- [x] Map every C18 renderer-visible information query to native symbols and command/action bytes.
- [x] Add read-only IAP-state parsing without mode switching.
- [x] Treat UDID/serial data as sensitive: masked display, excluded from ordinary exports.
- [x] Add capability flags derived from model and firmware rather than assumptions.
- [x] Test timeouts, concurrent operations, mismatched replies, and stale trailing bytes.

### M3 — Keyboard layout download and model

- [x] Reverse `uploadKbdLayout` framing, addressing, pagination, and response assembly. ObinsKit uses “upload” for device-to-host reads.
- [x] Capture one complete Layer 0 download without editing the keyboard.
- [x] Define the C18 physical row model (`14/14/13/12/8`) while retaining raw keycodes.
- [x] Preserve unknown keycodes and reject malformed or incomplete downloads.
- [x] Render a confirmed, read-only Layer 0 keyboard view.
- [x] Capture and enable Layers 1–3, then export all layers as a backup file.

### M4 — Guarded layout writes (complete)

- [x] Reverse `downloadKbdLayout` (host-to-device write) after M3 backups round-trip losslessly.
- [x] Show semantic and byte-level diffs.
- [x] Require explicit confirmation for each apply operation.
- [x] Read back and verify after writing; offer restore from the pre-write backup.
- [x] Never retry writes indefinitely.

### M5 — Lighting, macros, and ordinary settings

- Work feature-by-feature: read/capture, model, offline round-trip tests, then guarded write.
- Candidate order: sleep timeout, lighting download/preview, macro download, macro write, audio visualization.
- Keep unsupported bytes opaque and preserve them on round trips.
- [x] Ordinary settings editor with first-write snapshot and readback verification.
- [x] LED power-mode read and guarded write.
- [x] CapsLock indicator RGB read, guarded write, readback verification, and restore.
- [x] Host-managed lighting list, preview, download, and local backup/import.
- [x] Per-key static RGB editor for all 61 physical keys and independent 12-color dynamic palettes.
- [x] Macro event/binding editor, full-image serialization, CRC-32, staged 49-byte download, commit, backup/restore, and semantic device readback.
- [x] Audio Visualize pure/colorful transient stream with explicit microphone consent, stop/restore, 20 FPS cap, and awaited single-flight reports.
- [x] Audit the alternate MCU_LED audio config/data path and exclude it from C18: the Anne Pro 2 renderer uses only the Pure/Colorful `20/11` path.
- [x] ObinsKit-equivalent factory reset composition for model 5: default settings, empty macro image, final 14-effect default group, and BLE host clearing; protected by typed confirmation.
- [x] Symmetric full-backup export/import with preflight schema validation, in-memory snapshots, staged restore, and per-capability readback.

### M6 — Compatibility and release

- [ ] Test currently unavailable PIDs and firmware families on physical hardware.
- [x] Import all ObinsKit hardware profiles and implement the Discovery battery and D87 indicator-location protocol branches.
- [x] Generalize layout packet sizing for every official 8-bit profile and add the Tenet 70 UInt16LE codec.
- [x] Connect official model geometry to the key editor and make standalone layer backups keycode-width aware.
- [x] Add D87/Tenet indicator-location array editing with backup and verified write/readback.
- [x] Add a compatibility matrix, udev guidance, disconnect recovery, and browser diagnostics.
- [x] Add fixture-based regression tests for every implemented protocol variant.
- [x] Package as a static HTTPS-capable site with no backend requirement.

### M6.1 — Product interface and localization

- [x] Rename layer 3 to the ObinsKit-facing name **Tap Layer** (Base/Fn1/Fn2/Tap).
- [x] Remove confirmation dialogs from reads and reversible, verified ordinary writes.
- [x] Keep strong confirmation only for destructive or non-readable replacement operations.
- [x] Auto-load the supported keyboard configuration after connection.
- [x] Gate major feature panels from the detected model/firmware capability profile.
- [x] Move raw HID collections, reports, frames, and key bytes into collapsed developer tools.
- [x] Complete Traditional Chinese and English localization for every user-facing panel, destructive prompt, import validation, and runtime notice; enforce locale key parity with tests.
- [x] Replace the long single page with capability-driven task navigation comparable to a desktop configurator; the key editor has dedicated Base/Fn1/Fn2/Tap layer tabs.
- [x] Add a detected Linux/Windows/macOS landing-page guide, including narrow Linux udev rules.
- [x] Match the real ANSI 60% geometry and replace raw numeric keycode editing with categorized selection; render Transparent as a blank keycap.
- [x] Remove the duplicated read-only Settings summary and keep current values in the editable controls.
- [x] Force every component onto the reactive global i18n scope and test immediate locale switching.
- [x] Replace the top tab strip with a responsive desktop-style sidebar, persistent device command bar, and focused editing canvas.
- [x] Add an optional, persisted Debug mode; raw HID collections, reports, and protocol coverage are absent from the normal workflow.
- [x] Add a read-only browser Key Tester inspired by keyboard configurator workflows, with an explicit Fn/OS-shortcut limitation.
- [x] Surface the native protocol audit as three product states: Anne Pro 2 implemented, other-model capability-gated, and firmware/IAP safety-excluded.
- [x] Replace scattered setting cards with flat semantic clusters and verified, debounced auto-apply for reversible ordinary settings.
- [x] Centralize operation-specific timeouts while retaining the physically verified layout pacing and slower multipart budgets.
- [x] Clear all device-scoped data when switching keyboards and block reconnects while HID operations are active.

### M7 — IAP and firmware (deferred)

- IAP switching, flash erase, and firmware memory writes remain disabled.
- Reconsider only with verified firmware images, recovery hardware/procedure, power-loss tests, and a separately reviewed expert workflow.
- These capabilities should not share the ordinary configuration UI.

## Definition of done for a command

1. Native/renderer behavior is documented without copying implementation code.
2. Exact request and response are captured on a known model/firmware.
3. Fixtures contain only declared frame bytes and are checked for identifiers.
4. Encoder/parser boundary and error cases have unit tests.
5. Transport is single-flight, bounded by timeout, and accepts only the matching response.
6. UI communicates direction, risk, and exact action.
7. Physical-device result matches ObinsKit behavior.
# Latest progress

- Device identity is available with a masked-by-default 16-byte UDID.
- BLE MAC reading uses the confirmed MCU BLE route.
- Clearing BLE host bindings is implemented with typed destructive confirmation and physically verified with success status `00`.
- Model-only combination-mode and virtual-mouse commands are excluded from the Anne Pro 2 UI after C18 returned no response.
- The native/renderer command audit is recorded in `completion-audit.md`; all ordinary renderer-visible C18 configuration areas and statically identifiable official model branches are implemented behind exact capability gates.
- Tenet OLED/dual indicators, D87 indicators, Discovery battery/CapsLock color, ISO character preference, common model layouts/macros/settings, Fuji65 RGB bottom light, MCU-BLE identity, and the alternate MCU-LED audio configuration route are model-selected. Static-only writes remain labelled as requiring matching-hardware validation.
- Virtual-mouse writes, identity mutation, power-time reset, backlight-auto internals, and all firmware/IAP/erase operations remain deliberately absent from the product UI.
