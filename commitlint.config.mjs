// Commit messages follow Conventional Commits; docs/development.md explains each scope.
const SCOPES = [
  'record',
  'timeline',
  'polish',
  'music',
  'lyrics',
  'export',
  'songbook',
  'app',
  'main',
  'ui',
  'site'
]

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', SCOPES]
  }
}
