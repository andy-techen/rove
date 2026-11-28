import * as OpenCC from 'opencc-js'
import type { CatalogLanguage } from '../../src/shared/online/catalog'

// Chinese songs are shown in traditional characters, whatever script MusicBrainz or
// Deezer spell them in; the simplified spelling stays an alias so search still finds it.
// Characters only (OpenCC s2tw), no regional word swaps, so names aren't reworded.
const convert = OpenCC.Converter({ from: 'cn', to: 'tw' })

export function isChinese(language: CatalogLanguage | null): boolean {
  return language === 'zh-Hans' || language === 'zh-Hant'
}

export function toTraditional(text: string): string {
  return convert(text)
}
