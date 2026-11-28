import { t } from '@shared/copy'
import { PERCENT } from '@shared/units'
import { SongKey } from '../../audio/pitch/key'
import {
  MUSIC_SEMITONES_MAX,
  MUSIC_SPEED_RANGE,
  MUSIC_TONE_MAX_DB,
  MusicSettings
} from '../../state/song/project'
import { keyName } from '../../state/chords/theory/noteNames'
import { IconButton } from '../ui/IconButton'
import { KnobControl, KnobRow } from '../ui/KnobControl'
import { parseTypedNumber } from '../ui/NumberField'
import { Panel } from '../ui/Panel'
import type { VocalsState } from '../../state/processing/useVocalRemoval'
import { VocalsControl } from './VocalsControl'
import './MusicPanel.css'
import { formatSigned, parseSemitones, parseSpeed, speedPercent, tempoAt } from './musicFormat'

interface Props {
  trackName: string
  music: MusicSettings
  /** The music's original tempo, once heard. */
  bpm: number | null
  songKey: SongKey | null | undefined
  locked: boolean
  /** `key` groups a knob turn into one undo step. */
  onSpeed(speed: number, key?: string): void
  onSemitones(semitones: number, key?: string): void
  onTone(tone: Partial<Pick<MusicSettings, 'bassDb' | 'brightnessDb'>>, key?: string): void
  /** Back to the original speed, key and tone. */
  onReset(): void
  onHide(): void
  /** Removing the vocals, for music from a file; the chords track has none to remove. */
  vocals?: {
    state: VocalsState
    /** Why removing the vocals last failed, if it did. */
    error?: string | null
    onRemove(): void
    onCancel(): void
    onPutBack(): void
  }
}

type ToneField = 'bassDb' | 'brightnessDb'

/** Speed and key for the backing music, shown when a music track is selected. */
export function MusicPanel({
  trackName,
  music,
  bpm,
  songKey,
  locked,
  onSpeed,
  onSemitones,
  onTone,
  onReset,
  onHide,
  vocals
}: Props): React.JSX.Element {
  const changed =
    music.speed !== 1 || music.semitones !== 0 || music.bassDb !== 0 || music.brightnessDb !== 0

  const tone = (field: ToneField, name: string, hint: string): React.JSX.Element => {
    const db = music[field]
    const text = `${formatSigned(db)} ${t('music.db')}`
    return (
      <KnobControl
        label={name}
        hint={hint}
        disabled={locked}
        value={{ number: formatSigned(db), unit: t('music.db') }}
        onType={(typed) => {
          const n = parseTypedNumber(typed)
          if (n !== null) onTone({ [field]: Math.round(n) })
        }}
        reset={
          db !== 0
            ? { label: t('music.resetTone', { name }), onReset: () => onTone({ [field]: 0 }) }
            : null
        }
        knob={{
          min: -MUSIC_TONE_MAX_DB,
          max: MUSIC_TONE_MAX_DB,
          value: db,
          centre: 0,
          valueText: text,
          onChange: (v) => onTone({ [field]: v }, `music-${field}`)
        }}
      />
    )
  }
  const speedText = bpm
    ? `${tempoAt(bpm, music.speed)} ${t('music.bpm')}`
    : t('music.speedValue', { percent: speedPercent(music.speed) })
  const keyText = `${formatSigned(music.semitones)} ${t('music.semitones')}`

  return (
    <Panel
      label={t('music.label', { name: trackName })}
      title={t('music.title')}
      subject={trackName}
      onHide={onHide}
      actions={
        <>
          {vocals && (
            <VocalsControl
              vocals={vocals.state}
              locked={locked}
              onRemove={vocals.onRemove}
              onCancel={vocals.onCancel}
              onPutBack={vocals.onPutBack}
            />
          )}
          <IconButton
            icon="reset"
            label={t('music.reset')}
            disabled={locked || !changed}
            onClick={onReset}
          />
        </>
      }
    >
      <KnobRow>
        <KnobControl
          label={t('music.speed')}
          hint={t('music.speedHint')}
          disabled={locked}
          value={{
            number: String(bpm ? tempoAt(bpm, music.speed) : speedPercent(music.speed)),
            unit: bpm ? t('music.bpm') : t('music.percent')
          }}
          typeLabel={bpm ? t('music.typeBpm') : t('music.typeSpeed')}
          onType={(text) => {
            const speed = parseSpeed(text, bpm)
            if (speed !== null) onSpeed(speed)
          }}
          reset={
            music.speed !== 1 ? { label: t('music.resetSpeed'), onReset: () => onSpeed(1) } : null
          }
          knob={{
            min: MUSIC_SPEED_RANGE.min * PERCENT,
            max: MUSIC_SPEED_RANGE.max * PERCENT,
            value: speedPercent(music.speed),
            centre: PERCENT,
            valueText: speedText,
            onChange: (v) => onSpeed(v / PERCENT, 'music-speed')
          }}
        />
        <KnobControl
          label={t('music.key')}
          hint={t('music.keyHint')}
          disabled={locked}
          value={{
            number: formatSigned(music.semitones),
            unit: songKey ? undefined : t('music.semitones')
          }}
          typeLabel={t('music.typeKey')}
          // The key you'll sing in comes first; the shift only shows once there is one.
          lead={songKey ? keyName(songKey) : undefined}
          hideValue={!!songKey && music.semitones === 0}
          onType={(text) => {
            const semitones = parseSemitones(text)
            if (semitones !== null) onSemitones(semitones)
          }}
          reset={
            music.semitones !== 0
              ? { label: t('music.resetKey'), onReset: () => onSemitones(0) }
              : null
          }
          knob={{
            min: -MUSIC_SEMITONES_MAX,
            max: MUSIC_SEMITONES_MAX,
            value: music.semitones,
            centre: 0,
            valueText: keyText,
            onChange: (v) => onSemitones(v, 'music-key')
          }}
        />
        {tone('bassDb', t('music.bass'), t('music.bassHint'))}
        {tone('brightnessDb', t('music.brightness'), t('music.brightnessHint'))}
      </KnobRow>
      {vocals?.error && (
        <p className="music-vocals-error" role="alert">
          {vocals.error}
        </p>
      )}
    </Panel>
  )
}
