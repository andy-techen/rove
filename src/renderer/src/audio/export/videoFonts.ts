/** Which writing a font is made for: it decides the sample the picker shows. */
export type FontScript = 'latin' | 'chinese'

interface Font {
  /** Installed families to try, in order; a Windows stand-in may follow the Mac one. */
  families: readonly string[]
  generic: 'serif' | 'sans-serif' | 'cursive' | 'monospace'
  script: FontScript
}

/**
 * The fonts words and lyrics can be set in. The video is drawn on this machine and nothing
 * is downloaded, so these are fonts macOS ships, some of them only once the Mac has
 * fetched them (most Chinese ones); `installedFonts` hides any that aren't there. Each
 * falls back to a font of the same kind, so text never goes missing. `clean` has no
 * families: it's the app's own typeface.
 */
export const FONTS = {
  clean: { families: [], generic: 'sans-serif', script: 'latin' },
  classic: { families: ['Iowan Old Style', 'Georgia'], generic: 'serif', script: 'latin' },
  elegant: { families: ['Didot', 'Bodoni 72'], generic: 'serif', script: 'latin' },
  modern: { families: ['Futura', 'Century Gothic'], generic: 'sans-serif', script: 'latin' },
  rounded: { families: ['Arial Rounded MT Bold'], generic: 'sans-serif', script: 'latin' },
  headline: { families: ['DIN Condensed', 'Bahnschrift'], generic: 'sans-serif', script: 'latin' },
  poster: { families: ['Impact', 'Arial Black'], generic: 'sans-serif', script: 'latin' },
  handwritten: { families: ['Bradley Hand', 'Segoe Print'], generic: 'cursive', script: 'latin' },
  notebook: { families: ['Noteworthy', 'Ink Free'], generic: 'cursive', script: 'latin' },
  marker: { families: ['Marker Felt', 'Comic Sans MS'], generic: 'cursive', script: 'latin' },
  playful: { families: ['Chalkboard SE', 'Comic Sans MS'], generic: 'cursive', script: 'latin' },
  chalk: { families: ['Chalkduster'], generic: 'cursive', script: 'latin' },
  script: { families: ['Snell Roundhand', 'Brush Script MT'], generic: 'cursive', script: 'latin' },
  fairytale: { families: ['Luminari', 'Papyrus'], generic: 'serif', script: 'latin' },
  typewriter: {
    families: ['American Typewriter', 'Courier New'],
    generic: 'monospace',
    script: 'latin'
  },
  heiti: {
    families: ['PingFang SC', 'PingFang TC', 'Hiragino Sans GB', 'Microsoft YaHei'],
    generic: 'sans-serif',
    script: 'chinese'
  },
  songti: {
    families: ['Songti SC', 'Songti TC', 'STSong', 'SimSun'],
    generic: 'serif',
    script: 'chinese'
  },
  kaiti: {
    families: ['Kaiti SC', 'Kaiti TC', 'STKaiti', 'KaiTi'],
    generic: 'serif',
    script: 'chinese'
  },
  yuanti: { families: ['Yuanti SC', 'Yuanti TC'], generic: 'sans-serif', script: 'chinese' },
  xingkai: { families: ['Xingkai SC', 'Xingkai TC'], generic: 'cursive', script: 'chinese' },
  hannotate: { families: ['Hannotate SC', 'Hannotate TC'], generic: 'cursive', script: 'chinese' },
  hanzipen: { families: ['HanziPen SC', 'HanziPen TC'], generic: 'cursive', script: 'chinese' },
  wawati: { families: ['Wawati SC', 'Wawati TC'], generic: 'cursive', script: 'chinese' },
  libian: { families: ['Libian SC', 'Libian TC'], generic: 'serif', script: 'chinese' },
  weibei: { families: ['Weibei SC', 'Weibei TC'], generic: 'serif', script: 'chinese' }
} as const satisfies Record<string, Font>
export type FontId = keyof typeof FONTS
export const FONT_IDS = Object.keys(FONTS) as FontId[]
export const DEFAULT_FONT: FontId = 'clean'

const APP_FONT_FALLBACK = 'system-ui, sans-serif'

/** The app's own typeface, so the video looks like Rove made it. */
export function appFontFamily(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-family')
  return family.trim() || APP_FONT_FALLBACK
}

/** The CSS font family for a font: what the canvas draws with and the editor types in. */
export function fontFamilyOf(font: FontId): string {
  const { families, generic } = FONTS[font]
  if (!families.length) return appFontFamily()
  return [...families.map((family) => `'${family}'`), generic].join(', ')
}

// Measured in two generic fonts: a missing family falls back to the generic and measures
// the same, while an installed one can't match both. The text has wide and narrow letters
// and a Chinese character, so Latin and Chinese fonts both show their own widths.
const PROBE_TEXT = 'mmmmwwwiiilll字'
const PROBE_GENERICS = ['monospace', 'serif'] as const

/**
 * The fonts this machine has: one with no installed family would only show its fallback,
 * so it isn't offered. `measure` gives the width of the probe text in a CSS font family.
 */
export function installedFonts(measure: (text: string, family: string) => number): FontId[] {
  const has = (family: string): boolean =>
    PROBE_GENERICS.some(
      (generic) => measure(PROBE_TEXT, `'${family}', ${generic}`) !== measure(PROBE_TEXT, generic)
    )
  return FONT_IDS.filter((id) => {
    const { families } = FONTS[id]
    return !families.length || families.some(has)
  })
}
