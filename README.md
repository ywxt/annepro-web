# Anne Pro Web Configurator

A clean-room, read-only WebHID explorer for Anne Pro 2. The MVP requests a supported device, opens it, shows and exports HID collection/report metadata, and records input reports. It intentionally has no HID write API.

## Run locally

Requires a current Chromium-based browser with WebHID (Chrome or Edge) and Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite, click **連接 Anne Pro 2**, and choose the vendor-defined HID interface. WebHID is available only in a secure context: HTTPS or localhost. It is not supported by Firefox or Safari.

The chooser narrows all four supported VID/PID pairs to the descriptor observed on Anne Pro 2 `0xa293`: usage page `0x0001`, usage `0x0000`, with 64-byte input and output reports using report ID 0. The app also examines every previously granted candidate and accepts a vendor-defined collection for other firmware variants. If an older permission still yields only `0x0001 / 0x0006` with no reports, Chrome has exposed the protected standard keyboard collection; choose the newly filtered entry and export its metadata. No output report is sent.

## Linux permissions

If Chrome can see the keyboard but cannot open it, install a narrowly scoped udev rule for vendor `04d9` and the relevant product IDs (`a293`, `a292`, `8008`, `8009`), then reload the rules and reconnect the keyboard. Distribution policies differ; prefer a `TAG+=\"uaccess\"` rule over globally writable device permissions. Chrome protects standard keyboard collections, so the app only identifies and uses the vendor-defined collection exposed by WebHID.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Safety boundary

The transport opens the device, listens for input, and exposes narrowly scoped `readDeviceType()` and `readFirmwareVersion()` operations confirmed by a controlled ObinsKit capture. The UI shows the exact packet and requires confirmation before each one-shot query. No arbitrary `sendReport`, feature-report, firmware write, IAP, erase, or configuration API is exposed.

## Next protocol research

Static analysis and a controlled ObinsKit trace have confirmed `readDeviceType` and `readFirmwareVersion`, as documented in [`research/protocol.md`](research/protocol.md). Every additional command must be independently correlated and captured before it is added as a reviewed protocol function with fixture-based tests and a bounded UI action.

Development is organized by the [`clean-room roadmap`](research/roadmap.md) and [`command matrix`](research/commands.md). Firmware/IAP/erase operations are explicitly deferred from the normal configurator.
