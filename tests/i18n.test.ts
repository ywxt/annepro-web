import { describe, expect, it } from 'vitest'
import { appLocale, i18n, messages, setAppLocale } from '../src/i18n.ts'

function paths(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' ? paths(child as object, path) : [path]
  }).sort()
}

describe('user interface translations', () => {
  it('keeps Traditional Chinese and English message keys in lockstep', () => {
    expect(paths(messages['zh-TW'])).toEqual(paths(messages.en))
  })

  it('uses the product-facing names for all four layers', () => {
    expect(messages['zh-TW'].layer).toMatchObject({ 0: 'Base Layer', 1: 'Fn1 Layer', 2: 'Fn2 Layer', 3: 'Tap Layer' })
    expect(messages.en.layer).toMatchObject({ 0: 'Base Layer', 1: 'Fn1 Layer', 2: 'Fn2 Layer', 3: 'Tap Layer' })
  })

  it('switches the global translator immediately', () => {
    setAppLocale('en')
    expect(appLocale.value).toBe('en')
    expect(i18n.global.t('nav.settings')).toBe('Settings')
    setAppLocale('zh-TW')
    expect(appLocale.value).toBe('zh-TW')
    expect(i18n.global.t('nav.settings')).toBe('設定')
  })
})
