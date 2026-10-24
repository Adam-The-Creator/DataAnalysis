import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTimeline } from '@/api/hooks'
import type { TimelineData, TimelineItem } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { QueryBoundary } from '@/components/ui/states'
import { authorColor } from '@/lib/authorColors'
import { cn } from '@/lib/cn'
import { formatDuration, formatNumber } from '@/lib/format'
import { formatClock, type Replay } from '../viewer/useReplay'

/**
 * The behaviour timeline (requirement DRW-07): strokes per author, erasing and undoing, menu use, tool changes and
 * the pauses on one time axis. A click on the axis moves the replay there, a click on a stroke selects it.
 * Events are told apart by shape as well as by colour.
 */

const WIDTH = 860
const PAD = { left: 96, right: 16, top: 26, bottom: 8 }
const ROW = 26

type EventKind = Exclude<TimelineItem['kind'], 'stroke' | 'idle'>

const eventStyle: Record<EventKind, { color: string }> = {
  erase: { color: '#d55e00' },
  undo: { color: '#cc79a7' },
  menuOpen: { color: '#0072b2' },
  menuClose: { color: '#56b4e9' },
  modeChange: { color: '#555555' },
  colorChange: { color: '#e69f00' },
  widthChange: { color: '#009e73' },
}

/** One small shape per kind of event, centred on (0, 0). */
function Shape({ kind }: { kind: EventKind }) {
  const color = eventStyle[kind].color
  switch (kind) {
    case 'erase': return <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke={color} strokeWidth="2" fill="none" />
    case 'undo': return <path d="M4 -4 L-4 0 L4 4 Z" fill={color} />
    case 'menuOpen': return <path d="M0 -5 L5 4 L-5 4 Z" fill={color} />
    case 'menuClose': return <path d="M0 5 L5 -4 L-5 -4 Z" fill="none" stroke={color} strokeWidth="1.8" />
    case 'modeChange': return <rect x="-4" y="-4" width="8" height="8" fill={color} />
    case 'colorChange': return <circle r="4.5" fill={color} />
    case 'widthChange': return <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill={color} />
  }
}

function niceStep(span: number): number {
  const target = span / 8
  const steps = [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000]
  return steps.find((s) => s >= target) ?? 1_200_000
}

function TimelineChart({ data, authorNames, selectedId, onSelect, replay }: {
  data: TimelineData
  authorNames: Record<string, string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  replay: Replay
}) {
  const { t } = useTranslation()
  const times = data.items.map((i) => ('startMs' in i ? i.startMs : i.atMs))
  const min = Math.min(0, ...times)
  const max = Math.max(data.durationMs, 1000)
  const span = max - min
  const x = (ms: number) => PAD.left + ((ms - min) / span) * (WIDTH - PAD.left - PAD.right)

  const authors = [...new Set(data.items.flatMap((i) => (i.kind === 'stroke' || i.kind === 'erase' || i.kind === 'undo' ? [i.authorId] : [])))]
  const hasTools = data.items.some((i) => ['menuOpen', 'menuClose', 'modeChange', 'colorChange', 'widthChange'].includes(i.kind))
  const rows = authors.length + (hasTools ? 1 : 0)
  const height = PAD.top + rows * ROW + PAD.bottom
  const rowY = (index: number) => PAD.top + index * ROW
  const toolsRow = authors.length

  const step = niceStep(span)
  const ticks: number[] = []
  for (let tick = Math.ceil(min / step) * step; tick <= max; tick += step) ticks.push(tick)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="w-full"
      role="img"
      aria-label={t('timeline.label')}
      onClick={(event) => {
        if (!replay.available) return
        const box = event.currentTarget.getBoundingClientRect()
        const fraction = ((event.clientX - box.left) / box.width) * WIDTH
        replay.seek(min + ((fraction - PAD.left) / (WIDTH - PAD.left - PAD.right)) * span)
      }}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={PAD.top - 4} y2={height - PAD.bottom} stroke="#e2e8f0" />
          <text x={x(tick)} y={PAD.top - 9} textAnchor="middle" fontSize="11" fill="#64748b">{formatClock(tick)}</text>
        </g>
      ))}

      {data.items.filter((i) => i.kind === 'idle').map((item, n) => (
        item.kind === 'idle' && (
          <rect key={`idle-${n}`} x={x(item.startMs)} y={PAD.top} width={Math.max(1, x(item.endMs) - x(item.startMs))} height={rows * ROW} fill="#fef3c7" opacity="0.8">
            <title>{t('timeline.pause', { seconds: formatNumber((item.endMs - item.startMs) / 1000, 0) })}</title>
          </rect>
        )
      ))}

      {data.breaks.map((mark, n) => (
        <g key={`break-${n}`}>
          <line x1={x(mark.atMs)} x2={x(mark.atMs)} y1={PAD.top - 4} y2={height - PAD.bottom} stroke="#0f172a" strokeDasharray="4 3" />
          <text x={x(mark.atMs) + 4} y={height - PAD.bottom - 2} fontSize="10" fill="#0f172a">
            {t('timeline.break', { duration: formatDuration(mark.realMs / 1000) })}
          </text>
        </g>
      ))}

      {authors.map((author, index) => (
        <text key={author} x={PAD.left - 8} y={rowY(index) + ROW / 2 + 4} textAnchor="end" fontSize="12" fill="#334155">
          <tspan fill={authorColor(index)}>● </tspan>{(authorNames[author] ?? `#${author.slice(0, 6)}`).slice(0, 12)}
        </text>
      ))}
      {hasTools && <text x={PAD.left - 8} y={rowY(toolsRow) + ROW / 2 + 4} textAnchor="end" fontSize="12" fill="#334155">{t('timeline.tools')}</text>}

      {data.items.map((item, n) => {
        if (item.kind === 'stroke') {
          const index = authors.indexOf(item.authorId)
          const color = authorColor(index)
          const selected = item.lineId === selectedId
          return (
            <rect
              key={`s-${n}`}
              x={x(item.startMs)} y={rowY(index) + 5} width={Math.max(2, x(item.endMs) - x(item.startMs))} height={ROW - 12} rx="2"
              fill={item.erased ? 'white' : color} fillOpacity={item.erased ? 0.6 : 0.85}
              stroke={selected ? '#f59e0b' : color} strokeWidth={selected ? 3 : 1.5} strokeDasharray={item.erased ? '3 2' : undefined}
              className="cursor-pointer"
              onClick={(event) => { event.stopPropagation(); onSelect(item.lineId) }}
            >
              <title>{t('timeline.stroke', { seconds: formatNumber((item.endMs - item.startMs) / 1000, 1), state: t(item.erased ? 'viewer.erased' : 'viewer.drawn') })}</title>
            </rect>
          )
        }
        if (item.kind === 'idle') return null
        const row = item.kind === 'erase' || item.kind === 'undo' ? authors.indexOf(item.authorId) : toolsRow
        if (row < 0) return null
        return (
          <g key={`e-${n}`} transform={`translate(${x(item.atMs)} ${rowY(row) + ROW / 2})`}>
            <Shape kind={item.kind} />
            <title>{t(`timeline.events.${item.kind}`)}{'value' in item && item.value ? `: ${item.value}` : ''}</title>
          </g>
        )
      })}

      {replay.active && (
        <line x1={x(replay.time)} x2={x(replay.time)} y1={PAD.top - 4} y2={height - PAD.bottom} stroke="#4f46e5" strokeWidth="2" />
      )}
    </svg>
  )
}

export function TimelinePanel({ drawingId, authorNames, selectedId, onSelect, replay }: {
  drawingId: string
  authorNames: Record<string, string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  replay: Replay
}) {
  const { t } = useTranslation()
  const [gap, setGap] = useState(5)
  const [draft, setDraft] = useState('5')
  const query = useTimeline(drawingId, gap)

  const commit = () => {
    const value = Number(draft)
    if (Number.isFinite(value) && value >= 0.5 && value <= 600) setGap(value)
    else setDraft(String(gap))
  }

  return (
    <Card
      title={t('timeline.title')}
      subtitle={t('timeline.subtitle')}
      actions={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          {t('timeline.pauseLimit')}
          <input
            type="number" min={0.5} max={600} step={0.5} value={draft}
            className="w-20 rounded-md border border-slate-300 px-2 py-1"
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
          />
          s
        </label>
      }
    >
      <QueryBoundary query={query}>
        {(data) => (
          <div className={cn('space-y-4', query.isPlaceholderData && 'opacity-60')}>
            {!data.hasTimeData && data.items.length === 0 ? (
              <p className="text-sm text-slate-500">{t('timeline.empty')}</p>
            ) : (
              <>
                <TimelineChart data={data} authorNames={authorNames} selectedId={selectedId} onSelect={onSelect} replay={replay} />
                <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600" aria-label={t('timeline.legend')}>
                  {(Object.keys(eventStyle) as EventKind[]).map((kind) => (
                    <li key={kind} className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><Shape kind={kind} /></svg>
                      {t(`timeline.events.${kind}`)}
                    </li>
                  ))}
                  <li className="flex items-center gap-1.5"><span className="inline-block h-3 w-4 bg-amber-100" aria-hidden="true" />{t('timeline.pauseLegend')}</li>
                </ul>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  {([
                    ['strokes', data.summary.strokes], ['erasedStrokes', data.summary.erasedStrokes],
                    ['erases', data.summary.erases], ['undos', data.summary.undos],
                    ['menuOpens', data.summary.menuOpens], ['toolChanges', data.summary.toolChanges],
                    ['idlePeriods', data.summary.idlePeriods], ['idleSeconds', formatDuration(data.summary.idleSeconds)],
                  ] as const).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                      <dt className="text-slate-500">{t(`timeline.summary.${key}`)}</dt>
                      <dd className="tabular-nums text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        )}
      </QueryBoundary>
    </Card>
  )
}
