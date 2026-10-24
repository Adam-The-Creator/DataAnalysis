import { Canvas } from '@react-three/fiber'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHeatmap, useTracking } from '@/api/hooks'
import type { DrawingGeometry } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ErrorView } from '@/components/ui/states'
import { authorColor, hexToLinear } from '@/lib/authorColors'
import { cn } from '@/lib/cn'
import { downloadBlob } from '@/lib/download'
import { formatNumber } from '@/lib/format'
import { canReplay, strokesBounds, toViewerStrokes, type ViewerStroke } from '@/lib/strokes'
import type { CameraSync } from './cameraSync'
import { DETAIL_LEVELS, type DetailLevel } from './detail'
import { ReplayBar } from './ReplayBar'
import type { Replay } from './useReplay'
import {
  CameraRig, FigureMarker, HeatmapLayer, ModelsLayer, SnapshotBridge, StrokeLine, TrackingLayer,
  type ViewPreset, type ViewRequest,
} from './ViewerScene'

/**
 * 3D viewer of a drawing (requirements DRW-01..03, DRW-05, DRW-06, DRW-08, DRW-09): orbit, pan and zoom, preset views,
 * strokes with their colour gradient and width, filters, colour by author, a detail level, the replay, and layers for
 * the heatmap, the tracked movement, the placed models and the figure.
 */

interface Layers {
  heatmap: boolean
  tracking: boolean
  models: boolean
  figure: boolean
}

export interface DrawingViewerProps {
  drawingId: string
  geometry: DrawingGeometry
  authorNames: Record<string, string>
  detail: DetailLevel
  onDetailChange: (detail: DetailLevel) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  replay: Replay
  voxelSize: number
  /** Psychologists only: the heatmap and the tracking come from the analysis endpoints. */
  analysisLayers: boolean
  /** Keeps this viewer's camera together with other viewers (the comparison). */
  sync?: CameraSync
  /** A smaller viewer without the stroke list (the comparison). */
  compact?: boolean
  title?: string
}

function Scene(props: {
  strokes: ViewerStroke[]
  bounds: ReturnType<typeof strokesBounds>
  selectedId: string | null
  thickness: number
  dark: boolean
  view: ViewRequest
  time: number | null
  showStrokes: boolean
  geometry: DrawingGeometry
  layers: Layers
  heatmap: ReturnType<typeof useHeatmap>['data']
  tracking: ReturnType<typeof useTracking>['data']
  sync?: CameraSync
  onSelect: (id: string | null) => void
  registerSnapshot: (take: (() => Promise<Blob | null>) | null) => void
}) {
  const { bounds, dark, geometry, layers } = props
  const gridSize = Math.max(1, Math.ceil(bounds.size * 2))
  const floor = bounds.min[1] - 0.02
  const figure = geometry.metadata.sadChildCoordinates
  return (
    <>
      <color attach="background" args={[dark ? '#0f172a' : '#f1f5f9']} />
      <gridHelper
        args={[gridSize, gridSize * 5, dark ? '#475569' : '#94a3b8', dark ? '#1e293b' : '#cbd5e1']}
        position={[bounds.center[0], floor, bounds.center[2]]}
      />
      <axesHelper args={[0.2]} position={[bounds.min[0], floor, bounds.min[2]]} />
      {props.showStrokes && props.strokes.map((stroke) => (
        <StrokeLine
          key={stroke.id}
          stroke={stroke}
          thickness={props.thickness}
          selected={stroke.id === props.selectedId}
          time={props.time}
          onSelect={props.onSelect}
        />
      ))}
      {layers.heatmap && props.heatmap && <HeatmapLayer data={props.heatmap} />}
      {layers.tracking && props.tracking?.available && <TrackingLayer players={props.tracking.players} time={props.time} />}
      {layers.models && <ModelsLayer models={geometry.placedModels} />}
      {layers.figure && figure && <FigureMarker figure={figure} />}
      <CameraRig bounds={bounds} view={props.view} sync={props.sync} />
      <SnapshotBridge register={props.registerSnapshot} />
    </>
  )
}

export function DrawingViewer({
  drawingId, geometry, authorNames, detail, onDetailChange, selectedId, onSelect, replay, voxelSize, analysisLayers,
  sync, compact = false, title,
}: DrawingViewerProps) {
  const { t } = useTranslation()
  const baseStrokes = useMemo(() => toViewerStrokes(geometry), [geometry])
  const [hiddenAuthors, setHiddenAuthors] = useState<string[]>([])
  const [hand, setHand] = useState<'both' | 'left' | 'right'>('both')
  const [showErased, setShowErased] = useState(false)
  const [byAuthor, setByAuthor] = useState(false)
  const [thickness, setThickness] = useState(2)
  const [dark, setDark] = useState(false)
  const [view, setView] = useState<ViewRequest>({ preset: 'iso', nonce: 0 })
  const [layers, setLayers] = useState<Layers>({ heatmap: false, tracking: false, models: true, figure: true })
  const snapshot = useRef<(() => Promise<Blob | null>) | null>(null)
  const registerSnapshot = useCallback((take: (() => Promise<Blob | null>) | null) => { snapshot.current = take }, [])

  const authors = useMemo(() => [...new Set(baseStrokes.map((s) => s.authorId))], [baseStrokes])
  const nameOf = (id: string) => authorNames[id] ?? `#${id.slice(0, 8)}`
  const hasModels = geometry.placedModels.length > 0
  const hasFigure = !!geometry.metadata.sadChildCoordinates

  // Colour by author: one colour per author instead of the strokes' own colours
  const strokes = useMemo(() => {
    if (!byAuthor) return baseStrokes
    return baseStrokes.map((stroke) => {
      const [r, g, b] = hexToLinear(authorColor(authors.indexOf(stroke.authorId)))
      return { ...stroke, colors: stroke.times.flatMap(() => [r, g, b]) }
    })
  }, [baseStrokes, byAuthor, authors])

  // The camera frames the whole drawing, whatever the filters hide
  const bounds = useMemo(() => strokesBounds(baseStrokes), [baseStrokes])
  const erasedCount = strokes.filter((s) => s.erased).length
  const visible = useMemo(
    () => strokes.filter((s) => (showErased || !s.erased) && !hiddenAuthors.includes(s.authorId) && (hand === 'both' || s.hand === hand)),
    [strokes, showErased, hiddenAuthors, hand],
  )
  const selected = strokes.find((s) => s.id === selectedId) ?? null

  const heatmap = useHeatmap(drawingId, voxelSize, analysisLayers && layers.heatmap)
  const tracking = useTracking(drawingId, analysisLayers && layers.tracking)
  const time = replay.active ? replay.time : null

  async function takeSnapshot() {
    const blob = await snapshot.current?.()
    if (blob) downloadBlob(blob, `drawing-${drawingId}.png`)
  }

  const presets: ViewPreset[] = ['iso', 'front', 'top', 'side']
  const layerBox = (key: keyof Layers, label: string) => (
    <label key={key} className="flex items-center gap-1.5 text-slate-700">
      <input type="checkbox" checked={layers[key]} onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))} />
      {label}
    </label>
  )

  return (
    <Card
      title={title ?? t('viewer.title')}
      subtitle={t('viewer.shown', { shown: visible.length, total: strokes.length })}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {presets.map((preset) => (
            <Button key={preset} variant="secondary" className="px-2 py-1 text-xs" onClick={() => setView((v) => ({ preset, nonce: v.nonce + 1 }))}>
              {t(`viewer.views.${preset}`)}
            </Button>
          ))}
          <Button variant="secondary" className="px-2 py-1 text-xs" aria-pressed={dark} onClick={() => setDark((d) => !d)}>
            {t('viewer.background')}
          </Button>
          <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => void takeSnapshot()}>
            {t('viewer.snapshot')}
          </Button>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className={cn('relative overflow-hidden bg-slate-100', compact ? 'h-72' : 'h-[26rem] md:h-[34rem]')} role="img" aria-label={t('viewer.label')}>
        <ErrorBoundary fallback={<p className="p-6 text-sm text-slate-600">{t('viewer.unsupported')}</p>}>
          <Canvas
            frameloop="demand"
            camera={{ fov: 50, near: 0.01, far: 200, position: [1, 1, 2] }}
            gl={{ preserveDrawingBuffer: true }}
            // Strokes are thin, so a click may miss by a little and still select them.
            onCreated={({ raycaster }) => { raycaster.params.Line2 = { threshold: 0.02 } }}
            onPointerMissed={() => onSelect(null)}
          >
            <Scene
              strokes={visible} bounds={bounds} selectedId={selectedId} thickness={thickness} dark={dark} view={view}
              time={time} showStrokes geometry={geometry} layers={layers}
              heatmap={heatmap.data} tracking={tracking.data} sync={sync} onSelect={onSelect} registerSnapshot={registerSnapshot}
            />
          </Canvas>
        </ErrorBoundary>
        {strokes.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-slate-500">{t('viewer.noStrokes')}</p>
        )}
        <p className="pointer-events-none absolute bottom-2 left-3 rounded bg-white/80 px-2 py-1 text-xs text-slate-600">{t('viewer.hint')}</p>
        {selected && (
          <div className="absolute right-3 top-3 w-56 rounded-lg bg-white/95 p-3 text-xs shadow ring-1 ring-slate-200">
            <p className="font-medium text-slate-900">{t('viewer.selected')}</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-600">
              <dt>{t('viewer.stroke.author')}</dt><dd className="truncate text-slate-900">{nameOf(selected.authorId)}</dd>
              <dt>{t('viewer.stroke.hand')}</dt><dd className="text-slate-900">{t(`viewer.hands.${selected.hand}`)}</dd>
              <dt>{t('viewer.stroke.length')}</dt><dd className="text-slate-900">{formatNumber(selected.length, 2)} m</dd>
              <dt>{t('viewer.stroke.points')}</dt><dd className="text-slate-900">{selected.pointCount}</dd>
            </dl>
          </div>
        )}
      </div>

      {!compact && <ReplayBar replay={{ ...replay, available: replay.available && canReplay(baseStrokes) }} />}

      <div className="space-y-3 border-t border-slate-100 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-slate-700">
            {t('viewer.hand')}
            <select className="rounded-md border border-slate-300 bg-white px-2 py-1" value={hand} onChange={(e) => setHand(e.target.value as typeof hand)}>
              <option value="both">{t('viewer.hands.both')}</option>
              <option value="left">{t('viewer.hands.left')}</option>
              <option value="right">{t('viewer.hands.right')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            {t('viewer.thickness')}
            <input type="range" min={1} max={8} step={0.5} value={thickness} onChange={(e) => setThickness(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2 text-slate-700">
            {t('viewer.detail')}
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1"
              value={detail}
              onChange={(e) => onDetailChange(e.target.value as DetailLevel)}
            >
              {(Object.keys(DETAIL_LEVELS) as DetailLevel[]).map((level) => (
                <option key={level} value={level}>{t(`viewer.detailLevels.${level}`)}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">{t('viewer.points', { shown: geometry.pointCountReturned, total: geometry.pointCountOriginal })}</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-slate-700">{t('viewer.layers')}</span>
          <label className="flex items-center gap-1.5 text-slate-700">
            <input type="checkbox" checked={showErased} onChange={(e) => setShowErased(e.target.checked)} />
            {t('viewer.showErased', { count: erasedCount })}
          </label>
          {authors.length > 1 && (
            <label className="flex items-center gap-1.5 text-slate-700">
              <input type="checkbox" checked={byAuthor} onChange={(e) => setByAuthor(e.target.checked)} />
              {t('viewer.colourByAuthor')}
            </label>
          )}
          {analysisLayers && layerBox('heatmap', t('viewer.layerHeatmap'))}
          {analysisLayers && geometry.hasTracking && layerBox('tracking', t('viewer.layerTracking'))}
          {hasModels && layerBox('models', t('viewer.layerModels', { count: geometry.placedModels.length }))}
          {hasFigure && layerBox('figure', t('viewer.layerFigure'))}
        </div>
        {(heatmap.isError && layers.heatmap) && <ErrorView error={heatmap.error} />}
        {(tracking.isError && layers.tracking) && <ErrorView error={tracking.error} />}

        {authors.length > 1 && (
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <legend className="sr-only">{t('viewer.authors')}</legend>
            <span className="text-slate-700">{t('viewer.authors')}</span>
            {authors.map((author, index) => (
              <label key={author} className="flex items-center gap-1.5 text-slate-700">
                <input
                  type="checkbox"
                  checked={!hiddenAuthors.includes(author)}
                  onChange={(e) => setHiddenAuthors((hidden) => (e.target.checked ? hidden.filter((a) => a !== author) : [...hidden, author]))}
                />
                {byAuthor && <span className="h-2.5 w-2.5 rounded-full" style={{ background: authorColor(index) }} aria-hidden="true" />}
                {nameOf(author)}
              </label>
            ))}
          </fieldset>
        )}

        {!compact && (
          <details>
            <summary className="cursor-pointer text-slate-700">{t('viewer.strokeList', { count: strokes.length })}</summary>
            <div className="mt-2 max-h-60 overflow-auto rounded-lg ring-1 ring-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">{t('viewer.stroke.author')}</th>
                    <th className="px-2 py-1.5">{t('viewer.stroke.hand')}</th>
                    <th className="px-2 py-1.5">{t('viewer.stroke.points')}</th>
                    <th className="px-2 py-1.5">{t('viewer.stroke.length')}</th>
                    <th className="px-2 py-1.5">{t('viewer.stroke.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {strokes.map((stroke, index) => (
                    <tr
                      key={stroke.id}
                      onClick={() => onSelect(stroke.id)}
                      className={cn('cursor-pointer border-t border-slate-100 hover:bg-indigo-50', stroke.id === selectedId && 'bg-amber-50')}
                    >
                      <td className="px-2 py-1">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle ring-1 ring-slate-300" style={{ background: stroke.startHex }} aria-hidden="true" />
                        {index + 1}
                      </td>
                      <td className="px-2 py-1">{nameOf(stroke.authorId)}</td>
                      <td className="px-2 py-1">{t(`viewer.hands.${stroke.hand}`)}</td>
                      <td className="px-2 py-1 tabular-nums">{stroke.pointCount}</td>
                      <td className="px-2 py-1 tabular-nums">{formatNumber(stroke.length, 2)} m</td>
                      <td className="px-2 py-1">{stroke.erased ? t('viewer.erased') : t('viewer.drawn')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </Card>
  )
}
