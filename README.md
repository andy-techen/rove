# Rove

![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)
![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-FF6F00)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

A beginner-friendly desktop app for recording vocals over a backing track, layering harmonies, and polishing the mix with plain-language controls.

## Who it's for

People who love to sing and want to make something they're proud of, without becoming
audio engineers. [docs/brand.md](docs/brand.md) has the product principles and how Rove
should look, sound and feel.

## Roadmap

| Next                   | Goal                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Songbook               | Browse past takes, and keep a wishlist of songs to try next                                                      |
| Range check            | Work out your range from a take, suggest a better key, and quietly build a voice profile over time               |
| Explore songs          | A curated "what should I sing?" catalog built into the Songbook: search it, try one, add it to your wishlist     |
| Songs that fit you     | Premium: match catalog songs to the range check and surface the ones your voice can reach                        |
| Catalog in Mandarin    | First-class Mandarin coverage: MusicBrainz + Deezer, ISRC joins, simplified/traditional/pinyin variants          |
| First-run setup        | A friendly walk-through of mic, headphones and latency for people who've never set these up                      |
| App in your language   | Translate the interface into English, Traditional Chinese and Simplified Chinese; lyrics stay as written         |
| Harmony auto-sync      | Line up a harmony take with the lead using one plain "Tightness" slider, non-destructive and per section         |
| Share as image         | Export the mix as a phone-ready image with a synced lyrics overlay, ready to post                                |
| Share as audio         | A polished audio clip sized for social, beyond the image share                                                   |
| Clip for social        | Drag a 30- or 60-second window over the song, hear a preview, export just that part — pairs with the image share |
| Better chords          | A more accurate on-device detector (BTC), run on the music without vocals; edit or type chords when it's wrong   |
| Chord backing          | Play the song's chords as the backing track: strummed guitar, piano or a simple beat                             |
| Auto polish            | Analyse a take and set the polish knobs                                                                          |
| Growth profile         | Progress over time: range growth, and old takes next to new ones                                                 |
| Come back tomorrow     | Gentle nudges that bring singers back between sessions                                                           |
| More settings          | More to tune in Settings, for singers who want to go a little deeper                                             |
| Signing and notarizing | Sign with a Developer ID and notarize, so macOS opens the app without asking                                     |

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

GitHub Actions (`.github/workflows/release.yml`) checks the code, builds a `.dmg` for each
kind of Mac and publishes them as a GitHub release: `-arm64` for Apple silicon (M1 and
later), `-x64` for Intel. Start a release either way:

- **On GitHub:** Actions → Release → Run workflow. Pick the branch, type the new version
  (`1.1.0`) and run it. It tags that commit `v1.1.0` once the build works.
- **From a terminal:** push a version tag.

```bash
git tag v1.1.0
git push origin v1.1.0
```

The tag sets the app's version. Until the app is signed with a Developer ID and
notarized, macOS blocks the first launch: open the app once, then go to System Settings >
Privacy & Security and choose **Open Anyway**.
