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
  const effect = (name: string, type: number, staticColors: string[], dynamicColors = [...RAINBOW]): LightEffect => ({
    name, type, staticColors, dynamicColors,
  })
  return [
    ...staticColors.map(([name, color]) => effect(name, 1, Array<string>(61).fill(color))),
    effect('Blue', 1, Array<string>(61).fill('#0000ff')),
    effect('Purple', 1, Array<string>(61).fill('#ff00ff')),
    effect('Static multi', 2, [
        ...Array<string>(14).fill('#ff0000'), ...Array<string>(14).fill('#ffff00'),
        ...Array<string>(13).fill('#00ff00'), ...Array<string>(12).fill('#00ffff'),
        ...Array<string>(8).fill('#ff00ff'),
      ]),
    ...[['Breath', 3], ['Gradient breath', 4], ['Rainbow', 6], ['Single breath', 7], ['Poptang', 5], ['Trigger breath', 10], ['Trigger rainbow', 11]]
      .map(([name, type]) => effect(String(name), Number(type), Array<string>(61).fill('#000000'))),
  ]
}
