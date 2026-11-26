import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'

// The app's source, so the site shares its design tokens, icons and wordmark.
const appSrc = fileURLToPath(new URL('../src', import.meta.url))

export default defineConfig({
  // Served by GitHub Pages at andy-techen.github.io/rove. With a custom domain, set
  // `site` to it and drop `base`.
  site: 'https://andy-techen.github.io',
  base: '/rove',
  vite: {
    resolve: { alias: { '@app': appSrc } },
    // Let the dev server read the app's files, which sit outside site/.
    server: { fs: { allow: ['..'] } }
  }
})
