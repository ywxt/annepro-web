# ObinsKit/Liana command matrix

Evidence labels:

- **captured** — exact request/response observed on `0x04d9:0xa293`.
- **static** — native call arguments or renderer behavior identified, but no isolated device capture.
- **unknown** — name observed but framing/payload is incomplete.

| Operation | Direction | Liana tuple / frame | Evidence | Safety | Web status |
| --- | --- | --- | --- | --- | --- |
| `readDeviceType` | read | command/action `01/01`, report ID 0 | captured | R1 | implemented |
| `readFirmwareVersion(MCU_MAIN)` | read | command/action `01/03`, report ID 0 | captured | R1 | implemented |
| `readPowerOnTime` | read | command/action `01/02`, UInt32LE hours | captured | R1 | implemented |
| `readBattery` | read | command/action `01/05`, UInt16LE ADC + two reserved bytes | captured | R1 | implemented with ObinsKit voltage/percent curve |
| `readBatteryPercentage` | Discovery read | command/action `01/11`, one percentage byte | native dispatch + renderer model branch | R1 | implemented and selected only for model 14 |
| `readHardwareState(MCU_MAIN)` | read | command/action `01/09`, 6-byte legacy or 24-byte modern response | captured | R1 | implemented |
| `readLedPowerMode(MCU_MAIN)` | read | command/action `20/1e`, one-byte mode (`1` low, `2` high) | captured | R1 | implemented |
| `readIapMode(MCU_MAIN)` | read | command/action `02/02`, report ID 0 | captured | R1 | implemented; no mode switch |
| `readUDID` | read sensitive | command/action `01/0d`, 16 bytes | captured/redacted | R1/private | implemented, masked and excluded from export |
| `readBleMac` | read | BLE route, command/action `40/30`, 6-byte address | captured | R1 | implemented |
| `deleteBleHost` | destructive config | BLE route, command/action `40/05`, status `00` | captured | W2 | implemented behind typed confirmation |
| `uploadKbdLayout(layer)` | multi-packet read | command/action `10/02`, one-byte layer argument | captured for layers 0–3 | R1 | implemented |
| `downloadKbdLayout(layer, data)` | multi-packet write | `10/01`; layer prefix repeated per packet, 61 keycodes split 52 + 9, followed by `writeKbdLayout(1)` | native `0x35 - prefix length` calculation + renderer sequence | W1 | four-layer transaction; ACK per packet, byte-level readback, User-layout readback |
| ordinary setting writes | write + readback | native protocol `10`, marker `10`; `10/03,05,06,07,11,13`; `20/0d,15,1f`; `30/03`; sleep `01/0f` | native same-value round trip | W1 | strict status/echo ACK plus semantic readback; indicator brightness unsupported |
| `prepare/clearMacro(length)` | write | native `10/31/10`, command/action `30/0a`; UInt32LE complete image length | renderer + native empty-state round trip | W1 | implemented |
| `downloadMacro(offset, chunk)` | chunked write | native `10/31/10`, command/action `30/05`; UInt32LE offset + up to 49 image bytes | native staged 49-byte physical round trip | W1 | implemented with backup and semantic readback |
| `readMacroConfig` | read | command/action `30/06`, two-byte response | captured | R1 | implemented |
| `readMacroActiveList` | read | command/action `30/07` | static native dispatch | R1 | capture only when config is non-empty |
| `readMacroMap` | read | command/action `30/08` | static native dispatch | R1 | capture only when config is non-empty |
| `readMacro(index)` | indexed read | command/action `30/09`, one-byte index | static native dispatch | R1 | capture only for indices declared by map |
| `previewLight` | transient write | MCU LED `20/03`; repeated slot `ff`/type prefix + up to 51 RGB bytes | native physical single/multipart traces | W1 | implemented with status `00` ACK per packet |
| `downloadLight` | persistent multi-packet write | MCU main `20/02`; repeated slot/type prefix + up to 51 RGB bytes | renderer + native dispatch/trace | W1 | implemented as host-managed list; status `00` ACK per packet |
| `writeLightList` | persistent write | `20/04`; one-byte list count | renderer + native dispatch | W1 | implemented before bounded list download |
| `writeSleepTimeout` | configuration write | command/action `01/0f`, UInt16LE seconds | native dispatch | W1 | implemented with readback |
| `writeAudioVisualize` | transient stream | MCU LED `20/11`; repeated `ff 01/02` prefix + up to 51 RGB bytes | native physical single/multipart traces | W1 | status `00` ACK per packet, max 20 FPS |
| `writeAudioVisualConfig` | other-model transient config | MCU_LED route, command/action `21/01`; one-byte `AudioLightType` 0–10 | native dispatch + advanced renderer path | W1/static | encoded and exposed through a model-gated transport API; no general UI |
| `writeAudioVisualData` | other-model transient stream | MCU_LED route, command/action `21/02`; renderer constructs 18-byte analyser frames | native dispatch; shipped renderer sender is a no-op | W1/static | bounded single-report API for hardware validation; no general UI |
| Tenet OLED image/character | model-12 display write | MCU_MAIN `70/01` image, `70/08` character; 128 × (page index + 32 packed 4-bit grayscale bytes) | native dispatch + renderer transfer loop | W1/static | exact codec and bounded acknowledged transport; UI/physical validation pending |
| Tenet OLED scroll/date/monitor | model-12 display write | MCU_MAIN `70/05`, `70/07`, `70/09` | native dispatch + renderer payload construction | W1/static | typed codec and bounded acknowledged transport; UI/physical validation pending |
| indicator color | read/write/readback | `20/1a` read RGB, `20/1b` write RGB | captured same-value round trip | W1 | implemented with backup/restore |
| indicator location | D87/Tenet read/write/readback | `20/18` reads the complete location byte array; `20/19` writes the complete array | native dispatch + renderer model branch | W1 | editor, first backup, bounded ACK, and exact array readback; 3 values on D87 and 2 on Tenet |
| factory reset | composed write | ObinsKit defaults + empty macro + final 14-effect model-5 light group + BLE clear | renderer/SQL defaults | W2 | implemented behind typed confirmation |
| `writeMacro` (legacy) | multi-packet write | `30/01`; index, trigger, event records + separator | native + renderer | W1 | not used; full image path supersedes it |
| virtual mouse config | other-model read/write | command `60`, actions `01/02/03/05` | native dispatch; C18 no response | N/A | intentionally capability-excluded |
| `getCombinationMode` | Tenet read | MCU_MAIN `01/f1`, one raw mode byte interpreted by renderer as truthy/falsey | native dispatch + renderer consumer | R1/static | exact parser and model-12 transport; UI/physical validation pending |
| `writeIapMode` | mode switch | unresolved | static symbol | X | forbidden/deferred |
| `writeIapMemory` | firmware write | unresolved | observed name | X | forbidden/deferred |
| `writeEraseMemory` | flash erase | unresolved | static symbol | X | forbidden/deferred |

## Audio visualization model split

ObinsKit's Anne Pro 2 keyboard route (`/keyboard/music`, lazy module `87717`) injects
the `zt` audio store. That store exposes exactly `Pure` and `Colorful` and calls
`writeAudioVisualize` every 20 ms with an in-flight guard. This is the C18 path
implemented by the web configurator as command/action `20/11` on MCU_MAIN.

The unpacked renderer also contains a separate, more advanced audio-analysis path.
Native dispatch maps its `writeAudioVisualConfig` and `writeAudioVisualData` calls to
MCU_LED command/actions `21/01` and `21/02`. The C18 keyboard page does not consume
that path. Module `50585` defines modes 0 through 10, and the advanced analyser
constructs 18-byte RMS/ZCR/spectrum frames. However, the shipped 1.2.11 renderer's
`writeAudioVisualData` wrapper is an empty function, so there is no official evidence
that it streams those frames to production hardware. The protocol is encoded and
unit-tested, but remains out of the ordinary UI pending a matching-device capture.

## Captured startup traffic

The 12-second ObinsKit trace issued 17 queries. Presence in that trace does not by itself authorize an implementation. Known pairs include `01/01` and `01/03`; remaining frames are retained only in temporary analysis data and must be individually correlated, redacted, and reviewed before becoming fixtures.

## Layout direction and pagination

ObinsKit's direction names are from the keyboard's perspective:

- `uploadKbdLayout(layer)` reads one layer from the keyboard using `10/02`.
- `downloadKbdLayout(layer, data)` writes one layer to the keyboard using `10/01`.

Captured `10/02` responses use protocol `0x12` multipart byte 3 as a continuation/index field: `0x80` is packet index 0 with more data, and `0x01` is final packet index 1. Their 54-byte and 7-byte data payloads assemble into a 61-byte Anne Pro 2 layer.

## Write verification audit

Every exposed write is bounded and verified at the strongest level the device supports:

- Keyboard layers, ordinary settings, LED power, indicator color, and macros receive typed acknowledgements and semantic readback. Layout writes acknowledge eight uninterrupted download packets, finish with ObinsKit's `writeKbdLayout(1)` reload step, then read back all four active layers.
- Persistent lighting receives a typed acknowledgement for the list header and every multipart packet. Firmware exposes no lighting read command, so the UI explicitly treats the list as host-managed and does not claim semantic readback.
- BLE-host deletion validates its returned zero status. There is no safe command that enumerates paired hosts afterward.
- Lighting preview and audio visualization are transient operations for which the captured C18 firmware emits no acknowledgement. They are single-flight, size/rate bounded, and only treat `sendReport()` completion as transport success.
- Factory restore composes the operations above and compares every readable setting, LED power, indicator color, and macro state after writing; lighting and deleted BLE pairings retain their documented device limitations.
# Timing parity

ObinsKit 1.2.11's native HID watchdog retries an unanswered report after 600 ms
and ends the operation at 1200 ms. The web transport uses the same bounded
timing for ordinary and multipart commands. Audio visualization follows the
renderer cadence of 20 ms and keeps at most one acknowledged frame in flight.
