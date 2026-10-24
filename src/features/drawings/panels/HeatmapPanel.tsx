import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useHeatmap } from '@/api/hooks'
import type { HeatmapData } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { QueryBoundary } from '@/components/ui/states'
import { heatColor } from '@/lib/heat'
import { formatNumber } from '@/lib/format'

const VOXEL_SIZES = [0.025, 0.05, 0.1] as const

type Projection = 'front' | 'top' | 'side'

interface Grid {
  cols: number
  rows: number
  cells: Map<string, number>
  max: number
}

/**
 * Sums the voxels onto one plane, in viewer space (the game's z is negated, so the picture is not mirrored):
 * front is x by y, top is x by z, side is z by y. Row 0 is the top of the picture.
 */
function project(data: HeatmapData, view: Projection): Grid {
  const [nx, ny, nz] = data.dims
  const cells = new Map<string, number>()
  for (const [i, j, k, ink] of data.cells) {
    const z = nz - 1 - k // viewer z grows towards the viewer, the game's z the other way
    const [col, row] = view === 'front' ? [i, ny - 1 - j] : view === 'top' ? [i, z] : [z, ny - 1 - j]
    const key = `${col},${row}`
    cells.set(key, (cells.get(key) ?? 0) + ink)
  }
  return {
    cols: view === 'side' ? nz : nx,
    rows: view === 'top' ? nz : ny,
    cells,
    max: Math.max(0, ...cells.values()),
  }
}

function ProjectionView({ data, view }: { data: HeatmapData; view: Projection }) {
  const { t } = useTranslation()
  const grid = useMemo(() => project(data, view), [data, view])
  const cell = 10
  return (
    <figure className="min-w-0 flex-1">
      <svg
        viewBox={`0 0 ${Math.max(1, grid.cols) * cell} ${Math.max(1, grid.rows) * cell}`}
        className="max-h-56 w-full rounded bg-slate-50 ring-1 ring-slate-200"
        role="img"
        aria-label={t('heatmap.projectionLabel', { view: t(`heatmap.views.${view}`) })}
      >
        {[...grid.cells.entries()].map(([key, ink]) => {
          const [col, row] = key.split(',').map(Number)
          return (
            <rect key={key} x={col * cell} y={row * cell} width={cell} height={cell} fill={heatColor(ink / (grid.max || 1))}>
              <title>{`${formatNumber(ink * 100, 1)} cm`}</title>
            </rect>
          )
        })}
      </svg>
      <figcaption className="mt-1 text-center text-xs text-slate-500">{t(`heatmap.views.${view}`)}</figcaption>
    </figure>
  )
}

/** The ink density of the drawing, as top, front and side projections (requirement DRW-06). */
export function HeatmapPanel({ drawingId, voxelSize, onVoxelSizeChange }: {
  drawingId: string
  voxelSize: number
  onVoxelSizeChange: (size: number) => void
}) {
  const { t } = useTranslation()
  const query = useHeatmap(drawingId, voxelSize)

  return (
    <Card
      title={t('heatmap.title')}
      subtitle={t('heatmap.subtitle')}
      actions={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          {t('heatmap.voxel')}
          <select className="rounded-md border border-slate-300 bg-white px-2 py-1" value={voxelSize} onChange={(e) => onVoxelSizeChange(Number(e.target.value))}>
            {VOXEL_SIZES.map((size) => <option key={size} value={size}>{formatNumber(size * 100, 1)} cm</option>)}
          </select>
        </label>
      }
    >
      <QueryBoundary query={query}>
        {(data) =>
          data.cells.length === 0 ? (
            <p className="text-sm text-slate-500">{t('heatmap.empty')}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                {(['front', 'top', 'side'] as const).map((view) => <ProjectionView key={view} data={data} view={view} />)}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-2">
                  0
                  <span className="inline-block h-3 w-32 rounded" style={{ background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(heatColor).join(', ')})` }} aria-hidden="true" />
                  {t('heatmap.maxInk', { value: formatNumber(data.maxWeight * 100, 1) })}
                </span>
                <span>{t('heatmap.summary', { ink: formatNumber(data.totalInk, 2), cells: data.cells.length, voxel: formatNumber(data.voxelSize * 100, 1) })}</span>
              </div>
              <p className="text-xs text-slate-500">{t('heatmap.layerHint')}</p>
            </div>
          )
        }
      </QueryBoundary>
    </Card>
  )
}
