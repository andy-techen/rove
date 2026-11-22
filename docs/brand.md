# Brand

Who Rove is for, how it should feel, and how to tell whether a feature belongs. This is
the why; `docs/design.md` turns it into interface rules.

## Who it's for

People who love to sing: in the car, at karaoke, in a choir, alone in their room. They
aren't trying to go pro and don't know what a compressor is. They want a recording
they're proud of, and to share their voice with people who'll cheer them on. Many of
them sing in the time after work: their own hours, spent on music they love.

## What Rove is, and isn't

- **Today:** record over a backing track, layer harmonies, polish the sound, export.
- **Next:** share it. Video and phone-ready exports first, then a community of amateur
  singers.
- **Not a studio.** No feature should need audio engineering to understand.
- **Not a platform for producers.** Rove is about a person's voice, not tracks,
  beats or the music industry.
- **Not a contest.** Singing for fun should never feel graded.

## Personality

A warm, encouraging friend at an open mic.

- **Warm, not slick.** Soft shapes, warm colours, plain words.
- **Encouraging, never judging.** Say what's working, then what to try.
- **Simple, not simplistic.** Good results come from good defaults; depth waits
  behind Advanced for whoever wants it.
- **Playful in small doses.** A little delight when something goes well, never noise.

## Principles

1. **Controls describe what you hear, not how audio engineering works.** "Space," not
   "reverb decay."
2. **Smart defaults by track role.** Lead, Harmony and Backing Track each start from
   sensible settings.
3. **Nothing can sound broken.** Every slider maps to safe ranges under the hood.
4. **Configurable, not just presets.** Plain-language sliders up front, an "Advanced"
   toggle for real parameters.
5. **Non-destructive.** Original recordings are never modified. Edits are instructions
   stored in the project file.
6. **Your voice is the star.** The singer's voice gets the colour and the attention;
   everything else stays quiet around it.

## Voice and tone

- Speak to the singer ("you"), about what they hear and do.
- Short and plain. One idea per sentence; no jargon.
- Lead with what's good, then the next step: "Sounds good. Keep it about here."
- A warning says what to do, kindly: "Getting loud. Ease back from the mic a little."
- Save exclamation marks for real moments, like clipping or a finished song.

## Look and feel: Golden hour

Golden hour is when our singers make music: the end of the day, after work, when the
time is theirs and they spend it on something they love. The look carries that light:
warm, relaxed, flattering, a little magical.

- **Marigold means you.** Your voice on the timeline, your main action (Play, the
  primary button), the knobs you turn. Used sparingly, so it stays meaningful.
- **Warm grounds.** Cream by day, warm charcoal by night. Never cold blue-grey, never
  pure black or white.
- **Colours keep their jobs.** Red means recording or something gone wrong. Green
  means healthy, or a good place to set a control. Neither is ever decoration.
- **Light and dark are equals.** Dark is evening, not a studio.
- **Soft on gold.** Text and icons on marigold are warm brown, and dots that sit on it
  are cream, so nothing reads as harsh black on yellow.

Values live in `src/renderer/src/styles/tokens.css`; how to apply them is in
`docs/design.md`.

## Logo

- Not literal: no microphones, mixing desks or editor waveforms. The voice as
  something warm and alive.
- **Icon (on trial):** Orb sunrise, a voice-orb sun rising over the sea. It always
  appears on its own sky tile, never cut out onto a transparent or dark ground.
- **Wordmark (on trial):** lowercase "rove" in heavy, round strokes
  (`design/logo/wordmarks/rounded.svg`).
- Other concepts are kept in `design/logo/` for reference.

## Sharing and community (later)

To be defined when sharing is designed.

## Designing a feature

Before building, check it against these:

1. Would someone who has never used audio software get it without reading help?
2. Does it help the singer sound better or feel more confident, or does it just add a
   control?
3. Can the default be right, so most people never touch it?
4. Does it keep the singer's voice the star?
