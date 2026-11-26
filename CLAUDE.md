# Rove — guidelines for contributors (human and AI)

Rove is an Electron + React + TypeScript desktop app for recording vocals over a
backing track, for people who love to sing. `README.md` has the roadmap. The guidelines
below keep the codebase from building up debt; follow them for every change.

- Brand (who it's for, feel, voice, principles; check features against it): @docs/brand.md
- Design guidelines and patterns: @docs/design.md
- Development guidelines and patterns: @docs/development.md
- Writing tests: @docs/testing.md
- How the app fits together (processes, data flow, files): [docs/architecture.md](docs/architecture.md)

## Layout

```
src/
  main/                Electron main process (file system, dialogs, permissions)
    ipc/               One file per IPC area, plus pure helpers with tests
  preload/             The window.api bridge (thin; types in index.d.ts)
  shared/              Used by both main and renderer
    copy/en.json       Every user-facing string
    constants.ts       Constants both sides need
  renderer/src/
    audio/             Web Audio, by area: engine, mix, polish, pitch, music, voice,
                       separation, export, encode, dsp, worklets
    state/             Logic and hooks, by area: song (project, undo, saving), editing,
                       tabs, transport, processing, lyrics, chords, voice, license,
                       commands, ui
    components/        One folder per component; shared building blocks in ui/
    styles/            Design tokens and base styles
docs/                  Brand, design, development, testing and architecture
```

## Working in this repo

- `npm run dev` — the app, restarting on main/preload changes.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- A pre-commit hook (husky + lint-staged) lints and formats staged files and runs the
  typecheck; a commit with lint or type errors is rejected. Don't bypass it.
- Microphone access in development is attributed to the app that launched
  `npm run dev`; run it from your own terminal.
- Never start Electron from automated tooling to "check the UI": it asks macOS for the
  microphone. For UI checks, serve the renderer alone with plain Vite and stub
  `window.api`.

## Non-negotiables

- Recordings are never modified or deleted: edits change clip windows in
  `project.json`, never audio files.
- The renderer only touches song folders the main process opened for it.
- Every slider maps into a safe range; nothing the user can do should clip or blast.
