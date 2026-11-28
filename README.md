<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
    <img src="docs/assets/logo-light.svg" alt="Rove" width="320">
  </picture>
</p>

<p align="center">
  <strong>Sing for the love of it.</strong><br>
  A desktop app for recording your voice over the songs you love.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple" alt="Platform: macOS">
  <img src="https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Web%20Audio%20API-FF6F00" alt="Web Audio API">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License: Apache 2.0"></a>
</p>

<p align="center">
  <a href="https://andy-techen.github.io/rove/"><strong>Website</strong></a> ·
  <a href="https://github.com/andy-techen/rove/releases/latest"><strong>Download</strong></a>
</p>

## About

Rove is a desktop app for people who love to sing. It's made for a recording you're
proud of, without having to become an audio engineer.

## Features

- **Sing over any song.** Bring a backing track, or make your own from a few chords.
- **Layer your own harmonies.** Stack your voice into a fuller sound.
- **Polish in plain words.** Controls named for what you hear, with good defaults for
  every part.
- **Lyrics and chords at hand.** Follow along while you sing.
- **Get to know your voice.** See your range, and how it grows, across every song.
- **Never lose a take.** Your recordings are never modified; every edit can be undone.

## Install

Download the latest `.dmg` from
[Releases](https://github.com/andy-techen/rove/releases/latest): `-arm64` for Apple
silicon (M1 and later), `-x64` for Intel.

## Development

```bash
npm install
npm run dev
```

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `npm run dev`       | Run the app with hot reload       |
| `npm test`          | Run the test suite (Vitest)       |
| `npm run typecheck` | Type-check main and renderer      |
| `npm run lint`      | Lint with ESLint                  |
| `npm run build:mac` | Package `Rove.app` and the `.dmg` |

In development, macOS attributes microphone access to the app that launched
`npm run dev` (Terminal, iTerm, VS Code), so allow it there. If the level meter stays
flat, check **System Settings → Privacy & Security → Microphone**.

**Built with** Electron, React, TypeScript and the Web Audio API. The website in
[`site/`](site) is built with [Astro](https://astro.build).

## Contributing

Start with [`CLAUDE.md`](CLAUDE.md), which links the guides every change follows in
[`docs/`](docs).

## Acknowledgements

- **Vocal removal** uses [SCNet](https://github.com/starrytong/SCNet) (Tong et al.,
  ICASSP 2024; code and pretrained weights MIT, © 2024 starrytong), as exported to ONNX
  by [audiojs](https://huggingface.co/audiojs/scnet) and run with
  [@audio/neural-separate](https://github.com/audiojs/neural) and
  [ONNX Runtime Web](https://onnxruntime.ai). Its licence ships with the app in
  `resources/models/scnet/LICENSE`.
- **The piano** plays samples from the
  [Salamander Grand Piano v3](https://github.com/sfzinstruments/SalamanderGrandPiano) by
  Alexander Holm, licensed under
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); trimmed and re-encoded, with
  its licence in `src/renderer/src/audio/music/pianoSamples/`.
