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

## Things jsdom can't do

- There's no Web Audio and no layout. Mock at the boundary: stub `window.api` and the
  audio hooks, not internal functions. `test/setup.ts` gives `ResizeObserver` a fixed
  width.
- Audio behaviour (the polish chain, the mixer, worklets) is checked with focused unit
  tests that run the processors directly, plus offline renders in the browser.

## Before calling work done

`npm test`, `npm run typecheck` and `npm run lint` all pass. The pre-commit hook runs
lint and the typecheck too.
