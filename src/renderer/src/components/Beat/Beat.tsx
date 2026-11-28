import { useRef, useState } from 'react'
import { t } from '@shared/copy'
import { tapTempo } from '../../state/chords/chartBars'
import { BeatsPerBar, SongTempo } from '../../state/song/project'
import { Button } from '../ui/Button'
import { HelpTip } from '../ui/HelpTip'
import { IconButton } from '../ui/IconButton'
import { NumberField, parseTypedNumber } from '../ui/NumberField'
import { raised } from '../ui/Raised'
import { Segmented } from '../ui/Segmented'
import { cx } from '../ui/cx'
import { Slider } from '../ui/Slider'
import { useOutsideClose } from '../ui/useOutsideClose'
import './Beat.css'

interface Props {
  click: {
    on: boolean
    /** 0 to 1. */
    level: number
    /** There's a beat to click along to: heard in the music, or set for an instrumental. */
    available: boolean
    onOn(on: boolean): void
    /** `key` groups a drag into one undo step. */
    onLevel(level: number, key?: string): void
  }
  /** The song's tempo and count, once it has an instrumental that keeps to them. */
  tempo: {
    value: SongTempo
    onTempo(bpm: number): void
    onBeats(beatsPerBar: BeatsPerBar): void
    /** Sets tempo and bar 1 from the music's beat, once Rove has heard it. */
    onMatchMusic?: () => void
  } | null
  locked: boolean
}

// Most songs count in fours; waltzes in threes.
const COUNTS: BeatsPerBar[] = [4, 3]
const PERCENT = 100
const BPM_SHOWN = 10
const MS_PER_SEC = 1000

/**
 * The beat, in one place: the metronome, and the song's tempo and count. A button in the
 * top bar opens it, so it's at hand however the song is made.
 */
export function Beat({ click, tempo, locked }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const taps = useRef<number[]>([])
  useOutsideClose(wrapper, open, () => setOpen(false))
  const clickPercent = Math.round(click.level * PERCENT)
  const clicking = click.on && click.available

  const tap = (): void => {
    if (!tempo) return
    taps.current = [...taps.current, performance.now() / MS_PER_SEC]
    const bpm = tapTempo(taps.current)
    if (bpm) tempo.onTempo(bpm)
  }

  return (
    <div className="beat" ref={wrapper}>
      <IconButton
        icon="metronome"
        label={t('beat.open')}
        aria-expanded={open}
        aria-haspopup="true"
        className={click.on && click.available ? 'beat-on' : undefined}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className={cx('beat-popover', raised)} role="group" aria-label={t('beat.title')}>
          <div className="beat-row">
            <span className="beat-label">{t('music.click')}</span>
            {/* Off until asked for: the speaker shows muted, and a click turns it on. */}
            <IconButton
              icon={clicking ? 'volume' : 'muted'}
              iconSize="secondary"
              className={clicking ? 'beat-on' : undefined}
              label={t('music.clickOn')}
              title={clicking ? t('music.clickOnTitle') : t('music.clickOffTitle')}
              aria-pressed={clicking}
              disabled={locked || !click.available}
              onClick={() => click.onOn(!click.on)}
            />
            <Slider
              className="beat-level"
              tone="muted"
              label={t('beat.clickLevel')}
              min={0}
              max={PERCENT}
              value={clickPercent}
              valueText={`${clickPercent}${t('music.percent')}`}
              disabled={locked || !click.available}
              onChange={(v) => {
                // Setting a volume means wanting to hear it.
                if (!click.on) click.onOn(true)
                click.onLevel(v / PERCENT, 'music-click')
              }}
            />
          </div>
          {!click.available && <p className="beat-note">{t('music.clickNoBeat')}</p>}
          {tempo && (
            <>
              <div className="beat-row">
                <span className="beat-label">{t('beat.tempo')}</span>
                <NumberField
                  label={t('chords.tempoLabel')}
                  // Heard tempos keep their fraction; a tenth is enough to show.
                  value={String(Math.round(tempo.value.bpm * BPM_SHOWN) / BPM_SHOWN)}
                  unit={t('music.bpm')}
                  align="start"
                  disabled={locked}
                  onCommit={(text) => {
                    const bpm = parseTypedNumber(text)
                    if (bpm !== null) tempo.onTempo(bpm)
                  }}
                  onStep={(direction) => tempo.onTempo(Math.round(tempo.value.bpm) + direction)}
                />
                <Button size="sm" variant="quiet" disabled={locked} onClick={tap}>
                  {t('chords.tap')}
                </Button>
                {tempo.onMatchMusic && (
                  <IconButton
                    icon="matchMusic"
                    iconSize="secondary"
                    label={t('beat.matchMusic')}
                    title={t('beat.matchMusicTitle')}
                    disabled={locked}
                    onClick={tempo.onMatchMusic}
                  />
                )}
              </div>
              <div className="beat-row">
                <span className="beat-label">{t('beat.count')}</span>
                <Segmented
                  className="beat-count"
                  label={t('chords.countLabel')}
                  options={COUNTS.map((n) => ({ value: n, label: t('chords.countOf', { n }) }))}
                  value={tempo.value.beatsPerBar}
                  disabled={locked}
                  onChange={tempo.onBeats}
                />
                <HelpTip lines={[t('chords.tempoHelp.what'), t('chords.tempoHelp.unsure')]} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
