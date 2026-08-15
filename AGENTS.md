# Project: Anne Pro Web Configurator

Build a clean-room, open-source WebHID configurator for Anne Pro 2.

## Current phase

Only implement safe, read-only device exploration:

- Request and open supported Anne Pro 2 devices.
- Display device, collection, and report metadata.
- Record input reports.
- Keep HID transport separate from UI and protocol code.
- Add tests for packet formatting and metadata extraction.

## Safety

Do not send output reports, feature reports, firmware data, IAP commands, flash erase commands, or unconfirmed HID packets without explicit user approval. Do not implement firmware updates in early versions.

## Engineering

- Use TypeScript, Vite, native WebHID, and Vitest.
- Run on localhost or HTTPS.
- Keep packet encoding and decoding independently testable.
- Display and export raw packets as hexadecimal.
- Do not copy ObinsKit source code, UI, icons, or other copyrighted assets.
- Clean-room reimplementation based on observed behavior and packet formats is allowed.
