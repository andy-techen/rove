// 24×24 outline icons (stroked) and filled glyphs, by name.
export const STROKE_ICONS = {
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  split: 'M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4',
  // A line held on into an arrow: keep the chord before playing through this bar.
  keep: 'M4 8v8M4 12h15M15 8l4 4-4 4',
  // Two overlapping sheets: make a copy.
  duplicate:
    'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM16 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3',
  // Split's arrows turned inward: two halves back into one.
  join: 'M12 3v18M3 12h6M6 9l3 3-3 3M21 12h-6M18 9l-3 3 3 3',
  delete: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  keyUp: 'M12 19V5M6 11l6-6 6 6',
  keyDown: 'M12 5v14M6 13l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  volume: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  muted: 'M4 9h4l5-4v14l-5-4H4zM17 9.5l5 5M22 9.5l-5 5',
  pan: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  zoomIn: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6M11 8v6',
  zoomOut: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  chevronDown: 'M6 9l6 6 6-6',
  back: 'M15 18l-6-6 6-6',
  // The song's vocals, as a mic; struck through, taking them out.
  vocals: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  vocalsOff:
    'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16',
  reset: 'M4 4v5h5M5.1 15a7.5 7.5 0 1 0 1.6-7.8L4 9',
  // An arrow meeting a line: move the take onto the beat.
  lineUp: 'M5 4v16M19 12H9M13 8l-4 4 4 4',
  // Two voices starting together at one line: a harmony synced to the lead.
  syncHarmony: 'M5 4v16M9 8h10M9 16h6',
  // Going round again, with the record dot inside: sing this take again.
  retake: 'M4 4v5h5M5.1 15a7.5 7.5 0 1 0 1.6-7.8L4 9M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  tune: 'M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4',
  export: 'M12 15V3M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  save: 'M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v5h8V3M7 21v-7h10v7',
  // A large four-point star and a small one: something worked out for you. Kept for the
  // automatic tools (auto polish).
  sparkle:
    'M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  // A crosshair: find the playhead again.
  locate:
    'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 2v3M12 19v3M2 12h3M19 12h3M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z',
  // macOS-style sidebar: a rounded window with a bar along the right, for the side panels.
  hidePanel: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM16 8v8',
  // The same window with the bar along the bottom, for the Polish and Music panel.
  hideBottomPanel: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8 16h8',
  // Two corners pulled outward: open something bigger; pulled in: back to its size.
  expand: 'M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6',
  collapse: 'M20 10h-6V4M4 14h6v6M14 10l6-6M10 14l-6 6',
  // Two beamed notes: an instrumental Rove plays for you.
  instrumental:
    'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9 9l12-2',
  // A metronome: its body, and the arm swinging over the scale.
  metronome: 'M9.5 3h5L19 21H5zM12 16l5-9M7.5 16h9',
  // A sound wave: the music the tempo is taken from.
  matchMusic: 'M1 12c1.8-5 3.7-5 5.5 0s3.7 5 5.5 0 3.7-5 5.5 0 3.7 5 5.5 0',
  // A chord sheet: a page with a note on it. The Chords panel.
  chordSheet:
    'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 16v-5l2 1M10 16a1 1 0 1 0 2 0 1 1 0 1 0-2 0',
  // A pointing finger: fingerpicked, a string at a time.
  pick: 'M8 13V4.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-2a1.5 1.5 0 1 1 3 0V12M14 10.5a1.5 1.5 0 0 1 3 0V12M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2 .2a6 6 0 0 1-5-2.7l-.2-.3c-.3-.5-1.4-2.4-3.3-5.7a1.5 1.5 0 0 1 .5-2 1.9 1.9 0 0 1 2.3.3L8 13',
  // Piano feels. "Chords": a few piano keys, their black keys between them.
  chords:
    'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 14v6M8 4v9h2V4M14 4v9h2V4',
  // "Flowing": the chord's notes rolling on, a wave running into a note.
  flowing: 'M3 16c2.5-6 5.5-6 8 0 1.7 4 4 3.5 5.5 0M16.5 7.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  // A clipboard: paste chords copied from elsewhere.
  paste:
    'M9 3h6v3H9zM9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15',
  // A guitar pick: strummed.
  strum: 'M12 21c-2.6-2.7-7-8.2-7-12.4C5 5.3 8.1 3 12 3s7 2.3 7 5.6c0 4.2-4.4 9.7-7 12.4z',
  lyrics: 'M4 6h14M4 10h14M4 14h6M14 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0M18 18v-6h3',
  // One singer, and two: a lead vocal and a harmony.
  lead: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  harmony:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M18 14.3a7 7 0 0 1 4 6.7',
  // A pencil: change a song's details.
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
  // A closed book: the Songbook. A note on the cover is lost at top-bar size.
  songbook:
    'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19',
  // Words on a picture: a capital T, as story editors show it.
  text: 'M6 5h12M12 5v14M9 19h6',
  // Smaller and larger words: a T with a minus or a plus beside it.
  textSmaller: 'M4 8h10M9 8v11M16 6h5',
  textLarger: 'M4 8h10M9 8v11M16 6h5M18.5 3.5v5',
  // Snap into line: a box with a guide line running through its centre.
  snap: 'M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 3v18'
} as const

export const FILLED_ICONS = {
  play: 'M8 5.5v13a.5.5 0 0 0 .76.43l10.4-6.5a.5.5 0 0 0 0-.86L8.76 5.07A.5.5 0 0 0 8 5.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  record: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  // A dot in a ring: record, on a square button like the tools beside it. The ring runs
  // one way and the gap inside it the other, so the gap stays open.
  recordRing:
    'M12 3a9 9 0 1 1 0 18 9 9 0 1 1 0-18zM12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM12 8a4 4 0 1 1 0 8 4 4 0 1 1 0-8z',
  stop: 'M6 7.5A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5z',
  // Half dark, half light: follow the computer's own setting. The ring runs one way
  // and the right half the other, so the right half stays open.
  contrast: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM12 20V4a8 8 0 0 1 0 16z'
} as const

export type IconName = keyof typeof STROKE_ICONS | keyof typeof FILLED_ICONS
