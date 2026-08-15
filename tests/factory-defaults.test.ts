import { describe, expect, it } from 'vitest'
import { annePro2FactoryLights, ANNE_PRO_2_FACTORY_SETTINGS } from '../src/protocol/factory-defaults.ts'
import { encodeLightRgb } from '../src/protocol/lighting.ts'

describe('Anne Pro 2 factory defaults', () => {
  it('matches ObinsKit model-5 general defaults', () => {
    expect(ANNE_PRO_2_FACTORY_SETTINGS).toMatchObject({ userLayout: 0, tapStatus: 1, tapTimeoutValue: 26, sleepTimeoutRaw: 600, ledPowerMode: 1 })
  })
  it('contains the final ordered fourteen-effect ObinsKit 1.2.11 default group', () => {
    const effects = annePro2FactoryLights()
    expect(effects.map(effect => effect.type)).toEqual([1, 1, 1, 1, 2, 1, 2, 3, 4, 6, 7, 5, 10, 11])
    expect(effects).toHaveLength(14)
    expect(effects[6].colors).toHaveLength(61)
    effects.forEach(effect => expect(() => encodeLightRgb(effect)).not.toThrow())
  })
  it('returns independent mutable copies', () => {
    const first = annePro2FactoryLights()
    first[0].colors[0] = '#000000'
    expect(annePro2FactoryLights()[0].colors[0]).toBe('#ff0000')
  })
})
