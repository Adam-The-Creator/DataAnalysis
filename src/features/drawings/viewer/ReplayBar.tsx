import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { formatClock, REPLAY_SPEEDS, type Replay } from './useReplay'

/** Play, pause, speed and scrubber of the replay (requirement DRW-05). */
export function ReplayBar({ replay }: { replay: Replay }) {
  const { t } = useTranslation()

  if (!replay.available) {
    return <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">{t('replay.unavailable')}</p>
  }
  const atEnd = replay.active && replay.time >= replay.duration

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-sm">
      <Button
        variant="primary"
        className="min-w-24"
        onClick={() => (replay.playing ? replay.pause() : replay.play())}
      >
        {replay.playing ? t('replay.pause') : atEnd ? t('replay.again') : t('replay.play')}
      </Button>
      <label className="flex min-w-48 flex-1 items-center gap-3 text-slate-600">
        <span className="sr-only">{t('replay.scrubber')}</span>
        <input
          type="range"
          className="w-full"
          min={0}
          max={Math.max(1, Math.round(replay.duration))}
          step={50}
          value={replay.active ? Math.round(replay.time) : 0}
          aria-valuetext={`${formatClock(replay.time)} / ${formatClock(replay.duration)}`}
          onChange={(e) => replay.seek(Number(e.target.value))}
        />
        <span className="w-24 shrink-0 text-right tabular-nums">{formatClock(replay.active ? replay.time : 0)} / {formatClock(replay.duration)}</span>
      </label>
      <label className="flex items-center gap-2 text-slate-600">
        {t('replay.speed')}
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1"
          value={replay.speed}
          onChange={(e) => replay.setSpeed(Number(e.target.value))}
        >
          {REPLAY_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
        </select>
      </label>
      {replay.active && (
        <Button variant="secondary" onClick={replay.stop}>{t('replay.showAll')}</Button>
      )}
    </div>
  )
}
