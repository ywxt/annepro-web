# Anne Pro Web Configurator

An open-source WebHID configurator for Anne Pro 2. Protocol compatibility is
implemented with direct reference to ObinsKit 1.2.11. It connects directly from
the browser without a backend and supports device information, all four keyboard
layers, ordinary settings, CapsLock color, lighting profiles, macros, audio
visualization, battery/runtime information, BLE management, and guarded factory
reset. IAP and firmware modification are deliberately excluded.

## Run locally

Requires Nix with flakes enabled and a current Chromium-based browser with WebHID (Chrome or Edge). The project flake selects Node.js 24, pnpm, and native-addon build tools.

```sh
nix develop
pnpm install
pnpm dev
```

With nix-direnv enabled, run `direnv allow` once; the checked-in `.envrc` then loads the same flake automatically whenever the directory is entered.

Open the localhost URL printed by Vite, click **選擇 Anne Pro 2**, and choose the
protocol interface. The app automatically reads the model and supported
configuration, then presents capability-gated **Device**, **Keys**, **Lighting**,
**Macros**, and **Settings** workspaces. Once permission has been granted, **快速重連** opens the
preferred interface without showing the chooser. WebHID is available only in a
secure context: HTTPS or localhost. It is not supported by Firefox or Safari.

The language selector switches the complete user interface and runtime notices
between Traditional Chinese and English and remembers the choice in browser
storage. Raw HID collections, input reports, frame bytes, and protocol controls
are collapsed under **Developer tools** rather than mixed into normal setup.

The chooser narrows all four supported VID/PID pairs to the descriptor observed
on Anne Pro 2 `0xa293`: usage page `0x0001`, usage `0x0000`, with 64-byte input
and output reports using report ID 0. The app also examines every previously
granted candidate and accepts a vendor-defined collection for other firmware
variants. If Chrome exposes only the protected `0x0001 / 0x0006` keyboard
collection, choose the newly filtered entry and inspect its exported metadata.
USB removal is detected; reconnect the keyboard and use **快速重連**.

The landing page detects Linux, Windows, or macOS and shows the relevant setup
guide. Windows and macOS need no extra driver; close ObinsKit before connecting
so it does not hold the HID interface. Linux normally needs a narrow
`TAG+="uaccess"` hidraw rule. The page provides one rule for every supported PID
and the commands needed to reload the rules.

## Supported configuration

- Device model, firmware versions, IAP state (read only), masked UDID, BLE MAC,
  battery voltage/estimate, cumulative runtime, HID collections, and raw reports.
- Read, export, edit, verify, and restore all four 61-key layers with named HID
  and Anne Pro keycodes, presented as Base, Fn1, Fn2, and Tap Layer. The editor
  follows real ANSI 60% key widths and uses categorized key selection rather
  than requiring raw numeric keycodes; Transparent renders as a blank keycap.
- Read and modify layout selection, Magic Fn, macro enable, CapsLock behavior and
  RGB, backlight brightness, auto-sleep, Tap mode/timeout, sleep timeout, and LED
  power mode.
- Read/export/edit/install/restore macro images with CRC and active bindings.
- Export and restore one complete versioned backup containing settings, all four
  layers, macros, CapsLock RGB, and the current host-managed light profile. The
  entire file is validated before the first write and readable sections are
  verified after restoration.
- Create, import, export, preview, and install static, per-key, and dynamic light
  profiles; stream microphone visualization at a bounded 20 FPS.
- Clear BLE host bindings and perform ObinsKit-equivalent non-firmware factory
  reset behind typed destructive confirmation.

Lighting firmware has no list-read command, so the app manages light profiles in
browser storage and cannot back up a list already installed by another tool.

## Compatibility

| VID:PID | Expected mode | Status |
| --- | --- | --- |
| `04d9:a293` | Anne Pro 2 C18 normal USB | Physically verified, key `2.36`, LED `2.33`, BLE `2.05` |
| `04d9:a292` | Anne Pro 2 variant | Filtered and capability-detected; physical verification pending |
| `04d9:8008` | Alternate Anne Pro mode | Filtered; physical verification pending |
| `04d9:8009` | Alternate Anne Pro mode | Filtered; physical verification pending |

Unknown models remain visible for metadata inspection but configuration controls
requiring an Anne Pro 2 profile stay capability-gated.

## Platform permissions

Windows and macOS normally require only Chrome or Edge and permission through
the browser chooser. Linux additionally needs a narrowly scoped udev rule for
vendor `04d9` and the relevant product IDs (`a293`, `a292`, `8008`, `8009`).
Distribution policies differ; prefer `TAG+="uaccess"` over globally writable
device permissions. Chrome protects standard keyboard collections, so the app
only identifies and uses the vendor-defined collection exposed by WebHID.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Safety boundary

The transport exposes typed and bounded operations rather than an arbitrary
packet API. Persistent readable data is backed up before its first edit and
verified by device readback. Macro images use ObinsKit's complete
map/content/CRC format and 49-byte USB chunks. Lighting previews and audio frames
are bounded fire-and-forget operations because C18 provides no acknowledgement.
`readIapMode` only reports state: no firmware write, IAP switch, flash erase, or
firmware-memory operation is implemented.

## Protocol evidence

Static analysis, controlled `/dev/hidraw10` captures, and same-value physical
round trips are documented in [`research/protocol.md`](research/protocol.md).
Development status and command evidence live in the
[`implementation roadmap`](research/roadmap.md) and
[`command matrix`](research/commands.md).
