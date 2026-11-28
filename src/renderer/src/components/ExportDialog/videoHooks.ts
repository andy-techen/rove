import { RefObject, useEffect, useRef, useState } from 'react'
import { VideoOptions, VideoScene } from '../../audio/export/videoFrame'
import { SongLyrics, lineStart } from '../../state/lyrics/lyrics'

/** The singer's own picture, kept while the export dialog is open so they can switch back. */
export interface Picture {
  file: File | null
  /** Decoded for drawing; null until ready, and always in jsdom, which can't decode. */
  image: ImageBitmap | null
  choose(file: File): void
}

export function usePicture(): Picture {
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  useEffect(() => {
    if (!file || typeof createImageBitmap !== 'function') return
    let live = true
    createImageBitmap(file).then(
      (bitmap) => (live ? setImage(bitmap) : bitmap.close()),
      () => live && setImage(null)
    )
    return () => {
      live = false
    }
  }, [file])
  return { file, image, choose: setFile }
}

/** Draws `draw` onto a canvas whenever its inputs change; nothing in jsdom, which can't draw. */
export function useDrawing(
  draw: (ctx: CanvasRenderingContext2D) => void,
  deps: unknown[]
): RefObject<HTMLCanvasElement | null> {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) draw(ctx)
    // The caller lists what the drawing depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return canvas
}

/**
 * What a preview draws: the singer's choices with their picture decoded. Until the
 * picture is ready it shows the evening background, so the words are already visible.
 */
export function sceneFor(
  value: VideoOptions,
  image: ImageBitmap | null,
  lyrics: SongLyrics | null
): VideoScene {
  const { background } = value
  return {
    background:
      background.kind !== 'picture'
        ? background
        : image
          ? { kind: 'picture', image }
          : { kind: 'blank', id: 'evening' },
    texts: value.texts,
    lyrics: value.lyrics ? lyrics : null
  }
}

/** When a preview is drawn: the first sung line, so lyrics show when they're on. */
export function previewTime(lyrics: SongLyrics | null): number {
  const first = lyrics?.lines.find((line) => line.text && line.time !== null)
  return (first && lineStart(first, lyrics?.offsetSec ?? 0)) ?? 0
}
