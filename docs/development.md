# Development guidelines and patterns

## TypeScript only

- All source is `.ts` / `.tsx`, including audio worklets. Worklets are imported with
  `?worker&url` so Vite compiles each into its own file for `audioWorklet.addModule`.
- `noImplicitAny` is on. No `any`; prefer narrow types and discriminated unions.
  Exported functions have explicit return types (enforced by lint).

## Where logic lives

- **Components render and wire events.** They don't compute what to show or decide
  what's allowed.
- **Selectors** (`state/song/selectors.ts`) derive view data from the project: what each
  timeline lane shows, whether Split is possible, whether recording can start.
- **Project operations** (`state/song/project.ts`) are pure functions that return a new
  project: add a track, punch in a take, trim, split, fade.
- **Hooks own side effects**: `useSong` (one open song, undo history, saving),
  `useTabs`, `useTransport` (playback and recording), `useMicrophone`.
- **Audio maths** (`audio/`) is pure where possible: slider-to-parameter mapping,
  latency estimation, fades, peaks, pitch detection, key finding and pitch shifting. The Web Audio graph is built in `audio/mix/mixer.ts`.

If a component grows an `if` chain or a calculation, move it into a helper and test it.

`audio/` and `state/` are grouped by area (`audio/pitch/`, `state/song/`, …; the full
list is in `CLAUDE.md`). A new file goes in the folder for its area, with its test next to
it; start a new folder only when no area fits.

## Components

One folder per component:

```
components/Timeline/
  Timeline.tsx           the component
  Timeline.css           its styles
  Timeline.test.tsx      its integration tests
  useTimelineView.ts     a hook only this component uses
  ClipView.tsx           a sub-component only Timeline uses
  index.ts               re-exports the public pieces
```

Import components through their folder (`'../Timeline'`), not deep paths.

## User-facing text

- Every label, hint, message, tooltip and aria-label lives in `src/shared/copy/en.json`.
- Look it up with `t()` from `@shared/copy`: `t('transport.saved', { name })`. Keys are
  type-checked, so a typo fails the build.
- No user-facing string literals in components, hooks or the main process.

## Shortcuts and commands

- Every shortcut lives in `src/shared/keymap.ts` with its default keys. The native
  menu, the renderer's key handling, tooltips and the Shortcuts table all read from it, so
  a new shortcut is one entry there plus a `keymap.<id>` copy key.
- People can rebind shortcuts in the app dialog's Shortcuts section. Their changes are overrides stored in
  `userData/keymap.json`; the main process validates them (`parseOverrides`) and
  rebuilds the menu. In the renderer, read keys with `useShortcuts()` so text updates
  when a shortcut changes; never format a default accelerator directly.
- Menu items and in-app keys arrive as one stream: subscribe with `onCommand()`
  (`state/commands/commands.ts`), not `window.api.onMenu`. Keys with ⌘ or ⌥ go through the
  menu; single keys and text keys (arrows, ⌫) are handled in the renderer so they don't
  swallow typing.

## Constants, not magic numbers

- Any number with a meaning (timings, thresholds, sizes, limits, defaults) gets a named
  constant: module-local if one file uses it, `src/shared/constants.ts` if both
  processes do.
- Mapping tables (like the polish slider ranges) are data: keep them in one readable
  table, not scattered literals.
- Comment the _why_ when a value isn't self-explanatory.
- Obvious identities (`0`, `1`, `-1`, `* 2` for min/max pairs) don't need names.

## Comments

Explain why, not what. Product reasoning, non-obvious edge cases, browser quirks and
workarounds (with a link) are worth a comment; restating the code isn't.

## Safety

- The renderer can only touch song folders the main process opened (dialog, created,
  or restored). Validate every path that crosses IPC.
- Audio files are never overwritten or deleted. Takes are written with `wx`.
- The voice profile reads takes from songs that aren't open only through
  `voice:readTake`, which serves a file only if one of that song's vocal clips plays it.
- Tuning plays and exports tuned copies held in memory (`audio/pitch/tuning.ts`); the
  recordings on disk stay as sung.
- Only the main process goes online (lyrics search, `main/ipc/lyrics.ts`), and only
  with words the singer typed. Validate what comes back (`parseSearchResults`).
- `project.json` is written to a temp file and renamed, so a crash can't half-write it.
