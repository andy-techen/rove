# Rove

![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)
![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-FF6F00)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

A beginner-friendly desktop app for recording vocals over a backing track, layering harmonies, and polishing the mix with plain-language controls.

## Product principles

1. **Controls describe what you hear, not how audio engineering works.** "Space," not "reverb decay."
2. **Smart defaults by track role.** Lead, Harmony and Backing Track each start from sensible settings.
3. **Nothing can sound broken.** Every slider maps to safe ranges under the hood.
4. **Configurable, not just presets.** Plain-language sliders up front, an "Advanced" toggle for real parameters.
5. **Non-destructive.** Original recordings are never modified. Edits are instructions stored in the project file.

## Roadmap

| Phase           | Goal                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation   | Record over a backing track from a USB mic, see the waveform, play it back, save it                                                                                   |
| 2. Multitrack   | Multiple vocal tracks, shared timeline, monitoring, latency compensation                                                                                              |
| 3. Editing      | Trim, split, move clips, fades, undo/redo                                                                                                                             |
| 4. Polish chain | Noise reduction, Clarity, Warmth, Evenness, Space, Smoothness                                                                                                         |
| 5. Export       | Mixdown to WAV and MP3 with loudness leveling                                                                                                                         |
| 6. Pitch        | Pitch correction: detect each sung note and nudge it toward the song's key, with one Tuning slider from natural to snappy                                             |
| 7. Lyrics       | Lyrics found online that follow along as you sing; click a line to jump there                                                                                         |
| 8. Video        | Record camera video at the same time as the vocal, in sync with the timeline, and export it with the mixed audio                                                      |
| Later           | Auto polish (analyse a take and set the polish sliders), remove vocals (on-device stem separation turns any song into a backing track), code signing and notarization |

## Stack

Electron + electron-vite, React + TypeScript, Web Audio API with an AudioWorklet for raw PCM capture, wavesurfer.js for waveforms, electron-builder for packaging.

## Development

```bash
npm install
npm run dev
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:mac`.

In dev mode macOS attributes microphone permission to the app that launched `npm run dev` (Terminal, iTerm, VS Code), not to Rove. Run it from one of those and allow access once. If the meter stays flat, check System Settings > Privacy & Security > Microphone.

## Releases

Push a version tag and GitHub Actions (`.github/workflows/release.yml`) checks the code,
builds a universal `.dmg` (Apple silicon and Intel) and publishes it as a GitHub release:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The tag sets the app's version. Until the app is signed with a Developer ID and
notarized, macOS blocks the first launch: open the app once, then go to System Settings >
Privacy & Security and choose **Open Anyway**.
