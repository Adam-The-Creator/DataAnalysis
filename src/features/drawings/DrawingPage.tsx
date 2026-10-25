import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useDrawingMeta, useGeometry, usePlayerInfos, useSession } from '@/api/hooks'
import { Role, type DrawingGeometry } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { QueryBoundary } from '@/components/ui/states'
import { useAuth } from '@/auth/authContext'
import { AiDrawingPanel } from '@/features/ai/AiDrawingPanel'
import { DrawingExportMenu } from '@/features/export/DrawingExportMenu'
import { ReportButton } from '@/features/reports/ReportButton'
import { displayName, formatDateTime, shortId } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'
import { AnalysisPanel } from './AnalysisPanel'
import { HeatmapPanel } from './panels/HeatmapPanel'
import { MultiplayerPanel } from './panels/MultiplayerPanel'
import { PlacedModelsPanel } from './panels/PlacedModelsPanel'
import { TimelinePanel } from './panels/TimelinePanel'
import { TrackingPanel } from './panels/TrackingPanel'
import { DETAIL_LEVELS, type DetailLevel } from './viewer/detail'
import { DrawingViewer } from './viewer/DrawingViewer'
import { useReplay } from './viewer/useReplay'

/**
 * One drawing: the 3D viewer with its replay, and for psychologists the analysis (requirements DRW-01..09, MUL-01..03).
 * Players see their own drawing in the viewer, without the analysis and the reports (requirement ACC-02).
 */
export function DrawingPage() {
  const { drawingId } = useParams()
  const { user } = useAuth()
  const isPsychologist = user?.role === Role.Psychologist
  const [detail, setDetail] = useState<DetailLevel>('medium')
  const geometry = useGeometry(drawingId, DETAIL_LEVELS[detail])

  return (
    <QueryBoundary query={geometry}>
      {(data) => (
        <DrawingContent
          key={drawingId}
          drawingId={drawingId!}
          geometry={data}
          detail={detail}
          onDetailChange={setDetail}
          isPsychologist={isPsychologist}
        />
      )}
    </QueryBoundary>
  )
}

function DrawingContent({ drawingId, geometry, detail, onDetailChange, isPsychologist }: {
  drawingId: string
  geometry: DrawingGeometry
  detail: DetailLevel
  onDetailChange: (detail: DetailLevel) => void
  isPsychologist: boolean
}) {
  const { t } = useTranslation()
  const { metadata } = geometry
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightIds, setHighlightIds] = useState<string[]>([]) // the strokes of an AI stroke group
  const [voxelSize, setVoxelSize] = useState(0.05)

  const hasTimes = geometry.strokes.some((s) => s.points.length > 1 && s.points[0][3] != null)
  const replay = useReplay(geometry.durationMs, hasTimes)

  const authorIds = useMemo(() => [...new Set([metadata.owner, ...geometry.strokes.map((s) => s.authorId)])], [metadata.owner, geometry.strokes])
  const infos = usePlayerInfos(authorIds)
  const session = useSession(metadata.sessionID)
  const meta = useDrawingMeta(drawingId)

  const authorNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const id of authorIds) names[id] = displayName(infos.data?.get(id), id)
    return names
  }, [authorIds, infos.data])

  const drawn = geometry.strokes.filter((s) => !s.erased).length
  const multiAuthor = new Set(geometry.strokes.map((s) => s.authorId)).size > 1
  const rows: [string, string][] = [
    [t('drawing.participant'), authorNames[metadata.owner] ?? `#${shortId(metadata.owner)}`],
    [t('drawing.gameType'), gameTypeLabel(t, metadata.gameType)],
    [t('drawing.date'), formatDateTime(metadata.date)],
    [t('drawing.strokes'), t('drawing.strokesValue', { drawn, erased: geometry.strokes.length - drawn })],
    [t('drawing.schema'), metadata.schemaVersion != null ? String(metadata.schemaVersion) : t('drawing.legacy')],
    [t('drawing.appVersion'), metadata.appVersion ?? t('common.none')],
    [t('drawing.device'), metadata.device ?? t('common.none')],
  ]
  if ((metadata.trackingDecimation ?? 1) > 1) {
    rows.push([t('drawing.tracking'), t('drawing.trackingThinned', { n: metadata.trackingDecimation })])
  }
  if (geometry.breaks.length > 0) {
    rows.push([t('drawing.sittings'), t('drawing.sittingsValue', { count: geometry.breaks.length + 1 })])
  }
  const name = meta.data?.name ?? t('drawing.untitled')

  return (
    <>
      <PageHeader
        breadcrumb={
          isPsychologist
            ? <Link to={`/sessions/${metadata.sessionID}`} className="hover:text-indigo-700">← {session.data?.name ?? t('nav.sessions')}</Link>
            : <Link to="/my" className="hover:text-indigo-700">← {t('nav.myRecords')}</Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            <Badge tone="indigo">{gameTypeLabel(t, metadata.gameType)}</Badge>
            {multiAuthor && <Badge tone="sky">{t('drawing.multiplayer', { count: authorIds.length })}</Badge>}
          </span>
        }
        actions={
          isPsychologist ? (
            <>
              <Link to={`/compare?mode=drawings&a=${drawingId}`} className={buttonClass('secondary')}>{t('drawing.compare')}</Link>
              <DrawingExportMenu drawingId={drawingId} name={name} />
              <ReportButton kind="drawing" targetId={drawingId} />
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <DrawingViewer
            drawingId={drawingId}
            geometry={geometry}
            authorNames={authorNames}
            detail={detail}
            onDetailChange={onDetailChange}
            selectedId={selectedId}
            onSelect={setSelectedId}
            highlightIds={highlightIds}
            replay={replay}
            voxelSize={voxelSize}
            analysisLayers={isPsychologist}
          />
          {isPsychologist && (
            <>
              <AiDrawingPanel drawingId={drawingId} onHighlight={setHighlightIds} />
              <TimelinePanel drawingId={drawingId} authorNames={authorNames} selectedId={selectedId} onSelect={setSelectedId} replay={replay} />
              {multiAuthor && <MultiplayerPanel drawingId={drawingId} authorNames={authorNames} />}
              <TrackingPanel drawingId={drawingId} authorNames={authorNames} />
              <HeatmapPanel drawingId={drawingId} voxelSize={voxelSize} onVoxelSizeChange={setVoxelSize} />
            </>
          )}
          {geometry.placedModels.length > 0 && <PlacedModelsPanel models={geometry.placedModels} />}
        </div>

        <div className="space-y-6">
          <Card title={t('drawing.info')}>
            <dl className="divide-y divide-slate-100 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {isPsychologist && <AnalysisPanel drawingId={drawingId} />}
        </div>
      </div>
    </>
  )
}
