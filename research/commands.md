# ObinsKit/Liana command matrix

Evidence labels:

- **captured** — exact request/response observed on `0x04d9:0xa293`.
- **static** — native call arguments or renderer behavior identified, but no isolated device capture.
- **unknown** — name observed but framing/payload is incomplete.

| Operation | Direction | Liana tuple / frame | Evidence | Safety | Web status |
| --- | --- | --- | --- | --- | --- |
| `readDeviceType` | read | command/action `01/01`, report ID 0 | captured | R1 | implemented |
| `readFirmwareVersion(MCU_MAIN)` | read | command/action `01/03`, report ID 0 | captured | R1 | implemented |
| `readHardwareState(MCU_MAIN)` | read | command/action `01/09`, 6-byte legacy or 24-byte modern response | captured | R1 | implemented |
| `readLedPowerMode(MCU_MAIN)` | read | command/action `20/1e`, one-byte mode (`1` low, `2` high) | captured | R1 | implemented |
| `readIapMode(MCU_MAIN)` | read | command/action `02/02`, report ID 0 | captured | R1 | implemented; mode labels pending |
| `readUDID` | read sensitive | captured startup query strongly correlates with `01/0d` | renderer + capture correlation | R1/private | not implemented |
| `uploadKbdLayout(layer)` | multi-packet read | command/action `10/02`, one-byte layer argument | startup capture + native dispatch | R1 | offline assembler implemented; isolated layer capture pending |
| `downloadKbdLayout(layer, data)` | multi-packet write | native `multi_package_create(03, 10, 01, ...)` | renderer + static | W1 | disabled |
| ordinary setting writes | write + readback | `10/03,05,06,07,11,13`; `20/0d,15,1f`; `30/03`; sleep `01/0f` | native dispatch + brightness round trip | W1 | implemented with snapshot and verification |
| `downloadMacro(offset, chunk)` | chunked write | command/action `30/05`; renderer sends serialized macro storage in 49-byte USB chunks | renderer + native dispatch | W1 | disabled |
| `readMacroConfig` | read | command/action `30/06`, two-byte response | captured | R1 | implemented |
| `readMacroActiveList` | read | command/action `30/07` | static native dispatch | R1 | capture only when config is non-empty |
| `readMacroMap` | read | command/action `30/08` | static native dispatch | R1 | capture only when config is non-empty |
| `readMacro(index)` | indexed read | command/action `30/09`, one-byte index | static native dispatch | R1 | capture only for indices declared by map |
| `previewLight` / `downloadLight` | write | native `previewOrDownloadLight`; light slot/type plus RGB buffer | renderer + native dispatch | W1 | disabled; no device-to-host light read exists |
| `writeSleepTimeout` | configuration write | command/action `01/0f`, UInt16LE seconds | native dispatch | W1 | implemented with readback |
| `writeAudioVisualize` | configuration write | unresolved | static symbol | W1 | disabled |
| `writeMacro` | multi-packet write | unresolved | static symbol | W1 | disabled |
| `writeIapMode` | mode switch | unresolved | static symbol | X | forbidden/deferred |
| `writeIapMemory` | firmware write | unresolved | observed name | X | forbidden/deferred |
| `writeEraseMemory` | flash erase | unresolved | static symbol | X | forbidden/deferred |

## Captured startup traffic

The 12-second ObinsKit trace issued 17 queries. Presence in that trace does not by itself authorize an implementation. Known pairs include `01/01` and `01/03`; remaining frames are retained only in temporary analysis data and must be individually correlated, redacted, and reviewed before becoming fixtures.

## Layout direction and pagination

ObinsKit's direction names are from the keyboard's perspective:

- `uploadKbdLayout(layer)` reads one layer from the keyboard using `10/02`.
- `downloadKbdLayout(layer, data)` writes one layer to the keyboard using `10/01`.

Captured `10/02` responses use protocol `0x12` multipart byte 3 as a continuation/index field: `0x80` is packet index 0 with more data, and `0x01` is final packet index 1. Their 54-byte and 7-byte data payloads assemble into a 61-byte Anne Pro 2 layer.
