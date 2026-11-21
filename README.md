# Rove

A beginner-friendly desktop app for recording vocals over a backing track, layering harmonies, and polishing the mix with plain-language controls. Built with Electron, targeting macOS first.

> The earlier mobile + API version of Rove lives on the `archive/pre-vocal-editor` branch.

## Product principles

1. **Controls describe what you hear, not how audio engineering works.** "Space," not "reverb decay."
2. **Smart defaults by track role.** Lead, Harmony and Backing Track each start from sensible settings.
3. **Nothing can sound broken.** Every slider maps to safe ranges under the hood.
4. **Configurable, not just presets.** Plain-language sliders up front, an "Advanced" toggle for real parameters.
5. **Non-destructive.** Original recordings are never modified. Edits are instructions stored in the project file.

## Roadmap

| Phase | Goal |
|---|---|
| 1. Foundation | Record one track from a USB mic, see the waveform, play it back, save it |
| 2. Multitrack | Backing track import, multiple vocal tracks, shared timeline, monitoring, latency compensation |
| 3. Editing | Trim, split, move clips, fades, undo/redo |
| 4. Polish chain | Clean up, Clarity, Warmth, Smoothness, Space, Soften S sounds |
| 5. Export | Mixdown to WAV and MP3 with loudness leveling |

## Stack

Electron + electron-vite, React + TypeScript, Web Audio API with an AudioWorklet for raw PCM capture, wavesurfer.js for waveforms, electron-builder for packaging.

## Development

```bash
npm install
npm run dev
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run build:mac`.

In dev mode macOS attributes microphone permission to your terminal or editor, not the app. If recording is silent, check System Settings > Privacy & Security > Microphone.
