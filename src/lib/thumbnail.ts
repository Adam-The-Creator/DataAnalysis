import { strokesBounds, type ViewerStroke } from './strokes'

export type SnapshotView = 'front' | 'top' | 'side'

interface SnapshotOptions {
  width?: number
  height?: number
  background?: string
}

/**
 * A static SVG snapshot of a drawing from one side (erased strokes are left out). It is used for the gallery
 * thumbnails and for the static snapshots in the generated reports (requirements SES-02, PLY-01, REP-02).
 */
export function drawingSvg(strokes: ViewerStroke[], view: SnapshotView, options: SnapshotOptions = {}): string {
  const { width = 240, height = 180, background = '#f1f5f9' } = options
  const drawn = strokes.filter((s) => !s.erased)
  const bounds = strokesBounds(drawn)

  // Screen axes per view (viewer space: x right, y up, z towards the viewer).
  const [ax, ay, flipY]: [number, number, boolean] =
    view === 'front' ? [0, 1, true] : view === 'top' ? [0, 2, false] : [2, 1, true]

  const pad = 12
  const spanX = Math.max(bounds.max[ax] - bounds.min[ax], 0.05)
  const spanY = Math.max(bounds.max[ay] - bounds.min[ay], 0.05)
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  const toX = (v: number) => offsetX + (v - bounds.min[ax]) * scale
  const toY = (v: number) =>
    flipY ? offsetY + (bounds.max[ay] - v) * scale : offsetY + (v - bounds.min[ay]) * scale

  const paths = drawn
    .map((stroke) => {
      const points: string[] = []
      for (let i = 0; i < stroke.positions.length; i += 3) {
        points.push(`${toX(stroke.positions[i + ax]).toFixed(1)},${toY(stroke.positions[i + ay]).toFixed(1)}`)
      }
      const strokeWidth = Math.min(4, Math.max(1.2, stroke.width * scale))
      return `<polyline points="${points.join(' ')}" fill="none" stroke="${stroke.startHex}" ` +
        `stroke-width="${strokeWidth.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${background}"/>${paths}</svg>`
  )
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
