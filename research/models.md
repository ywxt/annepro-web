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

Only model IDs 3 and 5 currently receive Anne Pro 2 configuration capabilities in
the web app. All other identifiers are named for diagnostics but remain disabled
until their descriptors, layout geometry, command responses, and writes are tested.
