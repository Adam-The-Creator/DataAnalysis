/**
 * The colour scale of the heatmaps: dark purple to yellow (the "viridis" ramp), which stays readable with the common
 * kinds of colour blindness and in greyscale. The value is always shown as a number as well.
 */
const stops: [number, number, number][] = [
  [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
]

/**
 * The centre of a voxel in viewer space. The server gives voxels in game coordinates, and the viewer negates the
 * game's z (like it does for the strokes), so the voxels lie exactly where the ink is.
 */
export function voxelCenter(
  grid: { origin: readonly [number, number, number]; voxelSize: number },
  cell: readonly number[],
): [number, number, number] {
  const [ox, oy, oz] = grid.origin
  const v = grid.voxelSize
  return [ox + (cell[0] + 0.5) * v, oy + (cell[1] + 0.5) * v, -(oz + (cell[2] + 0.5) * v)]
}

/** t from 0 (no ink) to 1 (the densest voxel) as "#rrggbb". */
export function heatColor(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const f = x - i
  const channel = (c: number) => Math.round(stops[i][c] + f * (stops[i + 1][c] - stops[i][c])).toString(16).padStart(2, '0')
  return `#${channel(0)}${channel(1)}${channel(2)}`
}
