import { describe, expect, it } from 'vitest'
import { OBINS_USB_DEVICES } from '../src/device-registry.ts'
import { nixosUdevModule, standardLinuxUdevRules } from '../src/udev-rules.ts'

describe('Linux WebHID permission guidance', () => {
  it('emits one narrowly scoped systemd uaccess rule per known VID/PID', () => {
    const rules = standardLinuxUdevRules()
    expect(rules.match(/SUBSYSTEM=="hidraw"/g)).toHaveLength(OBINS_USB_DEVICES.length)
    expect(rules.match(/TAG\+="uaccess"/g)).toHaveLength(OBINS_USB_DEVICES.length)
    expect(rules).not.toContain('MODE="0666"')
    expect(rules).not.toContain('SUBSYSTEM=="input"')
    expect(rules).not.toContain('SUBSYSTEM=="usb"')
    expect(rules).not.toContain('udev-acl')
  })

  it('emits a declarative NixOS module without a late uaccess tag', () => {
    const module = nixosUdevModule()
    expect(module).toContain("services.udev.extraRules = ''")
    expect(module.match(/SUBSYSTEM=="hidraw"/g)).toHaveLength(OBINS_USB_DEVICES.length)
    expect(module).toContain('GROUP:="users", MODE:="0660"')
    expect(module).not.toContain('uaccess')
    expect(module).not.toContain('MODE="0666"')
  })
})
