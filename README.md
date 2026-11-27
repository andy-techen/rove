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

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/screenshot-dark.png">
    <img src="docs/assets/screenshot-light.png" alt="Rove: a song with a backing track, lead and harmony, lyrics following along" width="880">
  </picture>
</p>

## About

Rove is a desktop app for people who love to sing: in the car, at karaoke, in a choir,
alone in their room. It's made for a recording you're proud of, without having to
become an audio engineer.

- **Sing over any song.** Bring a backing track and record your voice over it.
- **Layer harmonies.** Stack your own voice into a fuller sound.
- **Sound your best.** Plain-language controls with good defaults, and nothing that can
  clip or sound broken.
- **Never lose a take.** Your recordings are never modified; edits live in the project.

## Install

Download the latest `.dmg` from
[Releases](https://github.com/andy-techen/rove/releases/latest): `-arm64` for Apple
silicon (M1 and later), `-x64` for Intel.

> [!NOTE]
> Rove isn't notarized yet, so macOS blocks the first launch. Open the app once, then go
> to **System Settings → Privacy & Security** and choose **Open Anyway**.

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

## License

[Apache 2.0](LICENSE)
