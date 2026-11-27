import { describe, expect, it } from 'vitest'
import { pinnedThemes, rootRules } from './theme'

// Like the app's tokens: dark by default, light from a query.
const tokens = `
:root {
  --bg: black;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: white;
  }
}
`
// Like the site's styles: light by default, dark from a query.
const site = `
:root {
  --sky: gold;
}

@media (prefers-color-scheme: dark) {
  :root {
    --sky: dusk;
  }
}
`

const ruleFor = (css: string, scheme: string) =>
  css.split(`:root[data-theme='${scheme}']`)[1].split('}')[0]

describe('rootRules', () => {
  it('reads the base :root and the one inside each theme query', () => {
    const rules = rootRules(tokens)
    expect(rules.base).toContain('--bg: black')
    expect(rules.schemes.light).toContain('--bg: white')
    expect(rules.schemes.dark).toBeUndefined()
  })
})

describe('pinnedThemes', () => {
  it('pins light with the light query of one sheet and the base of the other', () => {
    const light = ruleFor(pinnedThemes([tokens, site]), 'light')
    expect(light).toContain('--bg: white')
    expect(light).toContain('--sky: gold')
    expect(light).toContain('color-scheme: light')
  })

  it('pins dark the other way round', () => {
    const dark = ruleFor(pinnedThemes([tokens, site]), 'dark')
    expect(dark).toContain('--bg: black')
    expect(dark).toContain('--sky: dusk')
  })

  it('leaves out a sheet with no theme query', () => {
    expect(pinnedThemes([':root { --font: round; }'])).not.toContain('--font')
  })
})
