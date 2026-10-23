import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useDrawing, useDrawingMeta, usePlayerInfos, useSession } from '@/api/hooks'
import { Role, type Drawing } from '@/api/types'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlannedPanel } from '@/components/ui/PlannedPanel'
import { QueryBoundary } from '@/components/ui/states'
import { useAuth } from '@/auth/authContext'
import { ReportButton } from '@/features/reports/ReportButton'
import { displayName, formatDateTime, shortId } from '@/lib/format'
import { gameTypeLabel } from '@/lib/gameTypes'
import { toViewerStrokes } from '@/lib/strokes'
import { AnalysisPanel } from './AnalysisPanel'
import { DrawingViewer } from './DrawingViewer'

/**
 * One drawing: the 3D viewer, the drawing info and, for psychologists, the analysis (requirements DRW-01..04).
 * Players see their own drawing in the viewer, without metrics or reports (requirement ACC-02).
 */
export function DrawingPage() {
  const { drawingId } = useParams()
  const { user } = useAuth()
  const isPsychologist = user?.role === Role.Psychologist
  // A player uses the owner-scoped endpoint, which only answers for their own drawings.
  const drawing = useDrawing(drawingId, isPsychologist ? undefined : user?.playerId)

  return (
    <QueryBoundary query={drawing}>
      {(data) => <DrawingContent drawing={data} isPsychologist={isPsychologist} />}
    </QueryBoundary>
  )
}

function DrawingContent({ drawing, isPsychologist }: { drawing: Drawing; isPsychologist: boolean }) {
  const { t } = useTranslation()
  const { metadata } = drawing

  const strokes = useMemo(() => toViewerStrokes(drawing), [drawing])
  const authorIds = useMemo(() => [...new Set([metadata.owner, ...strokes.map((s) => s.authorId)])], [metadata.owner, strokes])
  const infos = usePlayerInfos(authorIds)
  const session = useSession(metadata.sessionID)
  const meta = useDrawingMeta(metadata.id)

  const authorNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const id of authorIds) {
      names[id] = displayName(infos.data?.get(id), id)
    }
    return names
  }, [authorIds, infos.data])

  const drawn = strokes.filter((s) => !s.erased).length
  const rows: [string, string][] = [
    [t('drawing.participant'), authorNames[metadata.owner] ?? `#${shortId(metadata.owner)}`],
    [t('drawing.gameType'), gameTypeLabel(t, metadata.gameType)],
    [t('drawing.date'), formatDateTime(metadata.date)],
    [t('drawing.strokes'), t('drawing.strokesValue', { drawn, erased: strokes.length - drawn })],
    [t('drawing.schema'), metadata.schemaVersion != null ? String(metadata.schemaVersion) : t('drawing.legacy')],
    [t('drawing.appVersion'), metadata.appVersion ?? t('common.none')],
    [t('drawing.device'), metadata.device ?? t('common.none')],
  ]
  if ((metadata.trackingDecimation ?? 1) > 1) {
    rows.push([t('drawing.tracking'), t('drawing.trackingThinned', { n: metadata.trackingDecimation })])
  }
  const collaborators = (metadata.collaborators ?? []).map((c) => c.id)

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
            {meta.data?.name ?? t('drawing.untitled')}
            <Badge tone="indigo">{gameTypeLabel(t, metadata.gameType)}</Badge>
            {collaborators.length > 0 && <Badge tone="sky">{t('drawing.multiplayer', { count: authorIds.length })}</Badge>}
          </span>
        }
        actions={isPsychologist ? <ReportButton kind="drawing" targetId={metadata.id} /> : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <DrawingViewer strokes={strokes} authorNames={authorNames} />
          {isPsychologist && <PlannedPanel ids={['DRW-05', 'DRW-06', 'DRW-07', 'DRW-08', 'DRW-09']} />}
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
          {isPsychologist && <AnalysisPanel drawingId={metadata.id} />}
        </div>
      </div>
    </>
  )
}
