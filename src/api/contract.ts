import type {
  CohortFilters, CohortResult, CreatedReport, CsvDialect, Drawing, DrawingAnalysis, DrawingGeometry, DrawingMeta,
  ExportFormat, HeatmapData, LoginResult, MultiplayerData, Overview, ParticipantHistory, PlayerInfo, PlayerListEntry,
  RecentDrawing, ReportInfo, ReportKind, RoleValue, Session, SessionInput, SessionStats, SessionSummary, TimePoint,
  TimelineData, TrackingData,
} from './types'

/**
 * Everything the UI needs from a backend. There are two implementations:
 *  - live: the DatabaseServer. What an older server build does not have throws NotImplementedError.
 *  - demo: generated sample data, including a stand-in for the analysis module, so the whole app can be tried
 *    without a server.
 */
export interface Api {
  auth: {
    login(username: string, password: string): Promise<LoginResult>
    role(playerId: string): Promise<RoleValue>
  }

  sessions: {
    /** Sessions with their drawing and participant counts. */
    summaries(): Promise<SessionSummary[]>
    get(sessionId: string): Promise<Session>
    activeId(): Promise<string>
    drawings(sessionId: string): Promise<DrawingMeta[]>
    // Session management (requirement SES-05). The server's rules come back as readable messages.
    create(input: SessionInput): Promise<Session>
    update(sessionId: string, input: SessionInput): Promise<Session>
    activate(sessionId: string): Promise<void>
    close(sessionId: string): Promise<void>
    remove(sessionId: string): Promise<void>
  }

  players: {
    info(playerId: string): Promise<PlayerInfo>
    /** A null entry means the info could not be read (for example a player may only read their own). */
    infos(playerIds: string[]): Promise<(PlayerInfo | null)[]>
    list(): Promise<PlayerListEntry[]>
    drawings(playerId: string): Promise<DrawingMeta[]>
  }

  drawings: {
    /** The whole stored document (large). Only needed for the raw JSON download. */
    get(drawingId: string, ownerId?: string): Promise<Drawing>
    /** The name, owner and session of a drawing (the drawing document itself has no name). */
    meta(drawingId: string): Promise<DrawingMeta>
  }

  /** The server side analysis module (requirement TEC-02). */
  analysis: {
    overview(): Promise<Overview>
    drawingsOverTime(): Promise<TimePoint[]>
    /** Without a limit: every drawing, newest first. */
    recentDrawings(limit?: number): Promise<RecentDrawing[]>
    /** An image URL (a data or object URL). */
    thumbnail(drawingId: string): Promise<string>
    /** The strokes for the viewer, simplified by a tolerance in metres (0 keeps every point). */
    geometry(drawingId: string, tolerance: number): Promise<DrawingGeometry>
    drawingAnalysis(drawingId: string): Promise<DrawingAnalysis>
    sessionStats(sessionId: string): Promise<SessionStats>
    timeline(drawingId: string, idleGapSeconds: number): Promise<TimelineData>
    tracking(drawingId: string): Promise<TrackingData>
    heatmap(drawingId: string, voxelSize: number): Promise<HeatmapData>
    multiplayer(drawingId: string, proximity: number): Promise<MultiplayerData>
    cohort(drawingId: string, filters: CohortFilters): Promise<CohortResult>
    participantHistory(playerId: string): Promise<ParticipantHistory>
    exportSessionCsv(sessionId: string, dialect: CsvDialect): Promise<Blob>
    exportDrawing(drawingId: string, format: ExportFormat, includeErased: boolean): Promise<Blob>
    reports(): Promise<ReportInfo[]>
    /** Reuses a stored report unless regenerate is set (requirement REP-04). */
    createReport(kind: ReportKind, targetId: string, regenerate?: boolean): Promise<CreatedReport>
    reportHtml(reportId: string): Promise<string>
    deleteReport(reportId: string): Promise<void>
  }
}
