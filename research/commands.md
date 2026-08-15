# ObinsKit/Liana command matrix

Evidence labels:

- **captured** — exact request/response observed on `0x04d9:0xa293`.
- **static** — native call arguments or renderer behavior identified, but no isolated device capture.
- **unknown** — name observed but framing/payload is incomplete.

| Operation | Direction | Liana tuple / frame | Evidence | Safety | Web status |
| --- | --- | --- | --- | --- | --- |
| `readDeviceType` | read | command/action `01/01`, report ID 0 | captured | R1 | implemented |
| `readFirmwareVersion(MCU_MAIN)` | read | command/action `01/03`, report ID 0 | captured | R1 | implemented |
| `readIapMode(MCU_MAIN)` | read | command/action `02/02`, report ID 0 | captured | R1 | implemented; mode labels pending |
| `readUDID` | read sensitive | captured startup query strongly correlates with `01/0d` | renderer + capture correlation | R1/private | not implemented |
| `downloadKbdLayout` | multi-packet read | native `multi_package_create(03, 10, 01, ...)` | static | R1 | framing/payload research pending |
| `downloadMacro` | multi-packet read | native `multi_package_create(03, 30, 05, ...)` | static | R1 | framing/payload research pending |
| `previewOrDownloadLight` | read/preview | unresolved | static symbol | R1/W1 | pending |
| `writeSleepTimeout` | configuration write | unresolved | static symbol | W1 | disabled |
| `writeAudioVisualize` | configuration write | unresolved | static symbol | W1 | disabled |
| `writeMacro` | multi-packet write | unresolved | static symbol | W1 | disabled |
| `writeIapMode` | mode switch | unresolved | static symbol | X | forbidden/deferred |
| `writeIapMemory` | firmware write | unresolved | observed name | X | forbidden/deferred |
| `writeEraseMemory` | flash erase | unresolved | static symbol | X | forbidden/deferred |

## Captured startup traffic

The 12-second ObinsKit trace issued 17 queries. Presence in that trace does not by itself authorize an implementation. Known pairs include `01/01` and `01/03`; remaining frames are retained only in temporary analysis data and must be individually correlated, redacted, and reviewed before becoming fixtures.
