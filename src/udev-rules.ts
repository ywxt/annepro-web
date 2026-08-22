import { OBINS_USB_DEVICES, type ObinsUsbDevice } from './device-registry.ts'

function hex(value: number): string { return value.toString(16).padStart(4, '0') }

function rule(device: ObinsUsbDevice, access: string): string {
  const vendorId = hex(device.vendorId)
  const productId = hex(device.productId)
  return `# ${device.family} (${vendorId}:${productId})\nSUBSYSTEM=="hidraw", KERNEL=="hidraw*", ATTRS{idVendor}=="${vendorId}", ATTRS{idProduct}=="${productId}", ${access}`
}

/** systemd-logind grants the active local session access when this file runs before 73-seat-late.rules. */
export function standardLinuxUdevRules(devices: readonly ObinsUsbDevice[] = OBINS_USB_DEVICES): string {
  return ['# ObinsLab keyboard WebHID access — exact known VID/PID pairs', ...devices.map(device => rule(device, 'TAG+="uaccess"'))].join('\n')
}

/** NixOS emits extraRules as 99-local.rules, so use an explicit narrow group ACL instead of a late uaccess tag. */
export function nixosUdevModule(devices: readonly ObinsUsbDevice[] = OBINS_USB_DEVICES): string {
  const rules = devices.map(device => rule(device, 'GROUP:="users", MODE:="0660"'))
    .join('\n').split('\n').map(line => `    ${line}`).join('\n')
  return `{ ... }:\n\n{\n  services.udev.extraRules = ''\n${rules}\n  '';\n}`
}
