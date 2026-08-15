# Project: Anne Pro Web Configurator

Build a clean-room, open-source WebHID configurator for Anne Pro 2.

## Current phase

Only implement safe, read-only device exploration:

- Request and open supported Anne Pro 2 devices.
- Display device, collection, and report metadata.
- Record input reports.
- Keep HID transport separate from Vue UI and protocol code.
- Add tests for packet formatting and metadata extraction.

## Safety

The user has explicitly authorized bounded discovery sends for commands that static analysis or captured behavior indicates are read-only. Such probes must be fixed, single-shot, low-frequency, response-bounded, recorded, and never automatically retried. Do not send commands that may mutate configuration, switch IAP mode, write firmware/memory, erase flash, or perform an unknown-direction operation without separate explicit approval. Do not implement firmware updates in early versions.

## Engineering

- Use TypeScript, Vue 3, Vite, native WebHID, and Vitest. Do not construct the application UI as HTML strings in `main.ts`.
- Use the checked-in `flake.nix` as the Node.js/pnpm development environment (`nix develop`). Let pnpm manage `node_modules`; do not Nix-package JavaScript dependencies.
- Run on localhost or HTTPS.
- Keep packet encoding and decoding independently testable.
- Display and export raw packets as hexadecimal.
- Do not copy ObinsKit source code, UI, icons, or other copyrighted assets.
- Clean-room reimplementation based on observed behavior and packet formats is allowed.
