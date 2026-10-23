import type {
  CreatedReport, Drawing, DrawingAnalysis, DrawingMeta, LoginResult, PlayerInfo, PlayerListEntry, RecentDrawing,
  ReportInfo, ReportKind, RoleValue, Session, SessionStats, SessionSummary, TimePoint,
} from './types'

/**
 * Everything the UI needs from a backend. There are two implementations:
 *  - live: the DatabaseServer. What its existing endpoints cannot give throws NotImplementedError.
 *  - demo: generated sample data, including a stand-in for the analysis module, so the whole app can be tried
 *    without a server.
 */
export interface Api {
  auth: {
    login(username: string, password: string): Promise<LoginResult>
    role(playerId: string): Promise<RoleValue>
  }

  sessions: {
    /** Sessions with their drawing and participant counts (composed from existing endpoints in live mode). */
    summaries(): Promise<SessionSummary[]>
    get(sessionId: string): Promise<Session>
    activeId(): Promise<string>
    drawings(sessionId: string): Promise<DrawingMeta[]>
  }

  players: {
    info(playerId: string): Promise<PlayerInfo>
    /** A null entry means the info could not be read (for example a player may only read their own). */
    infos(playerIds: string[]): Promise<(PlayerInfo | null)[]>
    list(): Promise<PlayerListEntry[]>
    drawings(playerId: string): Promise<DrawingMeta[]>
  }

  drawings: {
    /** With ownerId the player-scoped endpoint is used (a player may only read their own drawings). */
    get(drawingId: string, ownerId?: string): Promise<Drawing>
    /** The name, owner and session of a drawing (the drawing document itself has no name). */
    meta(drawingId: string): Promise<DrawingMeta>
  }

  /** The server side analysis module (requirement TEC-02): not implemented on the server yet. */
  analysis: {
    drawingsOverTime(): Promise<TimePoint[]>
    recentDrawings(limit: number): Promise<RecentDrawing[]>
    /** An image URL (a data URL in demo mode). */
    thumbnail(drawingId: string): Promise<string>
    drawingAnalysis(drawingId: string): Promise<DrawingAnalysis>
    sessionStats(sessionId: string): Promise<SessionStats>
    reports(): Promise<ReportInfo[]>
    /** Reuses a stored report unless regenerate is set (requirement REP-04). */
    createReport(kind: ReportKind, targetId: string, regenerate?: boolean): Promise<CreatedReport>
    reportHtml(reportId: string): Promise<string>
    deleteReport(reportId: string): Promise<void>
  }
}
