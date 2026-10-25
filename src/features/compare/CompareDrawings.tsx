import { useMemo, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { useDrawingAnalysis, useGeometry, usePlayerInfos } from '@/api/hooks'
import type { RecentDrawing } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { EmptyState, QueryBoundary } from '@/components/ui/states'
import { DETAIL_LEVELS, type DetailLevel } from '@/features/drawings/viewer/detail'
import { DrawingViewer } from '@/features/drawings/viewer/DrawingViewer'
import { createCameraSync, type CameraSync } from '@/features/drawings/viewer/cameraSync'
import { useReplay } from '@/features/drawings/viewer/useReplay'
import { displayName } from '@/lib/format'
import { DrawingPicker } from './DrawingPicker'
import { MetricDifferenceTable } from './MetricDifferenceTable'

function OneViewer({ drawingId, title, sync }: { drawingId: string; title: string; sync?: CameraSync }) {
  const [detail, setDetail] = useState<DetailLevel>('medium')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const geometry = useGeometry(drawingId, DETAIL_LEVELS[detail])

  return (
    <QueryBoundary query={geometry}>
      {(data) => <ViewerWithNames drawingId={drawingId} title={title} sync={sync} geometry={data} detail={detail} onDetailChange={setDetail} selectedId={selectedId} onSelect={setSelectedId} />}
    </QueryBoundary>
  )
}

function ViewerWithNames(props: Omit<ComponentProps<typeof DrawingViewer>, 'authorNames' | 'replay' | 'voxelSize' | 'analysisLayers'>) {
  const replay = useReplay(0, false) // no replay in the comparison, only the strokes
  const authorIds = useMemo(() => [...new Set(props.geometry.strokes.map((s) => s.authorId))], [props.geometry.strokes])
  const infos = usePlayerInfos(authorIds)
  const names = useMemo(() => Object.fromEntries(authorIds.map((id) => [id, displayName(infos.data?.get(id), id)])), [authorIds, infos.data])
  return <DrawingViewer {...props} authorNames={names} replay={replay} voxelSize={0.05} analysisLayers={false} compact />
}

/** Two drawings side by side with synchronised cameras and a table of the differences (requirement CMP-01). */
export function CompareDrawings({ items, a, b, onChange }: {
  items: RecentDrawing[]
  a: string | undefined
  b: string | undefined
  onChange: (a: string | undefined, b: string | undefined) => void
}) {
  const { t } = useTranslation()
  const [syncCameras, setSyncCameras] = useState(true)
  const sync = useMemo(() => createCameraSync(), [])
  const analysisA = useDrawingAnalysis(a)
  const analysisB = useDrawingAnalysis(b)
  const nameOf = (id: string | undefined) => items.find((i) => i.meta.id === id)?.meta.name ?? '-'

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <DrawingPicker label={t('compare.drawingA')} value={a} items={items} onChange={(id) => onChange(id, b)} />
          <DrawingPicker label={t('compare.drawingB')} value={b} items={items} onChange={(id) => onChange(a, id)} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={syncCameras} onChange={(e) => setSyncCameras(e.target.checked)} />
          {t('compare.syncCameras')}
        </label>
      </Card>

      {a && b ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <OneViewer key={a} drawingId={a} title={nameOf(a)} sync={syncCameras ? sync : undefined} />
            <OneViewer key={b} drawingId={b} title={nameOf(b)} sync={syncCameras ? sync : undefined} />
          </div>
          <Card title={t('compare.differences')} subtitle={t('compare.differencesHint')}>
            {analysisA.isPending || analysisB.isPending ? (
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            ) : analysisA.isError || analysisB.isError ? (
              <QueryBoundary query={analysisA.isError ? analysisA : analysisB}>{() => null}</QueryBoundary>
            ) : (
              <MetricDifferenceTable
                a={Object.fromEntries(analysisA.data!.metrics.map((m) => [m.id, m.value]))}
                b={Object.fromEntries(analysisB.data!.metrics.map((m) => [m.id, m.value]))}
                labelA={nameOf(a)}
                labelB={nameOf(b)}
              />
            )}
          </Card>
        </>
      ) : (
        <Card><EmptyState title={t('compare.pickTwo')} /></Card>
      )}
    </div>
  )
}
