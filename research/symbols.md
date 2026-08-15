# Static-analysis targets

- `HID::writeTo`
- `Liana::readDeviceType`
- `Liana::hidWrite`
- `Liana::hidWriteWithArg0`
- `Liana::hidWriteWithArg1`
- `Liana::hidWriteWithBuffer`
- `Liana::liana_packet_buffer_add_header`
- `Liana::liana_packet_buffer_add_cmd`
- `Liana::multi_package_create`
- `sendReadDeviceTypeV1`

## ObinsKit 1.2.11 Linux x64 addresses

These addresses apply only to the SHA-256-verified binary documented in `protocol.md`:

```text
0x0001c290  Liana::readDeviceType
0x00019c80  Liana::multi_package_create
0x00017e80  Liana::liana_packet_buffer_add_header
0x00017f10  Liana::liana_packet_buffer_add_cmd
0x00017680  sendReadDeviceTypeV1
```
