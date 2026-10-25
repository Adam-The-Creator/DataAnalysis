/**
 * Data shapes of the web app.
 *
 * The first part mirrors the DatabaseServer models (models/sqlite/models.py and models/mongodb/models.py).
 * The second part is the contract of the analysis API, the server module that does not exist yet (requirements
 * TEC-02). Until it does, the live client throws NotImplementedError for it and the demo client simulates it.
 */

// --- Roles ---

export const Role = { None: -1, Player: 0, Psychologist: 1, Admin: 2 } as const
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

/** What a player may change about themself (the same four fields as in the game). The server checks the limits. */
export interface PlayerInfoInput {
  name: string
  /** "Male", "Female", "Other" or "" for not set. */
  gender: string
  /** Whole years from 0 to 150, 0 for not given. */
  age: number
  /** "Left", "Right", "Both" or "" for not set. */
  dominantHand: string
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
  /** When an erased stroke was erased, on the time axis. Null: not known, then the replay erases it when it is finished. */
  erasedAtMs: number | null
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

// --- Feedback, questionnaires and the admin dashboard (requirements FBK-*, ADM-*) ---

export type FeedbackTarget = 'game' | 'webapp'
export type InstrumentId = 'SUS' | 'UEQ' | 'SMILEY'
export type FeedbackCategory = 'problem' | 'idea' | 'praise' | 'other'
/** The age of a player at the time of sending: child is 12 or younger, unknown is an age that was never filled in. */
export type AgeBand = 'child' | 'teen' | 'adult' | 'unknown'
/** Who sent it: a player or a psychologist (the admin does not send). */
export type SenderRole = typeof Role.Player | typeof Role.Psychologist

/** What the web app needs to build a form; the item texts are in the translations, keyed by the item ID. */
export interface InstrumentDefinition {
  id: InstrumentId
  version: number
  targets: FeedbackTarget[]
  scaleMin: number
  scaleMax: number
  itemIds: string[]
}

/** The ID is made up by the client, so a repeated send (double click, retry) is the same submission. */
export interface QuestionnaireInput {
  clientId: string
  instrument: InstrumentId
  version: number
  target: FeedbackTarget
  answers: Record<string, number>
}

export interface MessageInput {
  clientId: string
  target: FeedbackTarget
  category: FeedbackCategory | null
  text: string
}

export interface SubmissionReceipt {
  id: string
  createdAt: string // ISO
}

export type MySubmission =
  | { kind: 'questionnaire'; id: string; createdAt: string; target: FeedbackTarget; instrument: InstrumentId }
  | { kind: 'message'; id: string; createdAt: string; target: FeedbackTarget; category: FeedbackCategory | null; text: string }

export interface MySubmissions {
  total: number
  items: MySubmission[]
}

export interface UsageNumbers {
  registered: { total: number; players: number; psychologists: number; admins: number }
  /** A player who has a drawing, a psychologist who signed in at least once. */
  used: { players: number; psychologists: number }
  accountsPerWeek: { weekStart: string; players: number; psychologists: number; total: number }[]
  submissions: { questionnaires: number; messages: number; unreadMessages: number }
}

export type CountingRule = 'latest' | 'all'

export interface ResultFilters {
  target?: FeedbackTarget
  role?: SenderRole
  ageBand?: AgeBand
  version?: number
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string
  counting: CountingRule
}

export interface SusStats {
  mean: number
  sd: number
  median: number
  min: number
  max: number
  histogram: { from: number; to: number; count: number }[]
  /** Each item as 0 (worst) to 4 (best). */
  items: { id: string; mean: number }[]
}

export type UeqScaleId = 'attractiveness' | 'perspicuity' | 'efficiency' | 'dependability' | 'stimulation' | 'novelty'

export interface UeqStats {
  scales: { id: UeqScaleId; mean: number; low: number; high: number }[]
  pragmatic: number
  hedonic: number
  /** Each item as -3 (very negative) to +3 (very positive). */
  items: { id: string; mean: number }[]
}

export interface SmileyStats {
  mean: number
  items: { id: string; mean: number; distribution: number[] }[] // how many chose face 1..5
}

export interface ResultGroup {
  instrument: InstrumentId
  target: FeedbackTarget
  role: SenderRole
  n: number
  accounts: number
  versions: number[]
  ageBands: Partial<Record<AgeBand, number>>
  /** False below the minimum group size: then there are no statistics, only the size. */
  enough: boolean
  sus?: SusStats
  ueq?: UeqStats
  smiley?: SmileyStats
}

export interface TrendPoint {
  instrument: InstrumentId
  target: FeedbackTarget
  role: SenderRole
  week: string // YYYY-MM-DD, the Monday
  n: number
  mean: number
}

export interface QuestionnaireResults {
  counting: CountingRule
  minGroupSize: number
  submissions: number
  counted: number
  groups: ResultGroup[]
  trend: TrendPoint[]
}

export interface AdminMessage {
  id: string
  /** The pseudonym of the sender: stable, and nothing that identifies the account. */
  code: string
  role: SenderRole
  ageBand: AgeBand
  target: FeedbackTarget
  category: FeedbackCategory | null
  text: string
  createdAt: string // ISO
  isRead: boolean
}

export interface MessageFilters {
  target?: FeedbackTarget
  category?: FeedbackCategory
  role?: SenderRole
  ageBand?: AgeBand
  dateFrom?: string
  dateTo?: string
  read?: 'read' | 'unread'
  q?: string
}

export interface MessagePage {
  total: number
  unread: number
  items: AdminMessage[]
}

// --- AI decision support (requirements AI-01..AI-16) ---
//
// Every AI output comes in the same envelope (AiOutput): it is always labelled as AI-generated and carries the model,
// parameters, confidence and evidence (AI-04). It is decision support for the psychologist, never a diagnosis (AI-05).

export type AiFeatureId = 'cohort' | 'groups' | 'indicators' | 'insights' | 'labels' | 'description' | 'summary'
export type AiHeavyFeature = 'labels' | 'description' | 'summary'
export type AiStatus = 'ok' | 'disabled' | 'unavailable' | 'notEnoughData'
export type AiReason =
  | 'switchedOff' | 'notEnoughData' | 'noStrokes' | 'missingLibrary' | 'missingModel' | 'serviceUnreachable'
  | 'invalidRules' | 'invalidVocabulary' | 'diagnosticLanguage' | 'invalidAnswer' | 'timeout' | 'failed'
export type AiView = 'front' | 'top' | 'side' | 'iso'
/** The group a drawing is compared with: the same game type, the same session, or all drawings. */
export type AiScope = 'gameType' | 'session' | 'all'
export type FuzzyLevel = 'low' | 'medium' | 'high'

export interface AiModelInfo {
  id: string
  name: string
  version: string
  licence: string
  kind: string // statistical, rules, neural, language, vision-language
}

export type AiEvidence =
  | { kind: 'metric'; id: MetricId; value: number | null }
  | { kind: 'strokes'; strokeIds: string[]; label?: string }
  | { kind: 'view'; view: AiView; groupId?: string }
  | { kind: 'drawing'; id: string }
  | { kind: 'facts'; facts: Record<string, unknown> }

export interface AiOutput<T> {
  ai: true
  label: string // "AI-generated"
  disclaimer: string
  feature: AiFeatureId
  requirement: string
  status: AiStatus
  reason: AiReason | null
  /** AI-07: tried on a sample set together with a psychologist. */
  evaluated: boolean
  model: AiModelInfo
  params: Record<string, unknown>
  /** The prompt, rule base or vocabulary version. */
  promptVersion: string | null
  /** What the number is says confidenceKind (a membership degree, the vocabulary share, ...): never a probability of being right. */
  confidence: number | null
  confidenceKind: string | null
  evidence: AiEvidence[]
  notes: string[]
  moduleVersion: string
  generatedAt: string
  result: T | null
}

export interface AiNotable {
  metric: MetricId
  z: number
  value: number | null
  direction: 'high' | 'low'
  beyondLimit: boolean
}

export interface AiCohortRow {
  id: string
  maxAbsZ: number
  atypical: boolean
  notable: AiNotable[]
  isolation: { score: number; rank: number; of: number } | null
  similar: { id: string; distance: number; similarity: number }[]
}

export interface AiMap {
  points: { id: string; x: number; y: number }[]
  axes: { explained: number; top: { metric: MetricId; loading: number }[] }[]
}

export interface AiDirectoryEntry {
  name: string
  playerId: string
  gameType: number
}

export interface AiDrawingCohort {
  cohortSize: number
  metrics: MetricId[]
  zLimit: number
  subject: AiCohortRow
  map: AiMap | null
  directory: Record<string, AiDirectoryEntry>
}

export interface AiSessionCohort {
  cohortSize: number
  metrics: MetricId[]
  zLimit: number
  drawings: AiCohortRow[]
  map: AiMap | null
  directory: Record<string, AiDirectoryEntry>
}

export interface AiStrokeGroup {
  id: string
  strokeIds: string[]
  strokeCount: number
  authors: string[]
  length: number
  inkShare: number
  boundsMin: number[]
  boundsMax: number[]
  size: number[]
  centre: number[]
  colours: PaletteEntry[]
  startMs: number | null
  endMs: number | null
}

export interface AiGroups {
  strokeCount: number
  groups: AiStrokeGroup[]
  unclustered: string[]
  timeUsed: boolean
  truncated: boolean
}

export interface AiIndicator {
  id: string
  name: string
  rationale: string
  level: FuzzyLevel | null
  text: string | null
  degree: number
  degrees: Record<FuzzyLevel, number>
  inputs: { metric: MetricId; value: number | null; basis: 'cohort' | 'fixed' | null; sets: Record<FuzzyLevel, number> | null }[]
  fired: { rule: string; if: string; then: FuzzyLevel; weight: number; strength: number; rationale: string }[]
  skipped: { rule: string; missing: MetricId[] }[]
}

export interface AiIndicators {
  ruleBase: { name: string; version: string; status: 'proposal' | 'reviewed'; reviewed: string }
  cohortSize: number
  basis: 'cohort' | 'fixed' | 'mixed'
  indicators: AiIndicator[]
}

export interface AiLabelEntry {
  label: string
  name: string
  other: boolean
  score: number
}

export interface AiVerdict {
  top: AiLabelEntry[]
  margin: number
  unspecific: boolean
}

export interface AiLabels {
  vocabulary: { name: string; version: string }
  whole: AiVerdict & { views: { view: AiView; top: AiLabelEntry[] }[] }
  groups: (AiVerdict & { groupId: string; strokeIds: string[] })[]
}

export interface AiDescription {
  depictedObjects: { name: string; certainty: 'low' | 'medium' | 'high' }[]
  scene: string
  notableFeatures: string[]
  colourMoodWords: string[]
  abstract: boolean
}

export interface AiSummary {
  overview: string
  observations: string[]
  thingsToExplore: string[]
  limitations: string[]
}

export type AiInsight =
  | { kind: 'recurringLabel'; label: string; name: string; drawings: number; participants: number; drawingIds: string[]; playerIds: string[] }
  | {
    kind: 'indicatorLevels'; indicator: string; name: string; counts: Record<FuzzyLevel, number>
    drawingIds: Record<FuzzyLevel, string[]>; total: number; common: FuzzyLevel | null
  }
  | { kind: 'atypical'; drawingIds: string[]; drawings: number }

export interface AiInsights {
  drawingCount: number
  insights: AiInsight[]
  atypicalSkipped: string | null
  coverage: { labels: number; indicators: number }
  directory: Record<string, AiDirectoryEntry>
}

export interface AiResultTypes {
  labels: AiLabels
  description: AiDescription
  summary: AiSummary
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export interface AiJob {
  id: string
  kind: string // labels, description, summary or download
  targetId: string
  status: JobStatus
  progress: number // 0..1
  message: string
  error: string | null
  createdAt: string
  finishedAt: string | null
}

/** A heavy function: the stored result (maybe out of date), whether it can run now, and its latest job. */
export interface AiHeavyState<T> {
  feature: AiHeavyFeature
  result: AiOutput<T> | null
  stale: boolean
  available: boolean
  reason: AiReason | null
  detail: string | null
  job: AiJob | null
}

export interface AiFeatureStatus {
  id: AiFeatureId
  requirement: string
  kind: 'classical' | 'rules' | 'model'
  enabled: boolean
  evaluated: boolean
  available: boolean
  reason: AiReason | null
  detail: string | null
  models: string[]
}

export interface AiStatusInfo {
  enabled: boolean
  label: string
  disclaimer: string
  moduleVersion: string
  features: AiFeatureStatus[]
}

export interface AiModelEntry {
  id: string
  name: string
  version: string
  kind: 'library' | 'rules' | 'neural' | 'language' | 'vision-language' | 'runtime'
  licence: string
  /** False for every model so far: the licences are recorded from the model cards, not yet checked against the study. */
  licenceChecked: boolean
  source: string
  sizeHint: string | null
  usedBy: AiFeatureId[]
  status: 'installed' | 'notInstalled' | 'notDownloaded' | 'unreachable' | 'invalid'
  statusDetail: string | null
  downloadable: boolean
  hint: string | null
}

export interface AiRuleBase {
  name: string
  version: string
  status: 'proposal' | 'reviewed'
  reviewed: string
  description: string
  fallbackRanges: Record<string, number[]>
  indicators: {
    id: string
    name: string
    rationale: string
    levels: Record<FuzzyLevel, string>
    rules: { id: string; if: string; then: FuzzyLevel; weight: number; rationale: string }[]
  }[]
}

export interface AiRulesInfo {
  file: string
  ruleBase: AiRuleBase | null
  problems: string[]
}

export interface AiVocabularyInfo {
  file: string
  vocabulary: { name: string; version: string; templates: string[]; labels: { id: string; name: string; other: boolean; phrases: string[] }[] } | null
  problem: string | null
}
