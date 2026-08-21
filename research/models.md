# ObinsKit 1.2.11 device families

This inventory comes from enum module `46733`, model-profile loader module `85391`,
and the HID discovery tables in the unpacked Electron bundle. A model being listed
does not mean that its wire format has been physically verified by this project.

## Model identifiers returned by `readDeviceType`

| ID | ObinsKit enum | Notable profile behavior |
| ---: | --- | --- |
| 1 | Anne | legacy profile |
| 2 | AnnePro | Anne Pro 1 |
| 3 | AnnePro2 | Anne Pro 2 shared profile |
| 4 | AnneProISO | Anne Pro 2 ISO profile |
| 5 | AnnePro2C18 | Anne Pro 2 C18; physically verified here |
| 6 | Param68 | 68-key profile |
| 7 | AnneClassicD87 | indicator LED; profile reused by W800 |
| 8 | ApxF61 | F61 profile |
| 9 | RETURNEDWING | Returned Wing profile |
| 10 | ANNEPRO2SLIM | Anne Pro 2 Slim profile |
| 11 | ApxFuji65 | Fuji65; renderer reports no normal LED capability |
| 12 | ApxTenet | Tenet 70 / T70; OLED and 16-bit keycode paths |
| 13 | ApxFuji65Rgb | Fuji65 RGB profile |
| 14 | AnnePro2Discovery | Discovery-specific battery and lighting paths |
| 17 | ApxF61V2 | F61 V2 profile |
| 33 | W800 | reuses the D87 physical profile |

IDs 15 and 16 are absent from the 1.2.11 enum. The model number is distinct from
USB VID/PID and is obtained only after the Liana `01/01` response.

## HID discovery families in the Electron main process

- Vendor `0x0483`: Anne Pro 1, PID `0x5710`.
- Vendor `0x04d9`: Anne Pro 2 normal/IAP variants, PIDs `0x8008`, `0xa292`,
  `0x8009`, and `0xa293`.
- Vendor `0x3311`: extended family PIDs `0xa294`–`0xa299` and
  `0xf000`–`0xf003`, `0xf005`, `0xf006`.
- Vendor `0x000d`, PID `0xf0e0`: a special Anne Pro 2 discovery entry selected
  through vendor-defined usage page `0xff00`.

## Protocol families

The devices share the native `Liana` transport, but their payload models and
renderer routes differ. C18 uses four 61-byte, 8-bit key layers. T70 has OLED
date/time, image, text, and monitor operations and combines adjacent key bytes into
16-bit values. Discovery has a distinct battery-percentage query. D87/T70/Discovery
use indicator-location/color variants. Some MCU-LED devices use advanced audio
commands `21/01` and `21/02`, while Anne Pro 2 uses `20/11`.

Only model IDs 3 and 5 currently receive the complete Anne Pro 2 configuration
workspace. The official lazy profile data is now represented for every listed
model, including key count, row geometry, RGB holes, macro matrix offsets, MCU
routes, bottom-light metadata, and Tenet's 16-bit keycode width. Discovery uses its
native `01/11` direct battery-percentage read. D87's `20/18` indicator-location read
and `20/19` write are implemented as typed product operations with backup and write
readback. Other model-specific settings remain capability-disabled rather than
falling through to the C18 implementation.

The layout codec no longer assumes 61 bytes. It derives 8-bit payload sizes from
each official profile and reproduces ObinsKit's Tenet 70 conversion to 73 UInt16LE
keycodes (146 bytes). Multipart downloads retain the native 52-byte data chunk and
therefore use three reports for Tenet. The product renders these model-specific
layouts, while clearly marking non-C18 profiles as partially supported until write
readbacks can be verified on matching hardware.

The Tenet OLED protocol layer now covers the native `70/01`, `70/05`, `70/07`,
`70/08`, and `70/09` actions. Image and text transfers use the renderer's 256x32
canvas conversion to two 4-bit grayscale pixels per byte and exactly 128 indexed
pages. The Tenet-only product workspace exposes these bounded operations and the
read-only combination-mode status; acknowledgement shape and display output still
need verification on model 12 hardware.

Fuji65 RGB (model 13) now selects the official bottom-light surface instead of the
66-key RGB surface. Its 16 editable LEDs are expanded through `bottomLightBlank`
into the 32-position wire strip and reuse the native light-list/download commands.
The non-RGB Fuji65 (model 11) remains lighting-disabled, matching ObinsKit's
`isHaveLed` gate.

The product lighting gate now reproduces ObinsKit's model getter: every known model
except the non-RGB Fuji65 (model 11) receives its profile-sized lighting workspace.
Writes still use the common native preview/list/download queue with per-model key
count, RGB holes, and effect limit; only the physically captured C18 response is
classified as hardware-verified.

The key workspace now decodes raw layer bytes before rendering: 8-bit models show
their profile row counts, while Tenet shows 73 keys instead of 146 individual bytes.
Standalone layer backups store semantic keycodes and record their width; import
validates the connected model's key count and range before re-encoding. A hardware
state preflight is required before the four-layer write transaction can begin.

The WebHID chooser now includes every exact VID/PID pair in the Electron discovery
table. Known non-C18 models use their own geometry and explicitly gated protocol
branches; C18-only settings, macros, Bluetooth mutations, factory reset and full
restore never fall through to them. Unknown model IDs remain metadata-only.

## What “C18 support” means

`AnnePro2C18` is exactly model ID 5 in this ObinsKit release; it is not a family of
multiple model IDs. The normal device physically verified by this project is
`0x04d9:0xa293`. ObinsKit also discovers `0x8008`, `0xa292`, and `0x8009`, but those
PIDs cover normal/IAP generations and do not independently prove model 5. The web
chooser accepts all four so it can read identity, then uses the `01/01` model reply
and capability profile before enabling configuration. Model 3 (`AnnePro2`) shares
ObinsKit's Anne Pro 2 physical profile and is kept compatible, but remains a distinct
model rather than being relabeled C18.
