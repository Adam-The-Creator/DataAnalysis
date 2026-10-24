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

/** Event types of the game (DrawingEventType in models/mongodb/models.py). */
export const DrawingEventType = { MenuOpen: 0, MenuClose: 1, ModeChange: 2, ColorChange: 3, WidthChange: 4 } as const

export interface DrawingEvent {
  type: number
  playerID: string
  hand: Hand
  utcMs: number
  value?: string | null
}

export interface Pose {
  pX: number
  pY: number
  pZ: number
  rX: number
  rY: number
  rZ: number
  rW: number
  timestamp?: string | null
  utcMs?: number | null
}

export interface TrackedBehavior {
  playerID: string
  head: Pose[]
  rightHand: Pose[]
  leftHand: Pose[]
  player: Pose[]
}

export interface Drawing {
  metadata: DrawingMetadata
  lines: Line[]
  trackedBehaviors?: TrackedBehavior[] | null
  placedModels?: PlacedModel[] | null
  events?: DrawingEvent[] | null
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
  | 'idleTime'
  | 'meanSpeed'
  | 'directionalChange'
  | 'meanPressure'
  | 'leftHandShare'
  | 'warmShare'
  | 'distinctColours'
  | 'eraseRatio'
  | 'figureDistance'
  | 'menuOpens'
  | 'toolChanges'

/** Why a metric has no value (requirement MET-05: never a fake value). */
export type UnavailableReason =
  | 'noStrokes'
  | 'noTimeData'
  | 'noPressure'
  | 'noFigurePosition'
  | 'noChromaticInk'
  | 'noInk'
  | 'noEvents'

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
  | 'multipleSittings'

/** A sentence of the template-based summary (requirement REP-07): the id picks the translation, params fill it. */
export type NarrativeId =
  | 'activityTimed'
  | 'activity'
  | 'speed'
  | 'space'
  | 'hand'
  | 'handDominant'
  | 'colour'
  | 'colourNeutral'
  | 'erase'
  | 'tools'
  | 'pauses'
  | 'quality'

export interface NarrativeItem {
  id: NarrativeId
  params: Record<string, string | number>
}

export interface DrawingAnalysis {
  drawingId: string
  analyzerVersion: string
  generatedAt: string // ISO
  metrics: MetricValue[]
  palette: PaletteEntry[]
  flags: QualityFlagId[]
  narrative?: NarrativeItem[]
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
  sessionName: string
  date: string
}

export type ReportKind = 'drawing' | 'session' | 'participant'

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

// --- Drawing geometry, time axis and the P2 analyses ---

/**
 * Every time the analysis returns is milliseconds on the drawing's time axis. It starts at the first stroke, and a
 * break of more than 30 minutes between two sittings (the drawing was continued later) is cut down to 5 seconds.
 */
export interface BreakMark {
  atMs: number // where the break is on the axis
  realMs: number // how long it really was
}

export interface StrokeGeometry {
  id: string
  authorId: string
  hand: Hand
  erased: boolean
  width: number // metres
  startColor: { r: number; g: number; b: number }
  endColor: { r: number; g: number; b: number }
  length: number // metres, of the original stroke
  pointCount: number // of the original stroke
  durationMs: number | null
  points: [x: number, y: number, z: number, t: number | null][] // game coordinates
}

export type GeometryMetadata = Pick<
  DrawingMetadata,
  | 'id' | 'owner' | 'collaborators' | 'date' | 'gameType' | 'sessionID' | 'showBoy' | 'showGirl'
  | 'sadChildCoordinates' | 'schemaVersion' | 'appVersion' | 'device' | 'trackingDecimation'
>

/** A drawing as the viewer needs it (requirement DRW-03): strokes, simplified by a tolerance in metres. */
export interface DrawingGeometry {
  drawingId: string
  tolerance: number
  originMs: number
  timeBase: 'utc' | 'legacy'
  durationMs: number
  breaks: BreakMark[]
  pointCountOriginal: number
  pointCountReturned: number
  hasTracking: boolean
  hasEvents: boolean
  metadata: GeometryMetadata
  placedModels: PlacedModel[]
  strokes: StrokeGeometry[]
}

export type TimelineItem =
  | { kind: 'stroke'; lineId: string; authorId: string; hand: Hand; startMs: number; endMs: number; erased: boolean }
  | { kind: 'erase' | 'undo'; lineId: string; authorId: string; hand: Hand; atMs: number }
  | {
    kind: 'menuOpen' | 'menuClose' | 'modeChange' | 'colorChange' | 'widthChange'
    playerId: string; hand: Hand; atMs: number; value: string | null
  }
  | { kind: 'idle'; startMs: number; endMs: number }

export interface TimelineData {
  drawingId: string
  originMs: number
  timeBase: 'utc' | 'legacy'
  breaks: BreakMark[]
  durationMs: number
  hasTimeData: boolean
  idleGapSeconds: number
  items: TimelineItem[]
  summary: {
    strokes: number; erasedStrokes: number; erases: number; undos: number; menuOpens: number; toolChanges: number
    idlePeriods: number; idleSeconds: number
  }
}

/** [t, x, y, z] of a hand, and [t, x, y, z, forwardX, forwardY, forwardZ] of the head. t is null without time data. */
export type TrackSample = (number | null)[]

export interface TrackedPlayer {
  playerId: string
  samples: { head: number; rightHand: number; leftHand: number; player: number }
  durationMs: number | null
  movement: { head: number; rightHand: number; leftHand: number; player: number } // metres travelled
  headDirection: { meanYawDeg: number; meanPitchDeg: number; yawShares: number[]; yawCoverage: number } | null
  explored: { areaM2: number; headHeightMin: number; headHeightMax: number } | null
  paths: { head: TrackSample[]; rightHand: TrackSample[]; leftHand: TrackSample[] }
}

export interface TrackingData {
  drawingId: string
  available: boolean
  originMs: number
  approximate: boolean
  decimation: number | null
  players: TrackedPlayer[]
}

export interface HeatmapData {
  drawingId: string
  voxelSize: number
  origin: [number, number, number] // game coordinates of the corner of voxel (0, 0, 0)
  dims: [number, number, number]
  cells: [i: number, j: number, k: number, ink: number][] // only voxels with ink, ink length in metres
  maxWeight: number
  totalInk: number
  figure: { x: number; y: number; z: number } | null
}

export interface AuthorContribution {
  playerId: string
  strokes: number
  erasedStrokes: number
  inkLength: number
  inkShare: number // 0..1
  drawingMs: number | null
  firstMs: number | null
  lastMs: number | null
}

export interface ProximityPair {
  a: string
  b: string
  aNearB: number // share of a's ink within the radius of b's ink, 0..1
  bNearA: number
  touchingStrokesA: number
  touchingStrokesB: number
  minDistance: number | null
}

export interface MultiplayerData {
  drawingId: string
  multiAuthor: boolean
  authors: AuthorContribution[]
  proximity: { radius: number; pairs: ProximityPair[] }
  turns: {
    gapSeconds: number
    blocks: { playerId: string; startMs: number; endMs: number }[]
    switches: number
    simultaneousMs: number
    simultaneousShare: number
  }
}

export interface CohortFilters {
  sessionId?: string
  gameType?: number
  ageMin?: number
  ageMax?: number
}

export interface CohortRow {
  id: MetricId
  value: number | null
  cohortSize: number
  percentile: number | null // 0..100, null when the group is too small or the value is missing
  min: number | null
  median: number | null
  max: number | null
}

export interface CohortResult {
  drawingId: string
  filters: CohortFilters
  cohortSize: number
  sufficient: boolean
  metrics: CohortRow[]
}

export interface HistoryRow {
  meta: DrawingMeta
  sessionName: string
  date: string
  metrics: Record<MetricId, number | null>
  flags: QualityFlagId[]
}

export interface ParticipantHistory {
  playerId: string
  player: PlayerInfo // its id is the id of the PlayerInfo row, not the player's
  drawings: HistoryRow[]
}

export type CsvDialect = 'r' | 'excel'
export type ExportFormat = 'gltf' | 'obj' | 'ply'

/** What the session form sends. activate only applies when creating. */
export interface SessionInput {
  name: string
  description: string | null
  showBoy: boolean
  showGirl: boolean
  multiplayer: boolean
  activate?: boolean
}
