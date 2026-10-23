/**
 * Data shapes of the web app.
 *
 * The first part mirrors the DatabaseServer models (models/sqlite/models.py and models/mongodb/models.py).
 * The second part is the contract of the analysis API, the server module that does not exist yet (requirements
 * TEC-02). Until it does, the live client throws NotImplementedError for it and the demo client simulates it.
 */

// --- Roles ---

export const Role = { None: -1, Player: 0, Psychologist: 1 } as const
export type RoleValue = (typeof Role)[keyof typeof Role]

export interface LoginResult {
  playerId: string
  accessToken: string
  expiresIn: number
}

// --- Relational data (SQLite) ---

export interface Session {
  id: string
  name: string
  description: string | null
  startDate: string // "yyyy.MM.dd-HH:mm"
  endDate: string | null
  showBoy: number
  showGirl: number
  multiplayer: number
}

export interface PlayerInfo {
  id: string
  name: string | null
  gender: string | null
  age: number | null
  dominantHand: string | null
}

export interface DrawingMeta {
  id: string
  playerID: string
  name: string
  path: string
  gameType: number
  sessionID: string
}

// --- Drawing document (MongoDB) ---

export type Hand = -1 | 1 // -1 left, 1 right
export type LineStatus = 0 | 1 // 0 erased, 1 drawn

export interface Point {
  x: number
  y: number
  z: number
  timestamp: string // legacy local-time stamp "yyyy_MM_dd_HH_mm_ss_fff"
  utcMs?: number | null
  pressure?: number | null
}

export interface LineColor {
  r: number // 0..255
  g: number
  b: number
  a: number // 0..1
}

export interface LineStats {
  pointCount: number
  length: number
  durationMs?: number | null
  startUtcMs?: number | null
  endUtcMs?: number | null
  boundsMinX: number
  boundsMinY: number
  boundsMinZ: number
  boundsMaxX: number
  boundsMaxY: number
  boundsMaxZ: number
}

export interface LineEvent {
  eventType: number // 0 erase, 1 draw, 2 undo
  invoker: string
  timestamp: string
  hand: Hand
}

export interface Line {
  id: string
  points: Point[]
  startWidth: number
  endWidth: number
  startColor: LineColor
  endColor: LineColor
  hand: Hand
  userID: string
  history: LineEvent[]
  status: LineStatus
  stats?: LineStats | null
}

export interface SadChildCoordinate {
  x: number
  y: number
  z: number
  forwardX?: number | null
  forwardY?: number | null
  forwardZ?: number | null
}

export interface Collaborator {
  id: string
  joined: string
}

export interface DrawingMetadata {
  id: string
  owner: string
  collaborators?: Collaborator[] | null
  version: string
  date: string // "yyyy.MM.dd-HH:mm"
  gameType: number
  sessionID: string
  showBoy: boolean
  showGirl: boolean
  sadChildCoordinates?: SadChildCoordinate | null
  schemaVersion?: number | null
  appVersion?: string | null
  device?: string | null
  trackingDecimation?: number | null
}

export interface PlacedModel {
  modelName: string
  positionX: number
  positionY: number
  positionZ: number
  rotationX: number
  rotationY: number
  rotationZ: number
  rotationW: number
  scaleX: number
  scaleY: number
  scaleZ: number
}

export interface Drawing {
  metadata: DrawingMetadata
  lines: Line[]
  trackedBehaviors?: unknown[] | null
  placedModels?: PlacedModel[] | null
  events?: unknown[] | null
}

// --- Composed data (built on the client from the existing endpoints for now) ---

export interface SessionSummary extends Session {
  drawingCount: number
  participantIds: string[]
  gameTypeCounts: Record<number, number>
}

export interface Overview {
  sessions: { total: number; open: number; closed: number }
  drawings: number
  participants: number
  activeSession: SessionSummary | null
  drawingsByGameType: { gameType: number; count: number }[]
  recentSessions: SessionSummary[]
}

export interface PlayerListEntry {
  id: string
  role: RoleValue
  info: PlayerInfo
}

// --- Analysis API contract (server module, not implemented yet) ---

export type MetricId =
  | 'strokesDrawn'
  | 'strokesErased'
  | 'pointCount'
  | 'totalLength'
  | 'meanStrokeLength'
  | 'boundingVolume'
  | 'heightRange'
  | 'drawingSpan'
  | 'activeTime'
  | 'meanSpeed'
  | 'directionalChange'
  | 'meanPressure'
  | 'leftHandShare'
  | 'warmShare'
  | 'distinctColours'
  | 'eraseRatio'
  | 'figureDistance'

/** Why a metric has no value (requirement MET-05: never a fake value). */
export type UnavailableReason =
  | 'noStrokes'
  | 'noTimeData'
  | 'noPressure'
  | 'noFigurePosition'
  | 'noChromaticInk'

export interface MetricValue {
  id: MetricId
  value: number | null
  unavailableReason?: UnavailableReason
}

export interface PaletteEntry {
  hex: string
  share: number // 0..1 of the ink length
}

/** Data quality flags (requirement MET-08). */
export type QualityFlagId =
  | 'legacySchema'
  | 'thinnedTracking'
  | 'fewStrokes'
  | 'allErased'
  | 'missingFigurePosition'
  | 'missingTimeData'

export interface DrawingAnalysis {
  drawingId: string
  analyzerVersion: string
  generatedAt: string // ISO
  metrics: MetricValue[]
  palette: PaletteEntry[]
  flags: QualityFlagId[]
}

export interface MetricDistribution {
  id: MetricId
  count: number // drawings that have a value
  min: number
  median: number
  max: number
}

export interface ParticipantRow {
  playerId: string
  drawings: number
  metrics: Partial<Record<MetricId, number>> // mean over the participant's drawings
}

export interface SessionStats {
  sessionId: string
  drawingCount: number
  distributions: MetricDistribution[]
  perParticipant: ParticipantRow[]
}

export interface TimePoint {
  date: string // "yyyy.MM.dd"
  count: number
}

export interface RecentDrawing {
  meta: DrawingMeta
  playerName: string
  date: string
}

export type ReportKind = 'drawing' | 'session'

export interface ReportInfo {
  id: string
  kind: ReportKind
  targetId: string
  title: string
  createdAt: string // ISO
  stale: boolean
}

export interface CreatedReport {
  report: ReportInfo
  reused: boolean
}
