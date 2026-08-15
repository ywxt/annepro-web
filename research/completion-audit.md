# Anne Pro 2 C18 completion audit

This audit compares the unpacked ObinsKit 1.2.11 renderer and native operation
names with the configurator. Its scope is the physically available Anne Pro 2 C18
(`04d9:a293`). Firmware/IAP/erase is explicitly outside the project scope.

## C18 user-facing configuration

| Area | ObinsKit behavior | Web status |
| --- | --- | --- |
| Identity and state | model, firmware, uptime, battery, hardware state, LED power, IAP state, UDID, BLE MAC | complete; UDID remains masked/private |
| Key layout | four 61-key layers | read, edit, guarded write, backup, import and readback complete |
| General settings | layout/Fn/tap/brightness/timeout/indicator options | read, option labels, guarded write, snapshot and readback complete |
| Lighting | preview, profile installation, effect palettes and per-key RGB | complete; profiles are host-managed because the device exposes no lighting upload command |
| Macros | config, active list, map and indexed records; full image write | editor, CRC serialization, staged write, semantic readback and restore complete |
| Audio visualization | Pure and Colorful through `writeAudioVisualize` | complete; microphone consent, stop/restore, 20 FPS and single-flight guard |
| BLE hosts | BLE MAC and clear pairings | complete; destructive action requires typed confirmation |
| Factory reset | model-5 defaults, empty macros, 14-effect light group and BLE clear | complete; typed confirmation and pre-reset snapshots |
| Whole-device backup | user configuration represented above | symmetric export/import with schema preflight, staged restore and available readbacks |

## Correctly excluded native operations

| Group | Reason |
| --- | --- |
| `writeIapMode`, `writeIapMemory`, `writeEraseMemory` | firmware/IAP/flash operations are explicitly excluded |
| OLED operations | T70-only renderer capability |
| virtual mouse command `60` | other-model capability; C18 produced no response |
| combination mode `01/f1` | gated to T70; C18 produced no response |
| indicator location and alternate CapsLock color | D87/T70/Discovery model paths; C18 uses `20/1a` and `20/1b` |
| battery percentage query | Discovery path; C18 uses the battery ADC query and ObinsKit curve |
| audio config/data `21/01`, `21/02` | advanced MCU_LED path not used by the C18 keyboard music page |

## Internal operations not presented as configuration

`readMcuUUID`, `writeUDID`, `resetPowerOnTime`, and `writeBacklightAuto` have native
symbols but are not ordinary C18 renderer-visible configuration. `writeUDID` is an
identity/activation mutation, while resetting accumulated runtime changes diagnostic
state. They are deliberately not exposed merely to make the native symbol list match.

## Remaining compatibility work

The C18 command surface is complete for the available hardware. Product IDs and
firmware families that are not physically available remain unverified; their
model-specific commands must stay capability-gated until tested on matching devices.
