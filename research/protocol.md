# Protocol status

## `readDeviceType`

Status: confirmed by a controlled capture and implemented as a guarded, one-shot read-only query.

The ObinsKit 1.2.11 archive was verified against the published SHA-256 before analysis:

```text
2a10aed5366c2667174525924da60e323b7e200e2aa9abc1c1a6335e792096cd
```

### High-confidence observations

- The renderer invokes the native method with no arguments: `readDeviceType`.
- The renderer interprets response byte 0 as `model` and byte 1 as `type`.
- `Liana::readDeviceType` calls `multi_package_create` with the three byte-sized values `0x03`, `0x01`, `0x01` and empty optional buffers.
- It registers a callback using the identifier returned by `multi_package_create`, then calls `Liana::hidWrite`.
- The native object changes an internal protocol/state byte from `0x12` while constructing the request to `0x10` before dispatch.
- Packet framing begins with `0x7b` and terminates a fixed header area with `0x7d`.
- `liana_packet_buffer_add_cmd` places its command bytes at packet offsets 8 and 9.

### Legacy/fallback path observed

`sendReadDeviceTypeV1` eventually calls HIDAPI `hid_write` with 11 bytes. Byte 0 is copied from a runtime/device field (likely a report identifier and therefore **not assumed**). Bytes 1 through 10 are constant:

```text
7b 10 31 00 02 00 00 7d 01 01
```

This remains reverse-engineering evidence only. The controlled capture selected protocol byte `0x12`, not this `0x10` legacy path.

### Still unknown

- Whether different Anne Pro 2 firmware revisions select the `0x10` legacy request path.
- The precise semantics of header byte 3 for multi-packet responses.
- Whether variants other than captured product `0xa293` use the same model/type payload.

The captured `0xa293` path uses WebHID report ID 0, with the report ID supplied separately to `sendReport`. Request, response envelope, and two-byte model/type payload are covered by redacted fixtures and tests.

### Controlled capture result

A 12-second trace of the installed ObinsKit, filtered to the protocol interface `/dev/hidraw10`, confirmed the first initialization exchange:

```text
report ID: 0
request:   7b 12 31 00 02 00 00 7d 01 01
response:  7b 12 13 00 04 00 00 7d 01 01 05 01
decoded:   model 5 (AnnePro2C18), type 1 (Keyboard)
```

ObinsKit sent 17 initialization queries in total. Command/action `01/01` was isolated and retained as a fixture. Each implemented read is separately documented and constrained; the remaining initialization requests are not authorized by this finding. The web implementation exposes confirmed requests only as one-shot actions with a confirmation dialog and timeout; it does not expose arbitrary report writing.

## `readFirmwareVersion`

The Electron renderer calls `readFirmwareVersion(MCU_MAIN)` and decodes either a legacy three-byte payload or a six-byte payload containing low/high version pairs. The controlled trace paired command/action `01/03`:

```text
report ID: 0
request:   7b 12 31 00 02 00 00 7d 01 03
response:  7b 12 13 00 08 00 00 7d 01 03 24 02 21 02 05 02
decoded:   key 2.36, LED 2.33, BLE 2.05
```

This exact read is implemented with the same confirmation, single-flight, strict-response, and timeout restrictions as `readDeviceType`. Other captured initialization commands remain unimplemented.

## `readIapMode`

Static analysis shows `readIapMode(target)` calls `hidWriteWithArg0(target, 02, 02)`. A separately approved, isolated request to `MCU_MAIN` confirmed:

```text
report ID: 0
request:   7b 12 31 00 02 00 00 7d 02 02
response:  7b 12 13 00 03 00 00 7d 02 02 02
decoded:   mode code 2
```

The response contains one declared payload byte. The semantic name of value 2 is not present in the inspected renderer path and remains intentionally unmapped. This query does not call `writeIapMode` and cannot switch modes.

## Keyboard layout direction

Electron's `getKbdInsideLayers(true)` calls `uploadKbdLayout` once for each layer index 0–3. Native dispatch maps it to `hidWriteWithArg1(MCU_MAIN, 10, 02)`, so the layer index is the one-byte request payload. ObinsKit's inverse name `downloadKbdLayout(layer, Buffer)` is a host-to-keyboard write using `multi_package_create(03, 10, 01, ...)` and must not be confused with the read path.

The startup trace already contains four `10/02` requests and two response packets per layer. Protocol `0x12` encodes continuation in the high bit of header byte 3 and a zero-based packet index in its low seven bits. The observed split is 54 + 7 data bytes, yielding a 61-byte layer. An offline assembler now validates contiguous indices, continuation flags, matching commands, and declared frame lengths. No web transport method sends this command yet.

## Physical metadata capture: `0x04d9:0xa293`

The first browser capture (`annepro-hid-metadata-1786811850854.json`) contains one top-level collection:

```text
usage page: 0x0001 (Generic Desktop)
usage:      0x0006 (Keyboard)
reports:    none exposed
```

This is the standard keyboard collection, not a vendor-defined protocol interface. Empty report metadata is consistent with Chromium protecting keyboard-class reports. Device recognition/opening alone therefore does not yet satisfy the vendor-interface milestone. Discovery now examines all granted matching HID devices and prefers a vendor-defined collection if Chromium exposes one.

### Linux descriptor enumeration

The connected physical device exposes four HID interfaces. Reading their sysfs `report_descriptor` files is passive and produced:

```text
input0  Generic Desktop / Keyboard             standard keyboard
input1  Generic Desktop / Undefined (usage 0)  64-byte input + 64-byte output, report ID 0
input2  Consumer + Keyboard + Mouse             report IDs 1, 2, 3
input3  Generic Desktop / Game Controls         control inputs
```

`input1` is the strong protocol-interface candidate. Contrary to the initial assumption, this firmware does not place it on a vendor-defined usage page; it uses usage page `0x0001`, usage `0x0000`. The web discovery classifier therefore accepts either a vendor-defined collection or this observed 64-byte bidirectional descriptor. This classification does not authorize writing its output report.

The second browser capture confirms Chromium exposes this exact collection with report ID 0 and 512-bit input/output reports.

## Offline frame parser

The project parses, but does not construct or transmit, the statically observed frame layout:

```text
offset  size  meaning
0       1     magic 0x7b
1       1     protocol/state (observed 0x10 and 0x12)
2       1     route in high nibble, sequence in low nibble
3       1     packet/index encoding (version-dependent details unresolved)
4       2     little-endian length of command + action + payload
6       1     reserved (observed 0)
7       1     header terminator 0x7d
8       1     command
9       1     action
10...         payload, followed by HID report padding if present
```

The parser validates boundaries and exposes trailing 64-byte report padding separately. Field names for bytes 1–3 remain provisional until a capture confirms their runtime semantics.

### Keyboard layout read (`uploadKbdLayout`, `10/02`)

ObinsKit 1.2.11 sends one layer index (`00` through `03`) as the request payload.
The observed response is multipart: packet `80` carries 54 data bytes and packet
`01` carries the final 7, producing a 61-byte opaque layer payload. The web
implementation currently models and tests this format offline only; it does not
yet expose a layout query in the HID transport or interpret the keycodes.

An isolated Layer 0 request confirmed the first packet exactly: packet `80`
contains 54 bytes beginning `35 1e 1f 20 ...` and has no HID padding. The capture
closed before reading packet `01`, so it is deliberately recorded as incomplete
and is rejected by the complete-layer parser.

A second explicitly approved, single-request capture read both reports from the
same descriptor. Packet `01` contributed `e3 e2 c0 e6 c0 c1 e4`, completing the
61-byte Layer 0 payload. This confirms one byte per physical key for the connected
Anne Pro 2 C18. Only bytes inside the declared frames are retained because the
second 64-byte HID report contained stale trailing data.

Isolated reads of Layers 1, 2, and 3 subsequently confirmed the same request
shape and `54 + 7 = 61` response split for layer indices `01`, `02`, and `03`.
Layer 2 contains firmware-specific usages that remain opaque until independently
mapped. All four C18 layers are therefore confirmed safe for bounded reads.

### Macro reads (`30/06` through `30/09`)

Native dispatch and renderer control flow identify four read operations on
`MCU_MAIN`: config (`30/06`), active list (`30/07`), map (`30/08`), and indexed
macro content (`30/09`). The renderer reads config first and stops immediately
when payload byte 0 is zero. The isolated device response to config was two zero
bytes, so no map, content, or active-list request was needed.

The similarly named `downloadMacro` is not a read: the renderer uses it to send
serialized macro storage in chunks with action `30/05`. The image format is:

```text
bindingCount:u8, macroCount:u8,
bindings[bindingCount] = { layer:u8, matrixPosition:u8, macroIndex:u8 },
map[macroCount] = { uuid:u32le, address:u32le, macroLength:u16le,
                    aliasLength:u16le, icon:u16le },
contents = events + 00 00 00 + UTF-16BE alias,
crc32:u32le
```

`uuid` is CRC-32 of the UTF-8 JSON representation of the event byte array. The
final CRC covers the binding table, map and contents (not the two count bytes).
ObinsKit declares the full image length through `clearMacro` (`30/0a`), sends
`UInt32LE(offset) + up to 49 bytes` through `downloadMacro` (`30/05`), then
commits it with `writeMacroFn(1)` (`30/03`). An empty image is paired with
`writeMacroFn(0)`. The web implementation backs up first and verifies config,
map, contents and bindings through `30/06–09` after committing.

### Hardware state (`01/09`)

The modern renderer reads a 24-byte payload and uses indices 12–23 for ordinary
settings. Older firmware uses a separate 6-byte layout. Both formats are parsed.
The first 12 modern bytes and the raw sleep-timeout value are preserved without
inventing semantics not present in the renderer.

### LED power mode (`20/1e`)

Native dispatch maps renderer operation `readLedPowerMode` to an argument-free
MCU_MAIN read. One isolated request returned the single-byte value `02`, which
the renderer's option list labels `High` (`01` is `Low`). The control is enabled
for Anne Pro 2 key firmware newer than 2.35. The similarly named light preview
and download operations are both writes; ObinsKit stores editable light effects
on the host and exposes no device-to-host light-effect backup command.

### Ordinary setting writes

The native name dispatcher maps the renderer's individual setting operations to
fixed command/action pairs. The web UI exposes these as typed, range-checked
operations only. It snapshots the first read state, confirms each semantic diff,
writes one field, then uses `readHardwareState` or `readLedPowerMode` to verify
the effective value. A physical backlight test changed raw brightness 7 to 6,
confirmed 6 by readback, restored 7, and confirmed 7. Write acknowledgement
payloads are operation-specific (some echo values), so they are retained as raw
data and are not interpreted as a universal status code.

### Keyboard layout write (`downloadKbdLayout`, `10/01`)

The write body is the one-byte layer index followed by the 61 C18 keycodes.
ObinsKit's packet builder splits those 62 bytes into payloads of 54 and 8, with
packet markers `80` and `01`. The keyboard acknowledges each packet with a
single-byte zero-based packet index. A Layer 0 no-op write was followed by the
existing `10/02` read and matched all 61 bytes. The editor therefore snapshots
the original layer, shows changed keys, requires confirmation, writes exactly
two bounded packets, and rejects any non-identical readback.

### Lighting (`20/03` and `20/04`)

`previewLight` and `downloadLight` share the native packet builder. Their body
starts with slot and effect type. Type 1 carries one RGB color, type 2 carries
61 per-key colors plus the C18 profile's nine blank LED positions, and dynamic
types carry ObinsKit's 12-color palette. Preview uses slot 255 and action `04`;
a bounded physical preview produced no acknowledgement, so it only awaits USB
send completion. Persistent download uses action `03`, preceded by the one-byte
`writeLightList` count on `20/04`, and retains packet acknowledgement checks.
The keyboard has no light-list read command, so profiles are explicitly stored,
imported, and exported by the browser rather than described as device backups.
# Device identity and Bluetooth

- `01/0d` (`readUDID`, MCU main route `0x3`) returns a 16-byte unique device ID on C18. Treat it as sensitive: mask by default and exclude it from automatic exports.
- `40/30` (`readBleMac`, MCU BLE route `0x5`, request header byte `0x51`) returns the six-byte BLE address.
- `40/05` (`deleteBleHost`, MCU BLE route `0x5`) clears remembered BLE hosts. It is exposed only behind typed destructive confirmation and was not sent during protocol verification.
- C18 did not respond to the statically identified `01/04`, `01/11`, `01/f1`, or `60/05` requests. The latter two are used by other ObinsKit model families and are not exposed for Anne Pro 2.
