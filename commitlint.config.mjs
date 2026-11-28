// Commit messages follow Conventional Commits; docs/development.md explains each scope.
const SCOPES = [
  'record',
  'timeline',
  'polish',
  'pitch',
  'music',
  'chords',
  'lyrics',
  'voice',
  'export',
  'songbook',
  'explore',
  'catalog',
  'settings',
  'premium',
  'keys',
  'menu',
  'main',
  'ui',
  'site',
  'deps'
]

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', SCOPES]
  }
}
