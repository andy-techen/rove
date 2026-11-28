import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT, FONTS, FONT_IDS, fontFamilyOf, installedFonts } from './videoFonts'

/** A fake measure where only `installed` families change the width. */
const measureWith =
  (installed: string[]) =>
  (_text: string, family: string): number => {
    const named = installed.findIndex((name) => family.includes(`'${name}'`))
    return named >= 0 ? 100 + named : family.includes('serif') ? 50 : 40
  }

describe('installedFonts', () => {
  it('offers only fonts with an installed family, and always the app’s own', () => {
    expect(installedFonts(measureWith(['Futura', 'Kaiti SC']))).toEqual([
      DEFAULT_FONT,
      'modern',
      'kaiti'
    ])
  })

  it('counts a Windows stand-in as installed', () => {
    expect(installedFonts(measureWith(['Microsoft YaHei']))).toContain('heiti')
  })

  it('offers everything when every family is installed', () => {
    const all = FONT_IDS.flatMap((id) => [...FONTS[id].families])
    expect(installedFonts(measureWith(all))).toEqual(FONT_IDS)
  })
})

describe('fontFamilyOf', () => {
  it('lists the families in order, ending on a generic fallback', () => {
    expect(fontFamilyOf('kaiti')).toBe("'Kaiti SC', 'Kaiti TC', 'STKaiti', 'KaiTi', serif")
  })
})
