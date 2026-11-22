import { useEffect, useRef, useState } from 'react'
import { createMeter } from '../audio/engine'
import {
  LevelCheck,
  LevelZone,
  METER_FLOOR_DB,
  RecentPeak,
  ZONE_HINTS,
  levelZone,
  meterFill,
  nextDisplayDb,
  toDb
} from '../audio/meter'

const SWEET_SPOT = { left: meterFill(-24), right: 1 - meterFill(-6) }

interface Props {
  source: MediaStreamAudioSourceNode
  onInRange?: () => void
}

export function InputMeter({ source, onInRange }: Props): React.JSX.Element {
  const fillRef = useRef<HTMLDivElement>(null)
  const [hintZone, setHintZone] = useState<LevelZone>('silent')
  const onInRangeRef = useRef(onInRange)
  useEffect(() => {
    onInRangeRef.current = onInRange
  }, [onInRange])

  useEffect(() => {
    const meter = createMeter(source)
    const recent = new RecentPeak()
    const check = new LevelCheck()
    let reported = false
    let displayDb = METER_FLOOR_DB
    let last = performance.now()
    let raf = 0

    // The bar is written straight to the DOM every frame; only the hint goes
    // through React state, and React skips re-rendering when it is unchanged.
    const tick = (now: number): void => {
      const dtSec = (now - last) / 1000
      const peakDb = toDb(meter.readPeak())
      displayDb = nextDisplayDb(displayDb, peakDb, dtSec)
      last = now
      if (!reported && check.update(dtSec, displayDb)) {
        reported = true
        onInRangeRef.current?.()
      }
      const fill = fillRef.current
      if (fill) {
        fill.style.transform = `scaleX(${meterFill(displayDb)})`
        fill.dataset.zone = levelZone(displayDb)
      }
      setHintZone(levelZone(recent.push(now / 1000, peakDb)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      meter.dispose()
    }
  }, [source])

  return (
    <div className="meter">
      <span className="field-label">Input level</span>
      <div
        className="meter-track"
        role="meter"
        aria-label="Microphone input level"
        aria-valuetext={ZONE_HINTS[hintZone]}
      >
        <div
          className="meter-sweet-spot"
          style={{ left: `${SWEET_SPOT.left * 100}%`, right: `${SWEET_SPOT.right * 100}%` }}
        />
        <div ref={fillRef} className="meter-fill" data-zone="silent" />
      </div>
      <p className="meter-hint" data-zone={hintZone} aria-live="polite">
        {ZONE_HINTS[hintZone]}
      </p>
    </div>
  )
}
