import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMultiplayer } from '@/api/hooks'
import type { MultiplayerData } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { QueryBoundary } from '@/components/ui/states'
import { authorColor } from '@/lib/authorColors'
import { formatDuration, formatNumber } from '@/lib/format'
import { formatClock } from '../viewer/useReplay'

/** Who drew when: the blocks of turns per author on one axis (requirement MUL-03). */
function TurnStrip({ data, nameOf }: { data: MultiplayerData; nameOf: (id: string) => string }) {
  const { t } = useTranslation()
  const { blocks } = data.turns
  const authors = data.authors.map((a) => a.playerId)
  const max = Math.max(1000, ...blocks.map((b) => b.endMs))
  const min = Math.min(0, ...blocks.map((b) => b.startMs))
  const [width, row, left] = [820, 22, 96]
  const x = (ms: number) => left + ((ms - min) / (max - min)) * (width - left - 12)
  const height = authors.length * row + 24
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={t('multiplayer.turnLabel')}>
      {authors.map((author, index) => (
        <g key={author}>
          <text x={left - 8} y={20 + index * row + 4} textAnchor="end" fontSize="12" fill="#334155">
            <tspan fill={authorColor(index)}>● </tspan>{nameOf(author).slice(0, 12)}
          </text>
          <line x1={left} x2={width - 12} y1={20 + index * row + row / 2 - 4} y2={20 + index * row + row / 2 - 4} stroke="#f1f5f9" />
        </g>
      ))}
      {blocks.map((block, n) => {
        const index = authors.indexOf(block.playerId)
        return (
          <rect key={n} x={x(block.startMs)} y={20 + index * row} width={Math.max(2, x(block.endMs) - x(block.startMs))} height={row - 8} rx="2" fill={authorColor(index)} fillOpacity="0.85">
            <title>{`${nameOf(block.playerId)}: ${formatClock(block.startMs)}-${formatClock(block.endMs)}`}</title>
          </rect>
        )
      })}
      <text x={left} y={12} fontSize="11" fill="#64748b">{formatClock(min)}</text>
      <text x={width - 12} y={12} textAnchor="end" fontSize="11" fill="#64748b">{formatClock(max)}</text>
    </svg>
  )
}

/** Contribution, proximity and turn-taking of the authors of a drawing made together (requirements MUL-01..03). */
export function MultiplayerPanel({ drawingId, authorNames }: { drawingId: string; authorNames: Record<string, string> }) {
  const { t } = useTranslation()
  const [proximityCm, setProximityCm] = useState(5)
  const query = useMultiplayer(drawingId, proximityCm / 100)
  const nameOf = (id: string) => authorNames[id] ?? `#${id.slice(0, 8)}`

  return (
    <Card
      title={t('multiplayer.title')}
      subtitle={t('multiplayer.subtitle')}
      actions={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          {t('multiplayer.radius')}
          <input
            type="number" min={0.5} max={50} step={0.5} value={proximityCm}
            className="w-20 rounded-md border border-slate-300 px-2 py-1"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 0.5 && v <= 50) setProximityCm(v) }}
          />
          cm
        </label>
      }
    >
      <QueryBoundary query={query}>
        {(data) => (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">{t('multiplayer.author')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('multiplayer.strokes')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('multiplayer.ink')}</th>
                    <th className="px-3 py-2 font-medium">{t('multiplayer.share')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('multiplayer.time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.authors.map((author, index) => (
                    <tr key={author.playerId}>
                      <td className="py-2 pr-4 font-medium text-slate-900"><span style={{ color: authorColor(index) }} aria-hidden="true">● </span>{nameOf(author.playerId)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{author.strokes}{author.erasedStrokes > 0 && <span className="text-slate-400"> (+{author.erasedStrokes})</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(author.inkLength, 2)} m</td>
                      <td className="w-40 px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 flex-1 rounded-full bg-slate-100"><span className="block h-2.5 rounded-full" style={{ width: `${author.inkShare * 100}%`, background: authorColor(index) }} /></span>
                          <span className="w-10 text-right tabular-nums">{formatNumber(author.inkShare * 100, 0)} %</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{author.drawingMs != null ? formatDuration(author.drawingMs / 1000) : t('common.notAvailable')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.multiAuthor && (
              <>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('multiplayer.proximity', { radius: formatNumber(data.proximity.radius * 100, 1) })}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 pr-4 font-medium">{t('multiplayer.pair')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('multiplayer.firstNearSecond')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('multiplayer.secondNearFirst')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('multiplayer.touching')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('multiplayer.closest')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.proximity.pairs.map((pair) => (
                          <tr key={`${pair.a}-${pair.b}`}>
                            <td className="py-2 pr-4 text-slate-900">{nameOf(pair.a)} · {nameOf(pair.b)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatNumber(pair.aNearB * 100, 0)} %</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatNumber(pair.bNearA * 100, 0)} %</td>
                            <td className="px-3 py-2 text-right tabular-nums">{pair.touchingStrokesA} / {pair.touchingStrokesB}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{pair.minDistance != null ? `${formatNumber(pair.minDistance * 100, 1)} cm` : t('common.notAvailable')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('multiplayer.turns')}</h3>
                  <TurnStrip data={data} nameOf={nameOf} />
                  <p className="mt-2 text-sm text-slate-600">
                    {t('multiplayer.turnSummary', {
                      switches: data.turns.switches,
                      share: formatNumber(data.turns.simultaneousShare * 100, 0),
                      time: formatDuration(data.turns.simultaneousMs / 1000),
                    })}
                  </p>
                </section>
              </>
            )}
          </div>
        )}
      </QueryBoundary>
    </Card>
  )
}
