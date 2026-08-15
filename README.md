# Anne Pro Web Configurator

A clean-room, read-only WebHID explorer for Anne Pro 2. The MVP opens a supported device, exports HID metadata, records input reports, reads confirmed device information, and renders the captured Layer 0 keymap. It intentionally has no arbitrary HID or configuration-write API.

## Run locally

Requires Nix with flakes enabled and a current Chromium-based browser with WebHID (Chrome or Edge). The project flake selects Node.js 24, pnpm, and native-addon build tools.

```sh
nix develop
pnpm install
pnpm dev
```

With nix-direnv enabled, run `direnv allow` once; the checked-in `.envrc` then loads the same flake automatically whenever the directory is entered.

Open the localhost URL printed by Vite, click **連接 Anne Pro 2**, and choose the vendor-defined HID interface. WebHID is available only in a secure context: HTTPS or localhost. It is not supported by Firefox or Safari.

The chooser narrows all four supported VID/PID pairs to the descriptor observed on Anne Pro 2 `0xa293`: usage page `0x0001`, usage `0x0000`, with 64-byte input and output reports using report ID 0. The app also examines every previously granted candidate and accepts a vendor-defined collection for other firmware variants. If an older permission still yields only `0x0001 / 0x0006` with no reports, Chrome has exposed the protected standard keyboard collection; choose the newly filtered entry and export its metadata. Output reports are sent only after per-action confirmation for the fixed read-only queries described below.

## Linux permissions

If Chrome can see the keyboard but cannot open it, install a narrowly scoped udev rule for vendor `04d9` and the relevant product IDs (`a293`, `a292`, `8008`, `8009`), then reload the rules and reconnect the keyboard. Distribution policies differ; prefer a `TAG+=\"uaccess\"` rule over globally writable device permissions. Chrome protects standard keyboard collections, so the app only identifies and uses the vendor-defined collection exposed by WebHID.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Safety boundary

The transport opens the device, listens for input, and exposes narrowly scoped `readDeviceType()`, `readFirmwareVersion()`, `readIapMode()`, and Layer 0 read operations confirmed by controlled captures. The UI shows the exact packet and requires confirmation before each one-shot query. `readIapMode` only reports the state code and cannot switch modes. No arbitrary `sendReport`, feature-report, firmware write, IAP switch, erase, or configuration API is exposed.

## Next protocol research

Static analysis and controlled captures have confirmed the current identity, firmware, IAP-state, and Layer 0 reads, as documented in [`research/protocol.md`](research/protocol.md). Every additional command must be independently correlated and captured before it is added as a reviewed protocol function with fixture-based tests and a bounded UI action.

Development is organized by the [`clean-room roadmap`](research/roadmap.md) and [`command matrix`](research/commands.md). Firmware/IAP/erase operations are explicitly deferred from the normal configurator.
