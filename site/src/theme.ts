// The site follows the system's light or dark theme through media queries in the app's
// tokens and the site's own styles. Choosing a theme by hand can't change what a media
// query sees, so these rules re-apply the chosen theme's values under
// <html data-theme>, read from the same stylesheets so no colour is written twice.

export type Scheme = 'light' | 'dark'

/** Where the singer's choice is kept, in this browser only. */
export const THEME_KEY = 'rove-theme'

const SCHEMES: Scheme[] = ['light', 'dark']

interface RootRules {
  /** The declarations of the sheet's top-level :root rule. */
  base: string
  /** The declarations of its :root rule inside each prefers-color-scheme query. */
  schemes: Partial<Record<Scheme, string>>
}

/** The :root declarations a stylesheet sets, outside and inside its theme queries. */
export function rootRules(css: string): RootRules {
  const base = /^:root\s*\{([^}]*)\}/m.exec(css)?.[1] ?? ''
  const schemes: RootRules['schemes'] = {}
  const query = /@media \(prefers-color-scheme: (light|dark)\)\s*\{\s*:root\s*\{([^}]*)\}/g
  for (const [, scheme, body] of css.matchAll(query)) schemes[scheme as Scheme] = body
  return { base, schemes }
}

/** Rules that pin each theme under <html data-theme>, whatever the system prefers. */
export function pinnedThemes(sheets: string[]): string {
  const rules = sheets.map(rootRules)
  return SCHEMES.map((scheme) => {
    const other: Scheme = scheme === 'light' ? 'dark' : 'light'
    // A sheet whose query is for this theme supplies it; one whose query is for the
    // other theme has this one as its base, which must win over that query again.
    const body = rules.map((r) => r.schemes[scheme] ?? (r.schemes[other] ? r.base : '')).join('\n')
    return `:root[data-theme='${scheme}'] {${body}\n  color-scheme: ${scheme};\n}`
  }).join('\n')
}
