import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH
} from 'mediabunny'

/**
 * Frames per second. The picture only changes when a lyric line does, but social apps
 * expect a normal frame rate; a constant 24 plays everywhere, and a still frame costs
 * almost nothing to encode.
 */
const FRAME_RATE = 24

/**
 * Encodes the mix with a picture as an H.264/AAC MP4, the pairing every phone and social
 * app plays. `draw` paints the frame for a moment onto `canvas` before it's captured.
 * Encoding uses the browser's WebCodecs, so on a Mac it runs on the media engine.
 */
export async function encodeMp4(
  channels: Float32Array[],
  sampleRate: number,
  canvas: HTMLCanvasElement,
  draw: (timeSec: number) => void,
  onProgress: (fraction: number) => void
): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Output({
    // The index goes at the front, so the video starts playing before it's fully loaded.
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget()
  })
  const video = new CanvasSource(canvas, { codec: 'avc', quality: QUALITY_HIGH })
  const audio = new AudioBufferSource({ codec: 'aac', quality: QUALITY_HIGH })
  output.addVideoTrack(video, { frameRate: FRAME_RATE })
  output.addAudioTrack(audio)
  await output.start()

  const length = channels[0].length
  const buffer = new AudioBuffer({ numberOfChannels: channels.length, length, sampleRate })
  channels.forEach((channel, i) => buffer.getChannelData(i).set(channel))
  await audio.add(buffer)
  audio.close()

  const frames = Math.ceil((length / sampleRate) * FRAME_RATE)
  for (let i = 0; i < frames; i++) {
    const time = i / FRAME_RATE
    draw(time)
    await video.add(time, 1 / FRAME_RATE)
    onProgress((i + 1) / frames)
  }
  video.close()
  await output.finalize()
  if (!output.target.buffer) throw new Error('The video was not written')
  return new Uint8Array(output.target.buffer)
}
