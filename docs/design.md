# Design guidelines and patterns

How the interface puts the brand (`docs/brand.md`) on screen. The screen should feel
calm and obvious: few words, clear icons, and controls that describe what the singer
hears.

## Visual language

- **Icons over text.** Controls are icons wherever one reads clearly: transport
  (play, pause, record, stop), mute and volume, position, close, new, fit, help.
  Text buttons are for actions an icon can't name well ("Add backing track").
- **Hover explains.** Every icon-only control shows a tooltip saying what it does and
  has an accessible name. Use `IconButton`, which requires a `label` and uses it for both.
  Disabled controls dim but keep the arrow cursor, so nothing covers their tooltip.
- **Instructions hide behind help.** How-to text goes behind a `HelpTip` (a small "?"
  that reveals the instruction on hover or keyboard focus) or in the Help panel (app
  menu → Help). Don't add always-visible paragraphs.
- **Visible text is for names, values and warnings** the singer must act on (a song
  name, a time, "Too loud!").
- **Plain language.** Name controls by what the singer hears ("Space", "Smoothness");
  real parameters live behind Advanced. Tone of voice is in `docs/brand.md`.

## Styling

- All colours, spacing, radii, font sizes, sizes and durations come from the tokens in
  `src/renderer/src/styles/tokens.css`. Never hard-code one in a component stylesheet.
- Every colour token has a light and a dark value; check both themes.
- Colours have jobs. Pick the token by what it means, not how it looks:

  | Token                 | Means                                                     |
  | --------------------- | --------------------------------------------------------- |
  | `--color-accent`      | The singer's main action and focus: Play, primary, knobs  |
  | `--color-on-accent`   | Text and icons on the accent (warm brown, never white)    |
  | `--color-thumb`       | Slider thumbs and switch dots (cream)                     |
  | `--color-accent-text` | Accent-coloured text (deeper amber, readable on cream)    |
  | `--color-wave-vocal`  | The singer's voice on the timeline                        |
  | `--color-danger`      | Recording, clipping, errors and the playhead              |
  | `--color-good`        | A healthy level, and the notch where most singers like it |
  | `--color-warning`     | Getting too loud; always with words or an icon            |

- Each component has its own stylesheet next to it (`Timeline/Timeline.css`), scoped by
  a class named after the component.
- No `style={{…}}` for appearance. The exception is geometry computed from data at run
  time (a clip's position and width on the timeline, a canvas size). Prefer passing it
  as a CSS custom property (`style={{ '--marker': 0.4 }}`) and doing the maths in CSS.
- Respect `prefers-reduced-motion` for anything that animates.

## Typography

One scale, one job per size. Hierarchy comes from size first, then weight
(`semibold` for names and headings) and colour (`--color-text-muted` for secondary text).

| Token                 | Size         | Use it for                                        |
| --------------------- | ------------ | ------------------------------------------------- |
| `--font-size-title`   | 28           | Screen titles (the mic check)                     |
| `--font-size-display` | 24           | The timer                                         |
| `--font-size-heading` | 14, semibold | Panel and dialog headings                         |
| `--font-size-lead`    | 15           | Onboarding text                                   |
| `--font-size-ui`      | 13           | The default: buttons, tabs, track names, messages |
| `--font-size-caption` | 12           | Secondary details, values, tooltips, save status  |
| `--font-size-micro`   | 11           | Ruler ticks                                       |

Don't introduce a new size; if nothing fits, the hierarchy probably needs rethinking.

## Shared building blocks (`components/ui/`)

Reach for these before writing new markup:

| Component     | Use it for                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `Button`      | Text buttons. `primary`, `secondary`, `quiet` (soft fill), `ghost` (in-place); sizes `md`, `sm`. |
| `IconButton`  | Any icon-only control. `label` is required (accessible name and tooltip).                        |
| `Icon`        | Inline icons by name; add new glyphs to `Icon/icons.ts`.                                         |
| `Slider`      | Range inputs (lane volume and position, Advanced). `centre` for two-way ones.                    |
| `Knob`        | A turnable control. `centre` for ones that go both ways (speed, key).                            |
| `KnobControl` | A knob with its name, help and value, as panels show it; lay out in a `KnobRow`.                 |
| `Panel`       | A titled panel under the timeline (Polish, Music), with header actions.                          |
| `Splitter`    | A draggable edge between areas (side panel width, the lyrics/chords split).                      |
| `NumberField` | A number to type over (Enter applies, Esc reverts); pair it with a slider.                       |
| `Switch`      | On/off toggles with a label.                                                                     |
| `Select`      | A short list to pick one from (the song key). Native, so the keyboard just works.                |
| `HelpTip`     | A "?" that reveals instructions on hover or focus.                                               |

If a pattern repeats in two places, promote it to `ui/`.

## Accessibility

- Everything works with the keyboard; focus is always visible (`:focus-visible`).
- Icon-only controls have accessible names; toggles use `aria-pressed`; menus use
  `role="menu"` / `menuitem`; meters use `role="meter"` with a spoken value.
- Don't rely on colour alone: mute shows a different icon as well as a colour.
