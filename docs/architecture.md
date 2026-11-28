# Architecture

Rove is an Electron app: one **main process** (Node.js, with access to the file system
and macOS) and one **renderer** (a Chromium page running React and Web Audio). They
can't call each other directly; the **preload** script is the only bridge, exposing a
small, typed `window.api` to the page.

## Processes

```mermaid
flowchart LR
  subgraph Main["Main process (Node.js) · src/main"]
    index["index.ts<br/>window, mic permission"]
    menu["menu/<br/>menu bar · Dock · right-click"]
    ipc["ipc/<br/>project · export · lyrics<br/>keymap · appearance · voice<br/>license · inputVolume"]
  end

  subgraph Preload["Preload · src/preload"]
    api["window.api<br/>(contextBridge)"]
  end

  subgraph Renderer["Renderer (Chromium page) · src/renderer"]
    react["React UI<br/>components/"]
    state["state/<br/>hooks, project ops, selectors"]
    audio["audio/<br/>Web Audio graph, DSP, worklets"]
  end

  shared["src/shared<br/>copy · keymap · constants"]

  react --> state --> audio
  state -- "window.api calls" --> api
  api -- "ipcRenderer.invoke" --> ipc
  menu -- "menu commands" --> api
  ipc --> disk[("Song folders<br/>~/Music/Rove/…")]
  ipc --> userData[("userData<br/>state · keymap · appearance<br/>voice.json")]
  ipc -- "net.fetch" --> lrclib(("LRCLIB<br/>lyrics search"))
  shared -.-> Main
  shared -.-> Renderer
```

- **Main** owns everything outside the page: opening and writing song folders, file
  dialogs, the menu bar, the theme, and the only network call (lyrics search). Every
  path that arrives over IPC is checked against the folders it opened for the renderer.
- **Preload** forwards a fixed list of calls and events; the page never gets Node.js.
  `contextIsolation` is on, so page scripts can't reach Electron internals.
- **Renderer** is the app the singer sees. All audio work happens here, in Web Audio.
- **Shared** code (copy strings, the keymap, constants) is used by both sides.

## Inside the renderer

```mermaid
flowchart TB
  App["App.tsx<br/>onboarding, app dialog, new-song dialog"] --> tabs["useTabs<br/>open songs, tab order"]
  tabs --> screen["RecordScreen<br/>(one per tab, kept mounted)"]
  tabs --> welcome["Welcome<br/>(no song open)"]

  screen --> song["useSong<br/>project.json, undo, saving"]
  screen --> transport["useTransport<br/>play, record, metronome"]
  screen --> processed["useProcessedAudio<br/>tuned and re-pitched copies"]
  screen --> mic["useMicrophone<br/>device, live input"]

  song --> ops["song/project/<br/>pure edits: add, trim, split…"]
  screen --> selectors["song/selectors.ts<br/>what each lane shows"]

  transport --> mixer["mix/mixer.ts<br/>per-track gain, pan, polish chain"]
  transport --> recorder["recorder worklet<br/>raw PCM capture"]
  processed --> dsp["tuning · stretch · key · chords<br/>(offline, cached)"]

  screen --> ui["TopBar · TransportBar · Timeline<br/>Polish · Music · Lyrics · Chords"]
```

- **Components** render and wire events; they don't decide what's allowed.
- **Hooks** own side effects: `useSong` loads and saves the project, `useTransport`
  starts and stops audio, `useMicrophone` holds the input stream.
- **Project operations** are pure functions returning a new project, which is what
  makes undo a simple history of snapshots.
- **Audio** builds the playback graph per session; heavy work (pitch correction, speed
  and key changes) renders offline into cached buffers so playback stays smooth.

## Recording a take

```mermaid
sequenceDiagram
  actor Singer
  participant UI as Renderer UI
  participant T as useTransport
  participant W as Recorder worklet
  participant API as window.api
  participant M as Main (ipc/project)
  participant D as Song folder

  Singer->>UI: Record on a track
  UI->>T: record(trackId)
  T->>W: start at a scheduled time, with the music
  W-->>T: PCM chunks (live waveform)
  Singer->>UI: Stop
  T->>W: stop → samples
  T->>API: saveTake(dir, wav)
  API->>M: invoke
  M->>D: write audio/take-NNN.wav (never overwrites)
  T->>UI: add clip, shifted by the output delay
  UI->>API: writeManifest(project.json)
  M->>D: write temp file, then rename
```

## Lyrics: searched online, by the main process

```mermaid
sequenceDiagram
  actor Singer
  participant P as LyricsPanel
  participant API as window.api
  participant M as Main (ipc/lyrics)
  participant L as LRCLIB

  Singer->>P: search "song and artist"
  P->>API: searchLyrics(query)
  API->>M: invoke
  M->>L: GET lrclib.net/api/search (net.fetch)
  L-->>M: results JSON
  M-->>P: parseSearchResults: validated, at most 12
  Singer->>P: pick a result
  P->>P: parseLyricsText: timed lines (LRC) into project.lyrics
  Note over P: while playing, activeLineIndex(position + offset)<br/>highlights the line, and clicking a line seeks there
```

Only the main process goes online, and only with words the singer typed. Results are
checked before they reach the page, and the chosen lyrics are saved in `project.json`,
so they work offline afterwards.

## Song catalog: a database that ships with the app

Explore in the Songbook searches a curated catalog,
`resources/catalog/catalog.sqlite`. The main process opens it read-only with Node's
built-in `node:sqlite` (`ipc/online/catalog.ts`, queries in `main/catalog/query.ts`), so
searching never goes online. Songs still waiting for review are hidden.

The database file is the source of truth: there's no seed file to build it from.
Developers curate it with the scripts in `scripts/catalog/`:

| Command                                           | What it does                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run catalog:add -- "<title>" "<artist>" …`   | Looks the song up on MusicBrainz and adds it; `--file` adds a list         |
| `npm run catalog:import -- --artists <list>`      | Adds each listed artist's most played songs (Deezer), pinned by ISRC       |
| `npm run catalog:edit -- <id> --tags … --genre …` | Hand fixes: language, type, genre, tags (from the fixed `CATALOG_TAGS`)    |
| `npm run catalog:enrich [-- --id <id>]`           | Checks LRCLIB for synced lyrics of the exact recording, sets the flag      |
| `npm run catalog:review`                          | Songs that couldn't be placed for sure, with why and what to try           |
| `npm run catalog:remove -- <id>`                  | Removes a song                                                             |
| `npm run catalog:setup` (runs on `npm install`)   | Makes `git diff` show catalog changes as SQL rows instead of "binary file" |

The schema is versioned with SQLite's `user_version` (`main/catalog/schema.ts`); the
app ignores a file newer than it understands. Every song needs an ISRC, so later
sources (Deezer, LRCLIB) join on it rather than on names. API answers are cached in
`scripts/catalog/.cache/` (not committed).

## Chords and tempo: worked out on the device

Nothing is looked up. The backing track's own audio is analysed in the renderer:

```mermaid
flowchart LR
  music["Backing track<br/>(decoded AudioBuffer)"] --> beat["music/stretch.ts · beatOf<br/>onset strength → tempo → beats"]
  music --> chroma["music/chords.ts · detectChords<br/>chromagram per beat"]
  beat --> chroma
  chroma --> match["match 24 major/minor chords<br/>+ Viterbi smoothing"]
  match --> timeline["state/chords/heard/chords.ts · chordTimeline<br/>mapped onto the song's clips"]
  timeline --> panel["ChordsPanel<br/>now / next + guitar grip"]
  beat --> click["transport/metronome.ts · clickGrid<br/>clicks on the tracked beats"]
```

Results are cached per audio buffer (`audio/dsp/renderCache.ts`), so switching tabs or replaying
doesn't analyse the song again.

## Voice profile: every take, read through the main process

The voice profile (range, tone, pitch accuracy) listens to the vocal clips on every
Songbook song, open or not. The main process (`ipc/songs/voice.ts`) does the file work; the
contract is `src/shared/songs/voice.ts`.

- `voice:listTakes` reads each song's `project.json` and lists its vocal clips, lead and
  harmony (`vocalClipsOf`), with the take's mtime as when it was sung. Clips whose file
  is gone are left out.
- `voice:readTake(folder, file)` returns a take's bytes only when the folder is a song
  directly inside the songs folder and one of its vocal clips plays that file, inside
  its audio folder (`resolveTake`). Backing tracks and other files are refused.
- The renderer summarises each played window in a worker and keeps the summaries in
  `userData/voice.json` (`voice:loadCache` / `voice:saveCache`, checked both ways by
  `parseVoiceCache`), so a take window is analysed once.
- `state/voice/useVoiceProfile.ts` runs that loop when Your voice opens (App dialog), then
  `voiceView.ts` adds the summaries up overall, by month and by song. Nothing shows until
  `VOICE_UNLOCK_SEC` (3 minutes) of sung notes are heard. The charts live in
  `components/VoiceProfile/` and draw at their measured width, so labels keep their size.

## Auto polish learns the singer's taste from finished songs

Auto polish (premium) saves what it heard (`reading`) with each suggestion on the track.
When the singer moves the knobs afterwards, the gap between where they left them and what
the rules say for that reading is what Rove learns from. Nothing else is stored: the
songs are the data, so undoing, re-recording or deleting a song changes what it learns.

- `taste:listExamples` (`ipc/preferences/taste.ts`, gated on `autoPolish`) reads every Songbook
  `project.json` and keeps the polished vocal tracks that still play what was heard and
  have Polish on (`tasteExamplesOf` in `src/shared/preferences/polishTaste.ts`), newest song first.
- `audio/polish/taste.ts` (`learnTaste`) turns them into a small lean per control: a
  recency-weighted average of the singer's moves, pulled toward none while there are few
  songs, capped at `MAX_LEAN`, and never toward more noise reduction. Moves are measured
  from today's rules, never from an earlier lean, so a kept lean settles instead of
  growing, and changing the rules doesn't spoil old songs.
- `suggestPolish` adds the lean inside `AUTO_LIMITS`. Reasons still come from what Rove
  heard; a knob the taste moved far enough says "You usually like this a little higher".

## Where the audio work lives (`src/renderer/src/audio`)

| Folder        | What it does                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/`     | The AudioContext, mic devices and input, recorder setup, lining takes up                                                                        |
| `mix/`        | The live graph: per-track gain, pan, mute and tone; playback; metronome clicks; meters and waveform peaks                                       |
| `polish/`     | Polish settings mapped to the noise gate, EQ, compressor, de-esser and reverb                                                                   |
| `pitch/`      | Sung-note detection, key finding, tuned copies rendered offline                                                                                 |
| `voice/`      | The voice profile: reading takes, summing what each played window adds (time per note, held notes, tone), adding summaries up; runs in a worker |
| `separation/` | Vocal removal: SCNet in a worker with onnxruntime-web, on the CPU's threads                                                                     |
| `music/`      | Beat tracking, time-stretch and pitch-shift for the backing track, chord detection; instrumentals' guitar, sampled piano and drums              |
| `export/`     | Offline mixdown and loudness levelling                                                                                                          |
| `encode/`     | WAV and MP3 encoding (takes and exports)                                                                                                        |
| `dsp/`        | Shared maths: FFT and windows, resampling, units and `clamp`, stats, peak fitting, seeded noise, and the render cache                           |
| `worklets/`   | Code that runs on the audio thread: the recorder and the noise gate                                                                             |

Heavy work (tuning, speed and key, analysis, export) runs offline into buffers; live
playback only mixes what's ready. Recordings on disk are never changed: tuned and
re-pitched versions exist only in memory.

## Vocal removal: a model on the device

```mermaid
sequenceDiagram
  actor Singer
  participant P as MusicPanel
  participant H as useVocalRemoval
  participant W as separation worker
  participant API as window.api
  participant M as Main

  Singer->>P: Remove vocals
  P->>H: remove()
  H->>API: readSeparationModel()
  API->>M: invoke
  M-->>H: SCNet model bytes (13 MB, bundled, read once)
  H->>W: song's channels + model
  Note over W: @audio/neural-separate: 11 s segments, STFT,<br/>SCNet in onnxruntime-web (CPU threads), iSTFT
  W-->>H: progress … then the song minus its vocals
  H->>API: saveInstrumental(dir, song, wav)
  M->>M: write audio/#lt;song#gt; (no vocals).wav (never overwrites)
  H->>P: clips play the instrumental, and withVocals remembers the song
```

The model runs inside the app with nothing online. onnxruntime-web only uses more than
one CPU thread when the page is cross-origin isolated, so the packaged app loads from an
`app://` protocol that sends those headers (`src/main/appProtocol.ts`) instead of
`file://`, and the dev server sends them too. "Put vocals back" switches the clips to
their original songs, which were never touched.

## Free and premium: one list, checked in both processes

`src/shared/license/premiumFeatures.ts` lists the premium features (vocal removal, auto polish
and tuning); everything else is free. The main process keeps the license key
(`main/ipc/license/license.ts`, in `userData/license.json`): with a key the plan is premium,
without one it's free. It sends the plan and a hint of the key to the window as the
theme is sent, once on load and again on each change. Keys are checked through a
`LicenseService`, a fake for now that Lemon Squeezy's license API will replace. The
renderer shows or locks features with `useFeature`, and the main process refuses
premium work itself (`requirePlanFor`), so a hidden button is never the only lock.
Tuning is the exception: it runs only in the renderer, so `tuningOf` checks the plan
before anything is tuned for playback or export.

## What lives where on disk

| Where                              | What                                                    |
| ---------------------------------- | ------------------------------------------------------- |
| `~/Music/Rove/<Song>/project.json` | The song: tracks, clips, polish, music, lyrics          |
| `~/Music/Rove/<Song>/audio/`       | Takes and imported music; never modified or deleted     |
| `userData/state.json`              | Which songs were open, in tab order, and the active one |
| `userData/keymap.json`             | Shortcuts the singer rebound                            |
| `userData/appearance.json`         | Match System, Light or Dark                             |
| `userData/license.json`            | The license key that unlocks premium on this Mac        |
| `userData/window.json`             | The window's size and place, and whether it's maximized |

## Building and shipping

`electron-vite` bundles the three parts into `out/`; `electron-builder` wraps them with
Electron into `Rove.app` and a `.dmg` per chip. Pushing a `v*` tag runs
`.github/workflows/release.yml`, which checks, builds and publishes the release.

### Cutting a release

The workflow builds a `.dmg` for each kind of Mac (`-arm64` for Apple silicon, `-x64` for
Intel) and publishes them as a GitHub release. Start one either way:

- **On GitHub:** Actions → Release → Run workflow. Pick the branch, type the new version
  (`1.1.0`) and run it. It tags that commit `v1.1.0` once the build works.
- **From a terminal:** `git tag v1.1.0 && git push origin v1.1.0`.

The tag sets the app's version. Until the app is signed with a Developer ID and
notarized, macOS blocks the first launch (Open Anyway in Privacy & Security).

### The website

`site/` is an Astro site that shares the app's design tokens, icons and logo.
`.github/workflows/site.yml` publishes it to GitHub Pages when it changes on main and
after every release, so the download buttons always point at the newest `.dmg`
(Settings → Pages → Source must be **GitHub Actions**). The footer's Join form sends
emails to the community waitlist on Kit, set by `JOIN_FORM_URL` in `site/src/site.ts`.
The hero demo plays a synthesised placeholder until a real recording is added: put a
backing, lead and harmony file (same length, made to loop) in `site/public/demo/` and
list them in `DEMO_AUDIO` in `site/src/site.ts`.

The README logo (`docs/assets/logo-*.svg`) is the app's `Logo` at size `lg`, one file
per GitHub theme; regenerate it if the icon or wordmark changes.
