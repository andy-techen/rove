# Writing tests

Tests run with vitest (`npm test`) in jsdom, using React Testing Library for
components.

## Test first

Write the test that describes the behaviour before writing the code. A failing test
is the spec; the code is done when it passes.

## Mostly integration

- Prefer a few tests that use a feature the way a singer does over many tiny tests.
  Render the component, click and type with `@testing-library/user-event`, and assert
  on what's on screen and what was saved (`window.api` calls).
- Unit tests are for pure helpers with real edge cases: audio maths, clip editing,
  file naming, take alignment, slider mappings.
- Don't test what the framework guarantees or what a type already proves.

## Test each behaviour once, at one level

- A pure helper's edge cases live in its unit test. A component test of the same thing
  checks only the wiring: one click, one assertion that the helper's result arrived.
- A shared piece (`useBarGrid`, `Segmented`, `Dialog`) gets its own test. The
  components that use it don't test it again.
- Before adding a test, search for one that already covers the path
  (`grep -rn "repeatLine" src --include=*.test.*`).

## Tests that don't earn their place

- A default object, a constant, a spread or a setter ("withX sets x"), restated.
- That a pure function returns the same answer twice, or that a seed changes the output.
- A file's formatting bytes, when nothing reads them.
- A legacy format that never shipped in a tagged release (`git tag`). Remove the
  migration with its test; keep migrations for formats that some release wrote.
- Several near-identical tests: make them one `it.each` table.

## Keep them short

- One behaviour per test, named as a sentence about that behaviour:
  `it('mutes the track when the speaker is clicked')`.
- Build inputs with small helpers rather than long literals; keep fixtures next to the
  tests that use them.
- Test helpers don't need explicit return types (lint relaxes that rule for tests).
- Aim for under ~15 lines per test. If a test needs much more setup, the code under test
  probably needs a seam.

## Query like a user

- Find elements by role and accessible name (`getByRole('button', { name: 'Mute Vocal 1' })`),
  then by label or text. Never by CSS class or test id unless nothing else works.
- Use copy keys for expected text (`t('transport.saved', …)`) so copy edits don't break
  tests.
- Never assert on internal state, private functions or class names users can't perceive.
  Assert through what the user can do instead: undo, not `history.past`.
- Make sure a test can fail. A "not in the document" check has to query real text
  (`t(…)`); a copy key or a regex that never matched passes forever.

## Keep them fast

- Don't wait on real time. Show a tooltip by focusing its control (it shows at once);
  use fake timers for anything else on a delay. Only `Tooltip.test` hovers for real.
- Build expensive fixtures once (`beforeAll`, or at module level) and reuse them.
- Synthesize audio at the lowest sample rate and shortest length that still exercises
  the code: 24 kHz and a few phrases, 1 s of tone for loudness, 12 kHz click tracks
  for beat detection.
- Signal builders (`silence`, `tone`, `voice`, `join`) live in
  `src/renderer/src/test/signals.ts`; fake-API helpers (`fireMenu`) in `test/fakeApi.ts`.
  Setup repeated within a file becomes a helper at its top (`renderExplore()`, `clip()`).

## Things jsdom can't do

- There's no Web Audio and no layout. Mock at the boundary: stub `window.api` and the
  audio hooks, not internal functions. `test/setup.ts` gives `ResizeObserver` a fixed
  width.
- Audio behaviour (the polish chain, the mixer, worklets) is checked with focused unit
  tests that run the processors directly, plus offline renders in the browser.

## Before calling work done

`npm test`, `npm run typecheck` and `npm run lint` all pass. The pre-commit hook runs
lint and the typecheck too.

For each test you added or changed, check:

1. **Is it already covered?** You searched for an existing test of the same path, at
   this level or another.
2. **Could it fail?** Break the code briefly; the test goes red.
3. **Is it about behaviour?** Not a default, a constant, a type, or internal state.
4. **Is it fast?** `npx vitest run <file>` shows it under the 300 ms slow-test mark
   (`slowTestThreshold` in `vitest.config.ts`), with no real-time waits.
5. **Is it a copy?** A third similar test becomes a table; repeated setup becomes a
   helper.

When removing a feature, remove its tests with it.
