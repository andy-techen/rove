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

| Next                   | Goal                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Video                  | Record camera video with the vocal, in sync with the timeline, and export it with the mix                      |
| Share as video         | Export the mix as a video for phones: the audio over a photo you import or a background, ready to post         |
| Better chords          | A more accurate on-device detector (BTC), run on the music without vocals; edit or type chords when it's wrong |
| Chord backing          | Play the song's chords as the backing track: strummed guitar, piano or a simple beat                           |
| Auto polish            | Analyse a take and set the polish knobs                                                                        |
| Signing and notarizing | Sign with a Developer ID and notarize, so macOS opens the app without asking                                   |

## Credits

Vocal removal uses [SCNet](https://github.com/starrytong/SCNet) (Tong et al., ICASSP 2024;
code and pretrained weights MIT, © 2024 starrytong) as exported to ONNX by
[audiojs](https://huggingface.co/audiojs/scnet), run with
[@audio/neural-separate](https://github.com/audiojs/neural) and
[ONNX Runtime Web](https://onnxruntime.ai). Its licence ships with the app in
`resources/models/scnet/LICENSE`.

## Stack

Electron + electron-vite, React + TypeScript, Web Audio API with an AudioWorklet for raw PCM capture, electron-builder for packaging.

## Development

```bash
npm install
npm run dev
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:mac`.

In dev mode macOS attributes microphone permission to the app that launched `npm run dev` (Terminal, iTerm, VS Code), not to Rove. Run it from one of those and allow access once. If the meter stays flat, check System Settings > Privacy & Security > Microphone.

## Releases

Push a version tag and GitHub Actions (`.github/workflows/release.yml`) checks the code,
builds a `.dmg` for each kind of Mac and publishes them as a GitHub release: `-arm64` for
Apple silicon (M1 and later), `-x64` for Intel.

```bash
git tag v1.1.0
git push origin v1.1.0
```

The tag sets the app's version. Until the app is signed with a Developer ID and
notarized, macOS blocks the first launch: open the app once, then go to System Settings >
Privacy & Security and choose **Open Anyway**.
