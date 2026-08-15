# Project: Anne Pro Web Configurator

Build an open-source WebHID configurator for Anne Pro 2. The user has authorized
direct reference to the unpacked ObinsKit JavaScript, native addon, and protocol
implementation; clean-room separation is not required for protocol work.

## Current phase

Implement the complete configurator, including ordinary configuration writes:

- Preserve a device backup whenever the protocol offers a read path.
- Show semantic and byte-level differences before writes.
- Keep writes bounded, typed, confirmed, and followed by readback verification.
- Keep HID transport separate from Vue UI and protocol code.
- Add protocol fixtures and tests for packet encoding, parsing, and guards.

## Safety

The user has explicitly authorized ordinary configuration changes on the current
keyboard, including layout, macro, lighting, and general-setting commands.
Configuration writes must remain bounded and must not retry indefinitely.
IAP mode switching, firmware/memory writes, and flash erase remain excluded and
must not be implemented or sent.

## Engineering

- Use TypeScript, Vue 3, Vite, native WebHID, and Vitest. Do not construct the application UI as HTML strings in `main.ts`.
- Use the checked-in `flake.nix` as the Node.js/pnpm development environment (`nix develop`). Let pnpm manage `node_modules`; do not Nix-package JavaScript dependencies.
- Run on localhost or HTTPS.
- Keep packet encoding and decoding independently testable.
- Display and export raw packets as hexadecimal.
- Protocol constants, parsers, data structures, and control flow may be directly
  derived from the unpacked ObinsKit implementation.
- Do not import ObinsKit UI, icons, branding, or bundled visual assets unless the
  user separately requests and confirms the licensing implications.
