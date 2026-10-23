import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { strokesBounds, type Bounds, type ViewerStroke } from '@/lib/strokes'

/**
 * 3D viewer of a drawing (requirements DRW-01, DRW-02): orbit, pan and zoom, preset views, strokes with their
 * colour gradient and width, filters by author and hand, erased strokes on demand, and stroke selection.
 */

type ViewPreset = 'iso' | 'front' | 'top' | 'side'
interface ViewRequest {
  preset: ViewPreset
  nonce: number // a new request for the same preset still moves the camera
}

const presetDirections: Record<ViewPreset, [number, number, number]> = {
  iso: [0.7, 0.5, 1],
  front: [0, 0, 1],
  top: [0, 1, 0.001],
  side: [1, 0, 0],
}

const HIGHLIGHT_COLOR = 0xf59e0b

function StrokeLine({ stroke, thickness, selected, onSelect }: {
  stroke: ViewerStroke
  thickness: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  const size = useThree((state) => state.size)

  const { line, highlight } = useMemo(() => {
    const geometry = new LineGeometry()
    geometry.setPositions(stroke.positions)
    geometry.setColors(stroke.colors)

    const width = Math.max(stroke.width, 0.002) * thickness
    const material = new LineMaterial({
      vertexColors: true,
      worldUnits: true,
      linewidth: width,
      transparent: stroke.erased,
      opacity: stroke.erased ? 0.3 : 1,
    })
    material.resolution.set(size.width, size.height)

    let highlightLine: Line2 | null = null
    if (selected) {
      const highlightMaterial = new LineMaterial({ color: HIGHLIGHT_COLOR, worldUnits: true, linewidth: width * 2.2 + 0.004 })
      highlightMaterial.resolution.set(size.width, size.height)
      highlightLine = new Line2(geometry, highlightMaterial)
      highlightLine.renderOrder = -1
    }
    return { line: new Line2(geometry, material), highlight: highlightLine }
  }, [stroke, thickness, selected, size])

  useEffect(
    () => () => {
      line.geometry.dispose()
      line.material.dispose()
      highlight?.material.dispose()
    },
    [line, highlight],
  )

  return (
    <group>
      {highlight && <primitive object={highlight} />}
      <primitive
        object={line}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          onSelect(stroke.id)
        }}
      />
    </group>
  )
}

/** Creates the orbit controls and moves the camera when a preset view is requested. */
function CameraRig({ bounds, view }: { bounds: Bounds; view: ViewRequest }) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const controls = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const instance = new OrbitControls(camera, gl.domElement)
    const redraw = () => invalidate() // the canvas only renders on demand
    instance.addEventListener('change', redraw)
    controls.current = instance
    return () => {
      instance.removeEventListener('change', redraw)
      instance.dispose()
      controls.current = null
    }
  }, [camera, gl, invalidate])

  useEffect(() => {
    const instance = controls.current
    if (!instance) return
    const [dx, dy, dz] = presetDirections[view.preset]
    const norm = Math.hypot(dx, dy, dz)
    const distance = bounds.size * 1.7 + 0.4
    camera.position.set(
      bounds.center[0] + (dx / norm) * distance,
      bounds.center[1] + (dy / norm) * distance,
      bounds.center[2] + (dz / norm) * distance,
    )
    instance.target.set(...bounds.center)
    instance.update()
    invalidate()
  }, [bounds, view, camera, invalidate])

  return null
}

function Scene({ strokes, bounds, selectedId, thickness, dark, view, onSelect }: {
  strokes: ViewerStroke[]
  bounds: Bounds
  selectedId: string | null
  thickness: number
  dark: boolean
  view: ViewRequest
  onSelect: (id: string) => void
}) {
  const gridSize = Math.max(1, Math.ceil(bounds.size * 2))
  const floor = bounds.min[1] - 0.02
  return (
    <>
      <color attach="background" args={[dark ? '#0f172a' : '#f1f5f9']} />
      <gridHelper
        args={[gridSize, gridSize * 5, dark ? '#475569' : '#94a3b8', dark ? '#1e293b' : '#cbd5e1']}
        position={[bounds.center[0], floor, bounds.center[2]]}
      />
      <axesHelper args={[0.2]} position={[bounds.min[0], floor, bounds.min[2]]} />
      {strokes.map((stroke) => (
        <StrokeLine key={stroke.id} stroke={stroke} thickness={thickness} selected={stroke.id === selectedId} onSelect={onSelect} />
      ))}
      <CameraRig bounds={bounds} view={view} />
    </>
  )
}

export function DrawingViewer({ strokes, authorNames }: { strokes: ViewerStroke[]; authorNames: Record<string, string> }) {
  const { t } = useTranslation()
  const [hiddenAuthors, setHiddenAuthors] = useState<string[]>([])
  const [hand, setHand] = useState<'both' | 'left' | 'right'>('both')
  const [showErased, setShowErased] = useState(false)
  const [thickness, setThickness] = useState(2)
  const [dark, setDark] = useState(false)
  const [view, setView] = useState<ViewRequest>({ preset: 'iso', nonce: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The camera frames the whole drawing, whatever the filters hide.
  const bounds = useMemo(() => strokesBounds(strokes), [strokes])
  const authors = useMemo(() => [...new Set(strokes.map((s) => s.authorId))], [strokes])
  const erasedCount = strokes.filter((s) => s.erased).length
  const visible = useMemo(
    () => strokes.filter((s) => (showErased || !s.erased) && !hiddenAuthors.includes(s.authorId) && (hand === 'both' || s.hand === hand)),
    [strokes, showErased, hiddenAuthors, hand],
  )
  const selected = strokes.find((s) => s.id === selectedId) ?? null
  const nameOf = (id: string) => authorNames[id] ?? `#${id.slice(0, 8)}`

  const presets: ViewPreset[] = ['iso', 'front', 'top', 'side']

  return (
    <Card
      title={t('viewer.title')}
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
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="relative h-[26rem] overflow-hidden rounded-b-xl bg-slate-100 md:h-[34rem]" role="img" aria-label={t('viewer.label')}>
        <ErrorBoundary fallback={<p className="p-6 text-sm text-slate-600">{t('viewer.unsupported')}</p>}>
          <Canvas
            frameloop="demand"
            camera={{ fov: 50, near: 0.01, far: 200, position: [1, 1, 2] }}
            // Strokes are thin, so a click may miss by a little and still select them.
            onCreated={({ raycaster }) => { raycaster.params.Line2 = { threshold: 0.02 } }}
            onPointerMissed={() => setSelectedId(null)}
          >
            <Scene strokes={visible} bounds={bounds} selectedId={selectedId} thickness={thickness} dark={dark} view={view} onSelect={setSelectedId} />
          </Canvas>
        </ErrorBoundary>
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
            <input type="checkbox" checked={showErased} onChange={(e) => setShowErased(e.target.checked)} />
            {t('viewer.showErased', { count: erasedCount })}
          </label>
        </div>

        {authors.length > 1 && (
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <legend className="sr-only">{t('viewer.authors')}</legend>
            <span className="text-slate-700">{t('viewer.authors')}</span>
            {authors.map((author) => (
              <label key={author} className="flex items-center gap-1.5 text-slate-700">
                <input
                  type="checkbox"
                  checked={!hiddenAuthors.includes(author)}
                  onChange={(e) => setHiddenAuthors((hidden) => (e.target.checked ? hidden.filter((a) => a !== author) : [...hidden, author]))}
                />
                {nameOf(author)}
              </label>
            ))}
          </fieldset>
        )}

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
                    onClick={() => setSelectedId(stroke.id)}
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
      </div>
    </Card>
  )
}
