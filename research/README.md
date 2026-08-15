# Research notes

This directory records protocol analysis, including direct references to the
locally unpacked ObinsKit implementation. Do not commit full ObinsKit bundles or
unnecessary copyrighted assets.

- [`protocol.md`](protocol.md) records confirmed frame formats and captures.
- [`commands.md`](commands.md) tracks command direction and evidence.
- [`keycodes.md`](keycodes.md) documents the key-name mapping.
- [`symbols.md`](symbols.md) lists native static-analysis targets.

Reviewed captures live in `captures/`. Check every new capture for serial numbers,
UDIDs, or other sensitive data and retain only bytes inside declared protocol frames.
