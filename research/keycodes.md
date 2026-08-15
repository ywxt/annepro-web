# Keycode mapping notes

This is a clean-room interoperability table derived from behavior and numeric
constants in the unpacked, SHA-256-verified ObinsKit 1.2.11 Electron bundle.
It does not reproduce ObinsKit UI assets or implementation code.

## Renderer path

- Bundle module `98170` returns one-byte layout values unchanged for Anne Pro 2
  C18. Only the T70 model combines adjacent bytes into little-endian 16-bit values.
- Bundle module `71814` assigns numeric constants to standard HID keyboard usages
  and Obins extensions.
- Bundle module `2260` maps supported values to renderer labels. Its C18-visible
  Fn labels are one-based: byte `c0` displays as Fn1 and `c1` as Fn2.

## Anne Pro extensions observed in the captured layers

| Bytes | Meaning |
| --- | --- |
| `c0`–`c3` | Fn1–Fn4 renderer labels |
| `c8`–`cb` | Bluetooth slots 1–4 |
| `cc` | Bluetooth on |
| `cf` | Fn wheel |
| `ee`–`ef` | OLED up/down |
| `f0`–`f6` | Backlight toggle, color, level, increase, decrease, rate, battery |
| `f7` | QuickNumber |
| `f8`–`fa` | Mouse buttons 1–3 |
| `fb`–`fe` | Mouse up, down, left, right |

Byte `01` needs contextual treatment. The generic HID enum calls it a rollover
error, but ObinsKit deliberately has no renderer label for it. In the captured
Layers 1–3 it fills most positions while a smaller set overrides Layer 0, which
strongly indicates transparent/inherit semantics in the keyboard layout format.
The web UI therefore labels it `Transparent`; this is a behavioral inference,
not a claim that the underlying USB HID usage changed meaning globally.

Unknown values remain visible as hexadecimal instead of being guessed.
