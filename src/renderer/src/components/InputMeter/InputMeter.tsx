import { CSSProperties, useEffect, useRef, useState } from 'react'
import { t } from '@shared/copy'
import { createMeter } from '../../audio/engine'
import {
  GOOD_DB,
  LOUD_DB,
  LevelCheck,
  LevelZone,
  METER_FLOOR_DB,
  RecentPeak,
  levelZone,
  meterFill,
  nextDisplayDb,
  toDb
} from '../../audio/meter'
import './InputMeter.css'

const MS_PER_SEC = 1000

// The green "aim here" band behind the bar.
const SWEET_SPOT_STYLE = {
  '--from': meterFill(GOOD_DB),
  '--to': meterFill(LOUD_DB)
} as CSSProperties

interface Props {
  source: MediaStreamAudioSourceNode
  /** Called once the singer has held a good level long enough. */
  onInRange?: () => void
  showLabel?: boolean
  /** 'warnings' keeps the screen quiet: the hint only appears when it's too loud. */
  hint?: 'always' | 'warnings'
}

const WARNING_ZONES: LevelZone[] = ['loud', 'clip']

export function InputMeter({
  source,
  onInRange,
  showLabel = true,
  hint: hintMode = 'always'
}: Props): React.JSX.Element {
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
      const dtSec = (now - last) / MS_PER_SEC
      const peakDb = toDb(meter.readPeak())
      displayDb = nextDisplayDb(displayDb, peakDb, dtSec)
      last = now
      if (!reported && check.update(dtSec, displayDb)) {
        reported = true
        onInRangeRef.current?.()
      }
      const fill = fillRef.current
      if (fill) {
        fill.style.setProperty('--level', String(meterFill(displayDb)))
        fill.dataset.zone = levelZone(displayDb)
      }
      setHintZone(levelZone(recent.push(now / MS_PER_SEC, peakDb)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      meter.dispose()
    }
  }, [source])

  const hint = t(`meter.hints.${hintZone}`)
  return (
    <div className="meter">
      {showLabel && <span className="meter-label">{t('meter.label')}</span>}
      <div
        className="meter-track"
        role="meter"
        aria-label={t('meter.ariaLabel')}
        aria-valuetext={hint}
      >
        <div className="meter-sweet-spot" style={SWEET_SPOT_STYLE} />
        <div ref={fillRef} className="meter-fill" data-zone="silent" />
      </div>
      {(hintMode === 'always' || WARNING_ZONES.includes(hintZone)) && (
        <p className="meter-hint" data-zone={hintZone} aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  )
}
