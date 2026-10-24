import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Matrix4, type InstancedMesh } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { HeatmapData, PlacedModel, TrackedPlayer } from '@/api/types'
import { heatColor, voxelCenter } from '@/lib/heat'
import { replayLook, sliceStroke, type Bounds, type ViewerStroke } from '@/lib/strokes'
import { positionAt } from '@/lib/trackPath'
import type { CameraPose, CameraSync } from './cameraSync'

/** The three.js parts of the drawing viewer (requirements DRW-01, DRW-05, DRW-06, DRW-08, DRW-09). */

export type ViewPreset = 'iso' | 'front' | 'top' | 'side'
export interface ViewRequest {
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

// --- Strokes ---

export function StrokeLine({ stroke, thickness, selected, time, showErased, onSelect }: {
  stroke: ViewerStroke
  thickness: number
  selected: boolean
  /** Replay time in ms on the drawing's time axis, or null to show the whole stroke. */
  time: number | null
  /** Whether erased strokes are shown: after the replay erased one it stays as a dimmed ghost, otherwise it is gone. */
  showErased: boolean
  onSelect: (id: string) => void
}) {
  const size = useThree((state) => state.size)
  const look = replayLook(stroke, time, showErased)
  const part = look.visible ? look.part : null
  const ghost = look.visible && look.ghost
  // Only a stroke that is being drawn right now changes with the clock, a finished one keeps its geometry
  const partialTime = part === 'partial' ? time : null

  const built = useMemo(() => {
    const shown = part === 'whole' ? stroke : part === 'partial' && partialTime !== null ? sliceStroke(stroke, partialTime) : null
    if (!shown) return null

    const geometry = new LineGeometry()
    geometry.setPositions(shown.positions)
    geometry.setColors(shown.colors)

    const width = Math.max(stroke.width, 0.002) * thickness
    const material = new LineMaterial({
      vertexColors: true,
      worldUnits: true,
      linewidth: width,
      transparent: ghost,
      opacity: ghost ? 0.3 : 1,
    })
    material.resolution.set(size.width, size.height)

    let highlight: Line2 | null = null
    if (selected) {
      const highlightMaterial = new LineMaterial({ color: HIGHLIGHT_COLOR, worldUnits: true, linewidth: width * 2.2 + 0.004 })
      highlightMaterial.resolution.set(size.width, size.height)
      highlight = new Line2(geometry, highlightMaterial)
      highlight.renderOrder = -1
    }
    return { line: new Line2(geometry, material), highlight }
  }, [stroke, thickness, selected, size, part, ghost, partialTime])

  useEffect(
    () => () => {
      if (!built) return
      built.line.geometry.dispose()
      built.line.material.dispose()
      built.highlight?.material.dispose()
    },
    [built],
  )

  if (!built) return null
  return (
    <group>
      {built.highlight && <primitive object={built.highlight} />}
      <primitive
        object={built.line}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          onSelect(stroke.id)
        }}
      />
    </group>
  )
}

/** A plain coloured polyline, for the tracked paths. */
function PathLine({ positions, color, width, opacity }: { positions: number[]; color: string; width: number; opacity: number }) {
  const size = useThree((state) => state.size)
  const line = useMemo(() => {
    const geometry = new LineGeometry()
    geometry.setPositions(positions)
    const material = new LineMaterial({ color: new Color(color).getHex(), worldUnits: true, linewidth: width, transparent: true, opacity })
    material.resolution.set(size.width, size.height)
    return new Line2(geometry, material)
  }, [positions, color, width, opacity, size])
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose() }, [line])
  return <primitive object={line} />
}

// --- Heatmap (DRW-06) ---

export function HeatmapLayer({ data }: { data: HeatmapData }) {
  const mesh = useRef<InstancedMesh>(null)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    const instances = mesh.current
    if (!instances) return
    const matrix = new Matrix4()
    const color = new Color()
    data.cells.forEach((cell, n) => {
      const ink = cell[3]
      matrix.makeTranslation(...voxelCenter(data, cell))
      instances.setMatrixAt(n, matrix)
      instances.setColorAt(n, color.set(heatColor(ink / (data.maxWeight || 1))))
    })
    instances.instanceMatrix.needsUpdate = true
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true
    invalidate()
  }, [data, invalidate])

  if (data.cells.length === 0) return null
  const edge = data.voxelSize * 0.92
  return (
    // A different number of cells needs a new InstancedMesh
    <instancedMesh key={`${data.voxelSize}-${data.cells.length}`} ref={mesh} args={[undefined, undefined, data.cells.length]}>
      <boxGeometry args={[edge, edge, edge]} />
      <meshBasicMaterial transparent opacity={0.6} />
    </instancedMesh>
  )
}

// --- Tracking (DRW-08) ---

const TRACK_COLORS = { head: '#0072b2', rightHand: '#d55e00', leftHand: '#009e73' } as const

function Marker({ position, color, radius }: { position: [number, number, number]; color: string; radius: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 16, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

const CHANNELS = ['head', 'rightHand', 'leftHand'] as const

export function TrackingLayer({ players, time }: { players: TrackedPlayer[]; time: number | null }) {
  const flat = useMemo(
    () => players.map((p) => CHANNELS.map((c) => p.paths[c].flatMap((s) => [s[1] as number, s[2] as number, -(s[3] as number)]))),
    [players],
  )
  return (
    <>
      {players.map((player, pi) => (
        <group key={player.playerId}>
          {CHANNELS.map((channel, ci) =>
            flat[pi][ci].length >= 6 ? (
              <PathLine key={channel} positions={flat[pi][ci]} color={TRACK_COLORS[channel]} width={0.004} opacity={0.55} />
            ) : null,
          )}
          {time !== null && CHANNELS.map((channel) => {
            const position = positionAt(player.paths[channel], time)
            return position ? (
              <Marker key={channel} position={position} color={TRACK_COLORS[channel]} radius={channel === 'head' ? 0.07 : 0.035} />
            ) : null
          })}
        </group>
      ))}
    </>
  )
}

// --- Placed models and the figure (DRW-09) ---

export function ModelsLayer({ models }: { models: PlacedModel[] }) {
  return (
    <>
      {models.map((m, i) => {
        const scale: [number, number, number] = [Math.max(m.scaleX, 0.1), Math.max(m.scaleY, 0.1), Math.max(m.scaleZ, 0.1)]
        return (
          <mesh key={`${m.modelName}-${i}`} position={[m.positionX, m.positionY + scale[1] * 0.1, -m.positionZ]} scale={scale}>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            <meshBasicMaterial color="#0ea5e9" wireframe />
          </mesh>
        )
      })}
    </>
  )
}

export function FigureMarker({ figure }: { figure: { x: number; y: number; z: number } }) {
  return <Marker position={[figure.x, figure.y, -figure.z]} color="#c026d3" radius={0.08} />
}

// --- Camera ---

/** Creates the orbit controls, moves the camera for the preset views, and keeps it in step with other viewers. */
export function CameraRig({ bounds, view, sync }: { bounds: Bounds; view: ViewRequest; sync?: CameraSync }) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const controls = useRef<OrbitControls | null>(null)
  const applying = useRef(false)
  const id = useId()
  const fit = bounds.size * 1.7 + 0.4

  useEffect(() => {
    const instance = new OrbitControls(camera, gl.domElement)
    const changed = () => {
      invalidate() // the canvas only renders on demand
      if (sync && !applying.current) {
        const offset = camera.position.clone().sub(instance.target)
        const distance = offset.length() || 1
        sync.publish(id, { direction: [offset.x / distance, offset.y / distance, offset.z / distance], zoom: distance / fit })
      }
    }
    instance.addEventListener('change', changed)
    controls.current = instance
    return () => {
      instance.removeEventListener('change', changed)
      instance.dispose()
      controls.current = null
    }
  }, [camera, gl, invalidate, sync, id, fit])

  useEffect(() => {
    if (!sync) return
    return sync.subscribe((source: string, pose: CameraPose) => {
      const instance = controls.current
      if (source === id || !instance) return
      applying.current = true
      camera.position.set(
        instance.target.x + pose.direction[0] * pose.zoom * fit,
        instance.target.y + pose.direction[1] * pose.zoom * fit,
        instance.target.z + pose.direction[2] * pose.zoom * fit,
      )
      instance.update()
      applying.current = false
      invalidate()
    })
  }, [sync, id, camera, fit, invalidate])

  useEffect(() => {
    const instance = controls.current
    if (!instance) return
    const [dx, dy, dz] = presetDirections[view.preset]
    const norm = Math.hypot(dx, dy, dz)
    camera.position.set(
      bounds.center[0] + (dx / norm) * fit,
      bounds.center[1] + (dy / norm) * fit,
      bounds.center[2] + (dz / norm) * fit,
    )
    instance.target.set(...bounds.center)
    instance.update()
    invalidate()
  }, [bounds, view, camera, invalidate, fit])

  return null
}

/** Gives the page a function that renders the current view and returns it as a PNG (requirement EXP-04). */
export function SnapshotBridge({ register }: { register: (take: (() => Promise<Blob | null>) | null) => void }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    register(
      () => new Promise<Blob | null>((resolve) => {
        gl.render(scene, camera) // render right before the capture: the drawing buffer is cleared after a frame
        gl.domElement.toBlob(resolve, 'image/png')
      }),
    )
    return () => register(null)
  }, [gl, scene, camera, register])
  return null
}
