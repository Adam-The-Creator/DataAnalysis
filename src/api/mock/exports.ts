import type { CsvDialect, Drawing, ExportFormat } from '@/api/types'
import { srgbToLinear } from '@/lib/colors'
import { metricCatalog } from '@/lib/metricCatalog'

/**
 * STAND-IN for the exporters of the DatabaseServer (analysis/exports.py): the CSV of a session and the strokes of a
 * drawing as glTF, OBJ or PLY. Same files, same conventions: z negated for a right-handed system, strokes as lines.
 */

export const CSV_BASE_COLUMNS = [
  'drawingId', 'drawingName', 'sessionId', 'sessionName', 'gameType', 'date',
  'participantId', 'participantName', 'age', 'gender', 'dominantHand',
] as const

type Cell = string | number | null | undefined

function cell(value: Cell, dialect: CsvDialect): string {
  if (value == null) return ''
  if (typeof value === 'number' && !Number.isInteger(value)) {
    const text = value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
    return dialect === 'excel' ? text.replace('.', ',') : text
  }
  const text = String(value)
  const separator = dialect === 'excel' ? ';' : ','
  return /["\r\n]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text
}

/** "r": comma and decimal point, UTF-8. "excel": semicolon, decimal comma and a byte order mark. */
export function sessionCsv(rows: Record<string, Cell>[], dialect: CsvDialect): Blob {
  const columns = [...CSV_BASE_COLUMNS, ...metricCatalog.map((m) => m.id)]
  const separator = dialect === 'excel' ? ';' : ','
  const lines = [columns.join(separator), ...rows.map((row) => columns.map((c) => cell(row[c], dialect)).join(separator))]
  const text = lines.join('\r\n') + '\r\n'
  return new Blob([dialect === 'excel' ? '﻿' + text : text], { type: 'text/csv;charset=utf-8' })
}

interface ExportStroke {
  positions: [number, number, number][]
  colors: [number, number, number][]
}

function strokesOf(drawing: Drawing, includeErased: boolean): ExportStroke[] {
  return drawing.lines
    .filter((l) => l.points.length >= 2 && (includeErased || l.status === 1))
    .map((line) => {
      const last = line.points.length - 1
      return {
        positions: line.points.map((p): [number, number, number] => [p.x, p.y, -p.z]),
        colors: line.points.map((_, i): [number, number, number] => {
          const f = i / last
          const mix = (a: number, b: number) => (a + f * (b - a)) / 255
          return [mix(line.startColor.r, line.endColor.r), mix(line.startColor.g, line.endColor.g), mix(line.startColor.b, line.endColor.b)]
        }),
      }
    })
}

function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(text)
}

function gltf(drawing: Drawing, includeErased: boolean): Blob {
  const chunks: Float32Array[] = []
  const bufferViews: object[] = []
  const accessors: object[] = []
  const primitives: object[] = []
  let offset = 0

  const attribute = (values: [number, number, number][], bounds: boolean): number => {
    const data = new Float32Array(values.flat())
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.byteLength, target: 34962 })
    offset += data.byteLength
    chunks.push(data)
    const accessor: Record<string, unknown> = { bufferView: bufferViews.length - 1, componentType: 5126, count: values.length, type: 'VEC3' }
    if (bounds) {
      accessor.min = [0, 1, 2].map((a) => Math.min(...values.map((v) => v[a])))
      accessor.max = [0, 1, 2].map((a) => Math.max(...values.map((v) => v[a])))
    }
    accessors.push(accessor)
    return accessors.length - 1
  }

  for (const stroke of strokesOf(drawing, includeErased)) {
    const linear = stroke.colors.map((c): [number, number, number] => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])])
    primitives.push({ attributes: { POSITION: attribute(stroke.positions, true), COLOR_0: attribute(linear, false) }, mode: 3, material: 0 })
  }

  const id = drawing.metadata.id
  const file: Record<string, unknown> = {
    asset: { version: '2.0', generator: 'VR Drawing 3D analysis (demo)' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: primitives.length ? [{ mesh: 0, name: id }] : [{ name: id }],
    meshes: primitives.length ? [{ name: 'strokes', primitives }] : [],
    materials: [{ name: 'stroke', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0 } }],
    extras: { drawingId: id, note: "Strokes as line strips with vertex colours. The width is not exported. Right-handed, Y up: the game's z axis is negated." },
  }
  if (primitives.length) {
    const bytes = new Uint8Array(offset)
    let at = 0
    for (const chunk of chunks) {
      bytes.set(new Uint8Array(chunk.buffer), at)
      at += chunk.byteLength
    }
    file.buffers = [{ byteLength: offset, uri: `data:application/octet-stream;base64,${toBase64(bytes)}` }]
    file.bufferViews = bufferViews
    file.accessors = accessors
  }
  return new Blob([JSON.stringify(file)], { type: 'model/gltf+json' })
}

function obj(drawing: Drawing, includeErased: boolean): Blob {
  const out = ['# VR Drawing 3D: strokes as polylines, width not exported, z negated (right-handed, Y up)']
  let index = 1
  strokesOf(drawing, includeErased).forEach((stroke, n) => {
    out.push(`o stroke_${n + 1}`)
    stroke.positions.forEach(([x, y, z], i) => {
      const [r, g, b] = stroke.colors[i]
      out.push(`v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)} ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`)
    })
    out.push('l ' + stroke.positions.map((_, i) => index + i).join(' '))
    index += stroke.positions.length
  })
  return new Blob([out.join('\n') + '\n'], { type: 'text/plain' })
}

function ply(drawing: Drawing, includeErased: boolean): Blob {
  const vertices: string[] = []
  const edges: string[] = []
  for (const stroke of strokesOf(drawing, includeErased)) {
    const first = vertices.length
    stroke.positions.forEach(([x, y, z], i) => {
      const [r, g, b] = stroke.colors[i].map((c) => Math.round(c * 255))
      vertices.push(`${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)} ${r} ${g} ${b}`)
    })
    for (let i = 0; i < stroke.positions.length - 1; i++) edges.push(`${first + i} ${first + i + 1}`)
  }
  const header = [
    'ply', 'format ascii 1.0', 'comment VR Drawing 3D: strokes as edges, width not exported, z negated',
    `element vertex ${vertices.length}`, 'property float x', 'property float y', 'property float z',
    'property uchar red', 'property uchar green', 'property uchar blue',
    `element edge ${edges.length}`, 'property int vertex1', 'property int vertex2', 'end_header',
  ]
  return new Blob([[...header, ...vertices, ...edges].join('\n') + '\n'], { type: 'text/plain' })
}

export function exportDrawingFile(drawing: Drawing, format: ExportFormat, includeErased: boolean): Blob {
  return { gltf, obj, ply }[format](drawing, includeErased)
}
