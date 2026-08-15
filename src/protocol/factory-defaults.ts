import type { LightEffect } from './lighting.ts'
import type { HardwareSettingKey } from './settings-write.ts'

const RAINBOW = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080'] as const

export const ANNE_PRO_2_FACTORY_SETTINGS: Readonly<Record<HardwareSettingKey, number>> = {
  userLayout: 0,
  tapStatus: 1,
  tapTimeoutValue: 26,
  tapActMode: 2,
  backlightBrightness: 10,
  capslockLed: 0,
  macroTrigger: 0,
  magicFn: 0,
  ledHold: 1,
  sleepTimeoutRaw: 600,
  ledPowerMode: 1,
}

/** ObinsKit 1.2.11 model-5 default group, expressed in the wire-level palettes. */
export function annePro2FactoryLights(): LightEffect[] {
  const staticColors = [
    ['Red', '#ff0000'], ['Yellow', '#ffff00'], ['Green', '#00ff00'],
    ['Cyan', '#00ffff'],
  ] as const
  return [
    ...staticColors.map(([name, color]) => ({ name, type: 1, colors: [color] })),
    { name: 'Blue', type: 2, colors: Array<string>(61).fill('#0000ff') },
    { name: 'Purple', type: 1, colors: ['#ff00ff'] },
    {
      name: 'Static multi', type: 2,
      colors: [
        ...Array<string>(14).fill('#ff0000'), ...Array<string>(14).fill('#ffff00'),
        ...Array<string>(13).fill('#00ff00'), ...Array<string>(12).fill('#00ffff'),
        ...Array<string>(8).fill('#ff00ff'),
      ],
    },
    { name: 'Breath', type: 3, colors: [...RAINBOW] },
    { name: 'Gradient breath', type: 4, colors: [...RAINBOW] },
    { name: 'Rainbow', type: 6, colors: [...RAINBOW] },
    { name: 'Single breath', type: 7, colors: [...RAINBOW] },
    { name: 'Poptang', type: 5, colors: [...RAINBOW] },
    { name: 'Trigger breath', type: 10, colors: [...RAINBOW] },
    { name: 'Trigger rainbow', type: 11, colors: [...RAINBOW] },
  ]
}
