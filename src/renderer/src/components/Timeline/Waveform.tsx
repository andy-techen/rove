import { useEffect, useRef } from 'react'
import { PeakAccumulator, overviewOf, waveScale } from '../../audio/mix/peaks'
import { TARGET_PEAK_DB } from '../../audio/engine/constants'
import { dbToGain } from '../../audio/dsp/units'
import { useColorScheme } from '../../state/ui/colorScheme'
import { drawPeaks } from './timelineMath'

interface Props {
  audio: AudioBuffer
  /** Seconds into the file where the drawn part starts. */
  offset: number
  pxPerSec: number
  /** Where the drawn part starts inside the clip, in px. */
  left: number
  /** Drawn width in px: only the part of the clip that's on screen. */
  width: number
  height: number
}

// Canvases can't be wider than ~32k px, and a long song zoomed in is far wider
// than that, so a clip only ever draws the slice of itself that's visible.
export function Waveform({
  audio,
  offset,
  pxPerSec,
  left,
  width,
  height
}: Props): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The colour comes from CSS, so a theme switch needs a redraw.
  const scheme = useColorScheme()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || width <= 0 || pxPerSec <= 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.fillStyle = getComputedStyle(canvas).color
    const overview = overviewOf(audio)
    const bucketsPerSec = audio.sampleRate / overview.bucketSize
    drawPeaks(
      ctx,
      overview.resample(canvas.width, bucketsPerSec / (pxPerSec * dpr), offset * bucketsPerSec),
      canvas.height,
      waveScale(overview.peak)
    )
  }, [audio, offset, pxPerSec, width, height, scheme])

  return <canvas ref={canvasRef} className="waveform" style={{ left, width, height }} />
}

interface LiveProps {
  peaks: PeakAccumulator
  sampleRate: number
  pxPerSec: number
  height: number
  /** Visible slice of the take, in px from its start. */
  viewFrom: number
  viewWidth: number
}

// A take being sung has no loudest moment yet, and a growing one would make the
// waveform shrink as it went; it's drawn as if it peaks where the meter aims the singer.
const LIVE_SCALE = waveScale(dbToGain(TARGET_PEAK_DB))

// Redraws every animation frame from the buckets streamed in so far, so the
// waveform grows while the singer is still recording.
export function LiveWaveform({
  peaks,
  sampleRate,
  pxPerSec,
  height,
  viewFrom,
  viewWidth
}: LiveProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || pxPerSec <= 0) return
    const dpr = window.devicePixelRatio || 1
    const bucketsPerSec = sampleRate / peaks.bucketSize
    let raf = 0
    const draw = (): void => {
      const total = (peaks.bucketCount / bucketsPerSec) * pxPerSec
      const cssWidth = Math.max(0, Math.min(total, viewFrom + viewWidth) - viewFrom)
      const pixels = Math.round(cssWidth * dpr)
      canvas.width = pixels
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${cssWidth}px`
      canvas.style.left = `${viewFrom}px`
      ctx.fillStyle = getComputedStyle(canvas).color
      drawPeaks(
        ctx,
        peaks.resample(
          pixels,
          bucketsPerSec / (pxPerSec * dpr),
          (viewFrom / pxPerSec) * bucketsPerSec
        ),
        canvas.height,
        LIVE_SCALE
      )
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [peaks, sampleRate, pxPerSec, height, viewFrom, viewWidth])

  return <canvas ref={canvasRef} className="waveform" style={{ height }} />
}
