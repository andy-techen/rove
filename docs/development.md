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
- **Project operations** (`state/song/project/`, one file per area: tracks, clips, music,
  chords, tempo, parse; types and constants beside them) are pure functions that return
  a new project: add a track, punch in a take, trim, split, fade.
- **Hooks own side effects**: `useSong` (one open song, undo history, saving),
  `useTabs`, `useTransport` (playback and recording), `useMicrophone`.
- **Audio maths** (`audio/`) is pure where possible: slider-to-parameter mapping,
  latency estimation, fades, peaks, pitch detection, key finding and pitch shifting. The Web Audio graph is built in `audio/mix/mixer.ts`.

If a component grows an `if` chain or a calculation, move it into a helper and test it.

`audio/` and `state/` are grouped by area (`audio/pitch/`, `state/song/`, …; the full
list is in `CLAUDE.md`). A new file goes in the folder for its area, with its test next to
it; start a new folder only when no area fits.

## Reuse before you write

Most duplication here came from writing a small helper again instead of finding the
existing one. Before adding a helper, search for it (`grep -rn "function hann"`), and
if it already exists anywhere, import it, moving it to a shared home if needed.

- **Signal maths goes in `audio/dsp/`**: filters (`lowpass`), windows, FFT, peak
  fitting, seeded noise, stats (`mean`, `median`, `percentile`), dB conversions
  (`units.ts`: `dbToGain`, `gainToDb`). Don't write `10 ** (x / 20)` or a clamp inline
  in a second file.
- **One value, one definition.** When two modules must agree (the de-esser's split
  and `DE_ESS_BAND`), one imports the other's constant. A comment saying the two
  "match" is a sign that one should import the other. Unit constants are imported
  from `src/shared/units.ts`, not redeclared.
- **A list and its type come from one place:** `const GROOVES = ['rock', …] as const`
  then `type GrooveId = (typeof GROOVES)[number]`, never a union beside an array that
  must be kept in step by hand.
- **Repeated hook shapes become a hook.** If two hooks do the same effect dance
  (keep-latest ref, debounced cancellable render, localStorage read/write with
  try/catch), extract it into `state/` instead of copying a third time.
- **Two copies is the limit.** The second copy is fine while you learn the shape; the
  third goes into a shared helper with a test, and the earlier two switch to it.

## Size and shape

- A file past ~500 lines, or one that needs `// --- Section ---` banners, wants
  splitting by area (a folder with an `index.ts` keeps imports unchanged). A banner is
  where the split goes.
- A folder past ~20 files (code and tests together) wants splitting into sub-areas the
  same way: `main/ipc/` holds `songs/`, `preferences/`, `license/`, `online/` and
  `files/`. Tests stay next to their code.
- Export only what another file imports. Types that appear in an exported signature
  are the exception.
- Don't keep code alive for its tests. When a feature goes, remove everything it
  owned: its component, its project operations, its copy keys, its CSS classes, and its
  rows in the docs. A function only its test calls is dead.

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

- Every shortcut lives in `src/shared/preferences/keymap.ts` with its default keys. The native
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

## Premium features

- Premium is a one-time purchase. Which features it holds is one list,
  `PREMIUM_FEATURES` in `src/shared/license/premiumFeatures.ts`; everything else is free and never
  gated. Taking a feature off the list makes each gate on it fail the typecheck.
- The main process owns the license (`main/ipc/license/license.ts`, saved in
  `userData/license.json`): premium with a key, free without. It sends the plan to the
  window.
  The renderer reads it with `useFeature(id)` (`state/license/useFeature.ts`) to show a
  feature or show it locked.
- Gate in both places: where the main process does a premium feature's work, it calls
  `requirePlanFor(id)` first (handing over the vocal removal model does), so hiding a
  button is never the only lock.
- Keys are checked by a `LicenseService` (`main/ipc/license/licenseService.ts`). For now it's a
  fake: nothing goes online, any key of 8 or more characters activates, and anything
  shorter is turned down so the error can be tried. Lemon Squeezy replaces it there,
  and nothing else changes. To test, activate any key in Settings ▸ Rove Premium, and
  "Deactivate this Mac" to go back to free.
- The window never gets the key, only its last few characters (`keyHint`), and only
  fixed addresses open in the browser (checkout, the orders page).

## Constants, not magic numbers

- Any number with a meaning (timings, thresholds, sizes, limits, defaults) gets a named
  constant, and it lives in a constants file, not in a list at the top of the file that
  uses it:
  - **Units** (`MS_PER_SEC`, `SEC_PER_MIN`, `PERCENT`, `SEMITONES_PER_OCTAVE`,
    `CENTS_PER_SEMITONE`, `PITCH_CLASSES`) are in `src/shared/units.ts`. Import them;
    never declare one again.
  - **An area's values** (its thresholds, limits, defaults and tuning) are in that
    area's `constants.ts`: `audio/pitch/constants.ts`, `state/chords/chart/constants.ts`,
    `components/Timeline/constants.ts`. Group them under short comments by what they
    tune.
  - **Values both processes need** are in `src/shared/constants.ts`.
  - A value used by two areas moves to the lower of them (the one the other already
    imports from) or to `src/shared/`, never copied.
- A literal may stay inline only when naming it would say nothing more than the code
  around it: a loop bound over an array's length, an index, an identity.
- Mapping tables (like the polish slider ranges) are data: keep them in one readable
  table, not scattered literals.
- Comment the _why_ when a value isn't self-explanatory.
- Obvious identities (`0`, `1`, `-1`, `* 2` for min/max pairs) don't need names.

## Comments

Explain why, not what. Product reasoning, non-obvious edge cases, browser quirks and
workarounds (with a link) are worth a comment; restating the code isn't.

- Say it once. Put the reason at the constant or at its use, not both.
- A doc comment that repeats the function name ("A new buffer holding these
  channels" on `bufferOf`) goes; improve the name instead.
- Comments that state numbers or name paths go stale: when you change a range, a
  file's location or what a function covers, fix the comments that describe it.
  Better still, word them so they don't repeat the number.
- No notes about the process ("tune these later", "the main session will…"); say what
  the value is for.

## Safety

- The renderer can only touch song folders the main process opened (dialog, created,
  or restored). Validate every path that crosses IPC.
- Audio files are never overwritten or deleted. Takes are written with `wx`.
- The voice profile reads takes from songs that aren't open only through
  `voice:readTake`, which serves a file only if one of that song's vocal clips plays it.
- Tuning plays and exports tuned copies held in memory (`audio/pitch/tuning.ts`); the
  recordings on disk stay as sung.
- Every file under `userData` or a song folder is written with `writeAtomically`
  (`main/ipc/files/writeAtomically.ts`), never a bare `fs.writeFile` or a hand-made temp
  name.
- IPC channel names live in a `*_CHANNELS` const in `src/shared/`, used by both main
  and preload; payload types and input cleaning (`cleanText`) live there too, never
  written again on one side.
- Only the main process goes online (lyrics search, `main/ipc/online/lyrics.ts`), and only
  with words the singer typed. Validate what comes back (`parseSearchResults`).
- `project.json` is written to a temp file and renamed, so a crash can't half-write it.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org):
`type(scope): what changed`, in lowercase, as a short plain sentence. A `commit-msg`
hook runs commitlint (`commitlint.config.mjs`) and rejects anything else.

```
feat(explore): load the next page of songs as you scroll to the end
fix(songbook): the gap under the search holds while scrolling
refactor(main): split menu.ts into the menu bar, Dock and right-click menus
docs: trim the README's About to one line
```

- **Types:** `feat` (something new for the singer), `fix`, `refactor`, `perf`, `test`,
  `docs`, `style` (formatting only), `build`, `ci`, `chore`, `revert`.
- **Scope** is optional; leave it out when a change spans several areas. When given, it
  must be one of these (the list in `commitlint.config.mjs` is what the hook checks;
  add a scope in both places):

  | Scope      | Area                                                    |
  | ---------- | ------------------------------------------------------- |
  | `record`   | Recording, the mic check and transport                  |
  | `timeline` | Lanes, clips and editing them (trim, split, fade, snap) |
  | `polish`   | How the voice sounds: polish, tuning, the voice profile |
  | `music`    | Backing tracks, beats, chords, key and tempo            |
  | `lyrics`   | The lyrics panel, lyrics search and synced lyrics       |
  | `export`   | Audio, video and project exports                        |
  | `songbook` | The Songbook, Explore and the song catalog              |
  | `app`      | Settings, Premium, shortcuts and menus                  |
  | `main`     | The main process: IPC, files, windows, saving           |
  | `ui`       | Shared building blocks (`components/ui/`) and tokens    |
  | `site`     | The website                                             |

- A breaking change to a saved format (`project.json`, `.rove`) gets a `!`:
  `feat(main)!: …`, with a `BREAKING CHANGE:` line in the body saying what migrates.
