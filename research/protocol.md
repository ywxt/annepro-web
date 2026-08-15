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
