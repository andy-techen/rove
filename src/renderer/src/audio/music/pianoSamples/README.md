# Piano samples

From the **Salamander Grand Piano v3** by Alexander Holm, a Yamaha C5, licensed under
[Creative Commons Attribution 3.0](LICENSE.txt) (credited in the project `README.md`).
Source: <https://github.com/sfzinstruments/SalamanderGrandPiano> (originally
<https://archive.org/details/SalamanderGrandPianoV3>).

Each file is named by its MIDI note: one every three semitones from D♯2 (39) to F♯4 (66),
which covers every note `pianoVoicing` plays (`PIANO_RANGE`), each within a semitone of a
sample. Velocity layer 8 of 16.

How they were made from `Samples/<note>v8.flac`, so it can be redone:

1. `afconvert -f WAVE -d LEI16@48000 -c 1` to 16-bit mono.
2. Started 2 ms before the hammer (the first sample within 40 dB of the peak), cut to
   5 s with a 1 s fade-out, and peak-normalised to −1 dBFS.
3. `afconvert -f m4af -d aac -b 80000 -c 1` to AAC.
