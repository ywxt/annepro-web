# Clean-room implementation roadmap

The goal is functional interoperability, not a copy of ObinsKit source code or UI. Every protocol operation moves through evidence, offline tests, a bounded device trial, and only then product UI.

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

### M2 — Complete read-only device information

- Map every renderer-visible information query to native symbols and command/action bytes.
- Add read-only IAP-state parsing without mode switching.
- Treat UDID/serial data as sensitive: masked display, excluded from ordinary exports.
- Add capability flags derived from model and firmware rather than assumptions.
- Test timeouts, disconnects, mismatched replies, and stale trailing bytes.

### M3 — Keyboard layout download and model

- [x] Reverse `uploadKbdLayout` framing, addressing, pagination, and response assembly. ObinsKit uses “upload” for device-to-host reads.
- [x] Capture one complete Layer 0 download without editing the keyboard.
- [x] Define the C18 physical row model (`14/14/13/12/8`) while retaining raw keycodes.
- [x] Preserve unknown keycodes and reject malformed or incomplete downloads.
- [x] Render a confirmed, read-only Layer 0 keyboard view.
- [x] Capture and enable Layers 1–3, then export all layers as a backup file.

### M4 — Guarded layout writes

- Reverse `downloadKbdLayout` (host-to-device write) only after M3 backups round-trip losslessly.
- Show semantic and byte-level diffs.
- Require explicit confirmation for each apply operation.
- Read back and verify after writing; offer restore from the pre-write backup.
- Never retry writes indefinitely.

### M5 — Lighting, macros, and ordinary settings

- Work feature-by-feature: read/capture, model, offline round-trip tests, then guarded write.
- Candidate order: sleep timeout, lighting download/preview, macro download, macro write, audio visualization.
- Keep unsupported bytes opaque and preserve them on round trips.

### M6 — Compatibility and release

- Test supported PIDs and known firmware families separately.
- Add a compatibility matrix, udev guidance, disconnect recovery, and browser diagnostics.
- Add fixture-based regression tests for every supported protocol variant.
- Package as a static HTTPS-capable site with no backend requirement.

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
