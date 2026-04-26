import math
import tempfile
import os
import logging
from typing import Optional

import numpy as np
import librosa

from constants import NOTE_NAMES, PITCH_FLOOR, PITCH_CEILING, MIDI_A4, HZ_A4

logger = logging.getLogger(__name__)


def midi_to_note(midi: int) -> str:
    octave = (midi // 12) - 1
    name = NOTE_NAMES[midi % 12]
    return f"{name}{octave}"


def hz_to_midi(hz: float) -> int:
    return round(MIDI_A4 + 12 * math.log2(hz / HZ_A4))


def analyze_audio(path: str) -> Optional[dict]:
    y, sr = librosa.load(path, sr=None, mono=True)

    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz(PITCH_FLOOR),
        fmax=librosa.note_to_hz(PITCH_CEILING),
        sr=sr,
    )

    voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]

    if len(voiced_f0) == 0:
        return None

    midi_values = [hz_to_midi(hz) for hz in voiced_f0 if hz > 0]

    if not midi_values:
        return None

    lowest_midi = int(min(midi_values))
    highest_midi = int(max(midi_values))

    return {
        "lowest_midi": lowest_midi,
        "highest_midi": highest_midi,
        "lowest_note": midi_to_note(lowest_midi),
        "highest_note": midi_to_note(highest_midi),
        "range_semitones": highest_midi - lowest_midi,
    }


def download_to_tempfile(audio_bytes: bytes) -> str:
    """Writes audio bytes to a temp file and returns its path. Caller must delete."""
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as tmp:
        tmp.write(audio_bytes)
        return tmp.name


def delete_tempfile(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        logger.warning("Failed to delete temp file %s", path)
