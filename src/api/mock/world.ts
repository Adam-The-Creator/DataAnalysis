import type {
  Collaborator, Drawing, DrawingMeta, Hand, Line, LineColor, PlacedModel, PlayerInfo, RoleValue, Session,
} from '@/api/types'
import { Role } from '@/api/types'
import { DEFAULT_SESSION_ID } from '@/lib/sessions'
import { buildEvents, buildTracking } from './behavior'
import {
  buildLines, createRng, flower, house, mirrorX, quickCircle, scribble, spiral, sun, tree, waves,
  type Shape, type Vec,
} from './generator'

/** The demo data set: a few players, sessions and drawings that cover the cases the app has to handle. */

export interface PlayerRecord {
  id: string
  username: string
  role: RoleValue
  info: PlayerInfo
}

export interface World {
  players: PlayerRecord[]
  sessions: Session[]
  drawings: Drawing[]
  metas: DrawingMeta[]
  activeSessionId: string
}

const rgb = (r: number, g: number, b: number): LineColor => ({ r, g, b, a: 1 })
const warm = [rgb(220, 60, 50), rgb(240, 150, 40), rgb(245, 210, 60), rgb(230, 100, 150)]
const cool = [rgb(50, 100, 220), rgb(40, 170, 170), rgb(130, 80, 190), rgb(90, 160, 230)]
const nature = [rgb(60, 160, 80), rgb(120, 80, 50), rgb(245, 210, 60), rgb(90, 190, 120)]
const dark = [rgb(30, 30, 30), rgb(90, 90, 100), rgb(160, 160, 170), rgb(120, 40, 50)]
const sea = [rgb(50, 100, 220), rgb(90, 160, 230), rgb(40, 170, 170), rgb(245, 210, 60)]

const playerData: [string, number, string, string][] = [
  ['John Doe', 9, 'Other', 'Right'],
  ['Jane Doe', 11, 'Male', 'Right'],
  ['Chloe Park', 14, 'Female', 'Left'],
  ['Shannon Lee', 16, 'Female', 'Right'],
  ['Elias Berg', 23, 'Male', 'Right'],
  ['Maria Garcia', 31, 'Female', 'Right'],
  ['Michael Brown', 45, 'Male', 'Left'],
  ['Hana Ito', 52, 'Female', 'Right'],
]

const playerId = (n: number) => `demo-player-${n}`
const sessionId = (n: number) => `demo-session-${n}`

interface Part {
  shape: Shape
  author?: string
  palette?: LineColor[]
  hands?: 'right' | 'left' | 'mixed'
  mirror?: boolean
  at?: Vec
  scale?: number
  /** Starts this long after the start of the drawing, while earlier parts may still be drawn (several authors). */
  startOffsetMs?: number
  /** A break before this part, like a drawing that is continued on another day. */
  pauseBeforeMs?: number
}

interface DrawingSpec {
  owner: string
  session: string
  gameType: number
  name: string
  date: string // "yyyy.MM.dd-HH:mm"
  palette: LineColor[]
  parts: Part[]
  speed?: number
  tremor?: number
  pressure?: number
  erase?: number
  legacy?: boolean
  decimation?: number
  collaborators?: string[]
  models?: PlacedModel[]
}

const model = (modelName: string, [x, y, z]: Vec, scale = 1): PlacedModel => ({
  modelName, positionX: x, positionY: y, positionZ: z,
  rotationX: 0, rotationY: 0, rotationZ: 0, rotationW: 1, scaleX: scale, scaleY: scale, scaleZ: scale,
})

const DAY = 24 * 3600 * 1000

const specs: DrawingSpec[] = [
  // Spring group, Inner child
  { owner: playerId(1), session: sessionId(1), gameType: 0, name: 'My garden', date: '2026.03.12-10:20', palette: warm, parts: [{ shape: flower }] },
  { owner: playerId(2), session: sessionId(1), gameType: 0, name: 'The old oak', date: '2026.03.12-10:25', palette: nature, parts: [{ shape: tree }], speed: 0.3 },
  { owner: playerId(3), session: sessionId(1), gameType: 0, name: 'Storm', date: '2026.03.12-10:31', palette: dark, parts: [{ shape: scribble, hands: 'mixed' }], speed: 0.7, tremor: 0.004, pressure: 0.55, erase: 0.3 },
  { owner: playerId(4), session: sessionId(1), gameType: 0, name: 'Home', date: '2026.03.12-10:38', palette: warm.slice(1).concat(cool.slice(0, 1)), parts: [{ shape: house }] },
  { owner: playerId(5), session: sessionId(1), gameType: 0, name: 'Morning', date: '2026.03.12-10:44', palette: warm, parts: [{ shape: sun, at: [0.35, 0.2, 0] }, { shape: flower, at: [-0.2, -0.05, 0] }] },
  // Word Forest workshop. 'Forest words' was continued three days later (a second sitting)
  {
    owner: playerId(1), session: sessionId(2), gameType: 1, name: 'Forest words', date: '2026.05.07-14:15', palette: nature,
    parts: [{ shape: tree }, { shape: tree, at: [0.5, -0.1, 0.15], pauseBeforeMs: 3 * DAY }],
  },
  {
    owner: playerId(6), session: sessionId(2), gameType: 1, name: 'Spiral path', date: '2026.05.07-14:40', palette: cool, speed: 0.25, pressure: 0.2,
    parts: [{ shape: spiral }, { shape: spiral, at: [0.4, 0.05, 0.1] }, { shape: spiral, at: [-0.4, -0.05, -0.1] }],
  },
  {
    owner: playerId(7), session: sessionId(2), gameType: 1, name: 'Branches (old save)', date: '2026.05.07-15:05', palette: nature, legacy: true,
    parts: [{ shape: tree, hands: 'left' }, { shape: scribble, hands: 'mixed' }],
  },
  // Beach relaxation (the active session)
  {
    owner: playerId(2), session: sessionId(3), gameType: 2, name: 'Calm sea', date: '2026.09.18-09:45', palette: sea, parts: [{ shape: waves }], speed: 0.25, pressure: 0.15,
    models: [model('Palm tree', [1.2, 0, -1.6], 1.4), model('Beach ball', [-0.8, 0.2, -1.1], 0.3)],
  },
  {
    owner: playerId(7), session: sessionId(3), gameType: 2, name: 'Sunset', date: '2026.09.18-09:52', palette: warm,
    parts: [{ shape: sun, at: [0, 0.3, 0], hands: 'left' }, { shape: waves, at: [0, -0.3, 0], hands: 'left' }],
    models: [model('Palm tree', [-1.3, 0, -1.4], 1.2)],
  },
  { owner: playerId(8), session: sessionId(3), gameType: 2, name: 'Shell', date: '2026.09.18-10:01', palette: sea, parts: [{ shape: waves }, { shape: spiral, at: [0.35, 0.1, 0.1] }], decimation: 3 },
  {
    owner: playerId(3), session: sessionId(3), gameType: 4, name: 'Two hands', date: '2026.09.18-10:12', palette: cool,
    parts: [{ shape: flower, hands: 'right', at: [0.3, 0, 0] }, { shape: flower, hands: 'left', at: [0.3, 0, 0], mirror: true }],
  },
  // Joint drawing, multiplayer: the second author starts while the first is still drawing
  {
    owner: playerId(1), session: sessionId(4), gameType: 3, name: 'Together', date: '2026.10.05-15:10', palette: warm,
    collaborators: [playerId(4)],
    parts: [
      { shape: flower, author: playerId(1), palette: warm },
      { shape: tree, author: playerId(4), palette: nature, at: [0.55, -0.05, 0.1], startOffsetMs: 8000 },
      { shape: sun, author: playerId(1), palette: warm, at: [0.2, 0.55, 0] },
    ],
    models: [model('Table', [0.6, 0.4, -1.3], 1)],
  },
  // Default session
  { owner: playerId(8), session: DEFAULT_SESSION_ID, gameType: 5, name: 'Quick sketch', date: '2026.10.12-11:00', palette: cool, parts: [{ shape: quickCircle }] },
  // Follow-up sessions: the same participants and game type again, for trends and cohorts
  { owner: playerId(1), session: sessionId(5), gameType: 0, name: 'My garden II', date: '2026.04.23-10:20', palette: warm, speed: 0.42, pressure: 0.42, parts: [{ shape: flower, scale: 1.2 }] },
  { owner: playerId(2), session: sessionId(5), gameType: 0, name: 'The old oak II', date: '2026.04.23-10:28', palette: nature, speed: 0.34, parts: [{ shape: tree, scale: 1.15 }] },
  { owner: playerId(3), session: sessionId(5), gameType: 0, name: 'Storm II', date: '2026.04.23-10:36', palette: dark, parts: [{ shape: scribble, hands: 'mixed' }], speed: 0.5, tremor: 0.002, pressure: 0.45, erase: 0.1 },
  { owner: playerId(1), session: sessionId(6), gameType: 0, name: 'My garden III', date: '2026.10.08-16:10', palette: warm, speed: 0.5, pressure: 0.5, parts: [{ shape: flower, scale: 1.4 }] },
  { owner: playerId(4), session: sessionId(6), gameType: 0, name: 'Home II', date: '2026.10.08-16:20', palette: warm.slice(1).concat(cool.slice(0, 1)), speed: 0.4, parts: [{ shape: house, scale: 1.3 }] },
]

function serverDateToMs(date: string): number {
  const [datePart, timePart] = date.split('-')
  const [y, m, d] = datePart.split('.').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm)
}

function scaleAbout(polylines: Vec[][], centre: Vec, factor: number): Vec[][] {
  return polylines.map((line) => line.map(([x, y, z]): Vec => [
    centre[0] + (x - centre[0]) * factor, centre[1] + (y - centre[1]) * factor, centre[2] + (z - centre[2]) * factor,
  ]))
}

function buildDrawing(spec: DrawingSpec, index: number, sessions: Session[]): Drawing {
  const rng = createRng(1000 + index * 7919)
  const id = `demo-drawing-${String(index + 1).padStart(2, '0')}`
  const session = sessions.find((s) => s.id === spec.session)
  const base: Vec = [0, 1.25, -0.9]
  const lines: Line[] = []
  const start = serverDateToMs(spec.date)
  let latest = start // the end of everything drawn so far

  for (const part of spec.parts) {
    const at = part.at ?? [0, 0, 0]
    const centre: Vec = [base[0] + at[0], base[1] + at[1], base[2] + at[2]]
    let polylines = part.shape(rng, centre)
    if (part.scale) polylines = scaleAbout(polylines, centre, part.scale)
    if (part.mirror) polylines = mirrorX(polylines, base[0]) // around the middle of the drawing, for bilateral drawing
    const hands = part.hands ?? 'right'
    const hand = (i: number): Hand => (hands === 'left' ? -1 : hands === 'right' ? 1 : i % 3 === 0 ? -1 : 1)
    const partStart = part.startOffsetMs !== undefined ? start + part.startOffsetMs : latest + (part.pauseBeforeMs ?? 0) + (lines.length ? 4000 : 0)
    const built = buildLines(polylines, {
      rng,
      idPrefix: `${id}-${lines.length}`,
      authorId: part.author ?? spec.owner,
      startMs: partStart,
      palette: part.palette ?? spec.palette,
      hand,
      speed: spec.speed,
      tremor: spec.tremor,
      pressure: spec.pressure,
      eraseProbability: spec.erase,
      legacy: spec.legacy,
    })
    lines.push(...built.lines)
    latest = Math.max(latest, built.endMs)
  }

  const authors = [...new Set(lines.map((l) => l.userID))]
  const collaborators: Collaborator[] = (spec.collaborators ?? []).map((c) => ({ id: c, joined: spec.date }))
  return {
    metadata: {
      id,
      owner: spec.owner,
      collaborators,
      version: '1.0',
      date: spec.date,
      gameType: spec.gameType,
      sessionID: spec.session,
      showBoy: !!session?.showBoy,
      showGirl: !!session?.showGirl,
      sadChildCoordinates: null, // the server stores None on save, see requirements FUT-09
      ...(spec.legacy ? {} : { schemaVersion: 2, appVersion: '0.9.0-demo', device: 'Demo HMD' }),
      ...(spec.decimation ? { trackingDecimation: spec.decimation } : {}),
    },
    lines,
    // Schema version 1 has neither events nor tracking
    trackedBehaviors: spec.legacy ? [] : buildTracking(lines, authors, rng, spec.decimation ?? 1),
    placedModels: spec.models ?? [],
    events: spec.legacy ? [] : buildEvents(lines, rng),
  }
}

function buildWorld(): World {
  const players: PlayerRecord[] = [
    {
      id: 'demo-psychologist', username: 'psychologist', role: Role.Psychologist,
      info: { id: 'demo-psychologist', name: 'Dr. Demo Psychologist', gender: null, age: null, dominantHand: null },
    },
    ...playerData.map(([name, age, gender, dominantHand], i): PlayerRecord => ({
      id: playerId(i + 1),
      username: i === 0 ? 'player' : `participant${i + 1}`,
      role: Role.Player,
      info: { id: playerId(i + 1), name, age, gender, dominantHand },
    })),
  ]

  const session = (
    id: string, name: string, description: string, startDate: string, endDate: string | null, multiplayer = 0,
  ): Session => ({ id, name, description, startDate, endDate, showBoy: 1, showGirl: 1, multiplayer })

  const sessions: Session[] = [
    session(DEFAULT_SESSION_ID, 'Default Session', 'Used for new drawings while no other session is active.', '2026.01.01-00:00', null),
    session(sessionId(1), 'Spring group: Inner child', 'First meeting of the spring group, free drawing around the inner child.', '2026.03.12-10:00', '2026.03.12-12:00'),
    session(sessionId(5), 'Spring group: follow-up', 'The same group six weeks later, the same inner child task.', '2026.04.23-10:00', '2026.04.23-12:00'),
    session(sessionId(2), 'Word Forest workshop', 'Drawing in the Word Forest with a few guiding words.', '2026.05.07-14:00', '2026.05.07-16:30'),
    session(sessionId(3), 'Beach relaxation', 'Relaxation session at the beach, including a bilateral drawing task.', '2026.09.18-09:30', null),
    session(sessionId(4), 'Joint drawing', 'Two participants draw together in the same room.', '2026.10.05-15:00', null, 1),
    session(sessionId(6), 'Autumn check-in', 'A short check-in with the inner child task.', '2026.10.08-16:00', null),
  ]

  const drawings = specs.map((spec, i) => buildDrawing(spec, i, sessions))
  const metas: DrawingMeta[] = drawings.map((d, i) => {
    const name = specs[i].name
    return {
      id: d.metadata.id,
      playerID: d.metadata.owner,
      name,
      path: `VRDrawing3D/Drawings/${d.metadata.owner}/${name}/${name}.json`,
      gameType: d.metadata.gameType,
      sessionID: d.metadata.sessionID,
    }
  })

  return { players, sessions, drawings, metas, activeSessionId: sessionId(3) }
}

let world: World | null = null

export function getWorld(): World {
  world ??= buildWorld()
  return world
}
