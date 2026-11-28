import { useRef, useState } from 'react'
import { t } from '@shared/copy'
import { ChartPlace } from '../chords/chart/chart'
import { clearBars, insertBars, pasteBars } from '../chords/chart/chartBars'
import { chordSheetToPaste, unreadNote } from '../chords/theory/chordText'
import { CopiedBeats, Track, copyBeats, withChartBars, withPastedBeats } from '../song/project'
import { pasteTarget } from '../song/selectors'
import type { Song } from '../song/useSong'
import { ClipRef, CopiedClips, copyClips, pasteClips } from './clipSets'
import {
  BarsTarget,
  CopiedBars,
  barsTarget,
  canPaste,
  copyChartBars,
  pasteAfter,
  pastedSpan,
  placeOver
} from './songClipboard'

interface Options {
  song: Song
  canEdit: boolean
  selectedClips: ClipRef[]
  /** The track clips paste into when they came from more than one. */
  selectedTrackId: string | null
  /** The track open in the panel under the timeline, whose picked bars copy acts on. */
  panelTrack: Track | undefined
  place: ChartPlace
  onPlace(place: ChartPlace): void
  position: number
  seek(sec: number): void
  onPastedClips(clips: ClipRef[]): void
  /** Deletes what Delete would, for cutting clips and drum bars. */
  remove(): void
}

export interface SongClipboard {
  /** What copy and paste act on instead of clips: bars picked in the Instrumental panel. */
  target: BarsTarget | null
  canPaste: boolean
  /** What the last paste into a chart couldn't do, shown under that chart. */
  pasteNote: { trackId: string; text: string } | null
  copy(): void
  cut(): void
  paste(): void
  /** The Paste chords button: always the clipboard, saying so when it holds no chords. */
  pasteChords(): Promise<void>
}

/** Copy, cut and paste for clips, bars of chords and drum bars. */
export function useSongClipboard({
  song,
  canEdit,
  selectedClips,
  selectedTrackId,
  panelTrack,
  place,
  onPlace,
  position,
  seek,
  onPastedClips,
  remove
}: Options): SongClipboard {
  const open = song.song
  // Copied clips stay within this song, whose folder holds the audio they point at.
  const [clips, setClips] = useState<CopiedClips | null>(null)
  // Copied bars of chords, kept apart from clips: they paste into any instrumental.
  const [bars, setBars] = useState<CopiedBars | null>(null)
  // Copied drum bars, kept apart from chords: they paste only into beats.
  const [beats, setBeats] = useState<CopiedBeats | null>(null)
  const [pasteNote, setPasteNote] = useState<SongClipboard['pasteNote']>(null)
  // The clipboard's text when bars were last copied in Rove: Paste uses those bars until
  // something else (a chord sheet from the web) is copied.
  const clipboardAtCopy = useRef<string | null>(null)
  const target = barsTarget(panelTrack, place, selectedClips.length > 0)
  const chart = target?.kind === 'chart' ? target : null

  const rememberClipboard = (): void => {
    void window.api.readClipboardText().then((text) => {
      clipboardAtCopy.current = text
    })
  }

  const copy = (): void => {
    if (target?.kind === 'beats') {
      setBeats(copyBeats(target.beats, ...target.range))
      return
    }
    if (target) {
      setBars(copyChartBars(target))
      rememberClipboard()
      return
    }
    if (open && selectedClips.length) setClips(copyClips(open.data, selectedClips))
  }

  const cut = (): void => {
    if (!chart) {
      copy()
      remove()
      return
    }
    if (!open || !canEdit) return
    const [first, last] = chart.range
    setBars(copyChartBars(chart))
    rememberClipboard()
    song.edit(withChartBars(open.data, chart.trackId, clearBars(chart.bars, first, last)))
  }

  /** Writes a pasted chord sheet over the chart from the picked bar; false without one. */
  const pasteSheet = (sheet: ReturnType<typeof chordSheetToPaste>): boolean => {
    if (!open || !chart || !sheet) return false
    const [first] = chart.range
    song.edit(withChartBars(open.data, chart.trackId, pasteBars(chart.bars, first, sheet.bars)))
    const note = unreadNote(sheet.unread, first)
    setPasteNote(note ? { trackId: chart.trackId, text: note } : null)
    onPlace(placeOver(first, sheet.bars.length))
    return true
  }

  /**
   * Paste into a chord chart: a chord sheet copied from the web writes its chords over
   * the bars from the picked one on; bars copied in Rove go in after the picked ones.
   */
  const pasteIntoChart = async (): Promise<void> => {
    if (!open || !chart || !canEdit) return
    const text = await window.api.readClipboardText()
    if (pasteSheet(chordSheetToPaste(text, bars ? clipboardAtCopy.current : null))) return
    if (!bars) return
    const { at, place } = pasteAfter(chart.range, bars.bars.length)
    const next = insertBars(chart.bars, at, bars.bars)
    song.edit(
      withChartBars(open.data, chart.trackId, next, insertBars(chart.feels, at, bars.feels))
    )
    onPlace(place)
  }

  const paste = (): void => {
    if (target?.kind === 'beats' && beats) {
      if (!open || !canEdit) return
      const { at, place } = pasteAfter(target.range, beats.parts.length)
      song.edit(withPastedBeats(open.data, target.trackId, at, beats))
      onPlace(place)
      return
    }
    if (chart) {
      void pasteIntoChart()
      return
    }
    if (!open || !clips || !canEdit) return
    const into = pasteTarget(open.data, clips.items[0].trackId, selectedTrackId)
    const { project, pasted } = pasteClips(open.data, clips, position, into)
    song.edit(project)
    onPastedClips(pasted)
    // Landing at the end of the paste means pasting again lays copies end to end.
    seek(position + pastedSpan(clips))
  }

  const pasteChords = async (): Promise<void> => {
    if (!open || !chart || !canEdit) return
    const sheet = chordSheetToPaste(await window.api.readClipboardText(), null)
    if (!pasteSheet(sheet)) setPasteNote({ trackId: chart.trackId, text: t('chords.pasteNone') })
  }

  return {
    target,
    canPaste: canPaste({ clips, bars, beats }, target),
    pasteNote,
    copy,
    cut,
    paste,
    pasteChords
  }
}
