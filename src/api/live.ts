import type { Api } from './contract'
import { ApiError, notImplemented, type FeatureId } from './errors'
import { del, get, getBlob, getText, post, put } from './http'
import { buildOverview } from './overview'
import type {
  CohortFilters, CohortResult, CreatedReport, Drawing, DrawingAnalysis, DrawingGeometry, DrawingMeta, HeatmapData,
  LoginResult, MultiplayerData, Overview, ParticipantHistory, PlayerInfo, RecentDrawing, ReportInfo, RoleValue,
  Session, SessionInput, SessionStats, SessionSummary, TimePoint, TimelineData, TrackingData,
} from './types'
import { geometryFromDrawing } from '@/lib/drawingGeometry'

/**
 * Client of the real DatabaseServer. Note the trailing slashes on the collection URLs: without them FastAPI answers
 * with a redirect.
 *
 * The analysis endpoints (/analysis/...) exist from the server build that has the analysis module. An older build
 * answers "Not Found" for them. Then the call falls back to what the older endpoints can give, or throws
 * NotImplementedError, which the screens show as a "not implemented" panel instead of an error.
 */

/** FastAPI's answer for a route that does not exist. The analysis module's own 404s say what was not found. */
function isMissingRoute(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'http' && error.status === 404 && error.detail === 'Not Found'
}

async function analysis<T>(
  call: () => Promise<T>, feature: FeatureId, requirements: string[], fallback?: () => Promise<T>,
): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (!isMissingRoute(error)) throw error
    if (fallback) return fallback()
    return notImplemented(feature, ...requirements)
  }
}

// --- Fallbacks for a server without the analysis module ---

async function composedSummaries(): Promise<SessionSummary[]> {
  const ids = await get<string[]>('/sessions/')
  const sessions = await Promise.all(ids.map((id) => get<Session>(`/sessions/${id}`)))
  return Promise.all(
    sessions.map(async (session): Promise<SessionSummary> => {
      const drawings = await get<DrawingMeta[]>(`/sessions/${session.id}/drawings`)
      const gameTypeCounts: Record<number, number> = {}
      for (const drawing of drawings) {
        gameTypeCounts[drawing.gameType] = (gameTypeCounts[drawing.gameType] ?? 0) + 1
      }
      return {
        ...session,
        drawingCount: drawings.length,
        participantIds: [...new Set(drawings.map((d) => d.playerID))],
        gameTypeCounts,
      }
    }),
  )
}

const asNumber = (flag: boolean) => (flag ? 1 : 0)

function sessionBody(input: SessionInput) {
  // The server's update only changes fields that are not null, so an empty description is sent as ""
  return {
    name: input.name,
    description: input.description ?? '',
    showBoy: asNumber(input.showBoy),
    showGirl: asNumber(input.showGirl),
    multiplayer: asNumber(input.multiplayer),
  }
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const liveApi: Api = {
  auth: {
    login: (username, password) => post<LoginResult>('/auth/login', { username, password }),
    // The login answer has no role, the role endpoint is open to the player themself.
    role: (playerId) => get<RoleValue>(`/players/${playerId}/role`),
  },

  sessions: {
    summaries: () => analysis(() => get<SessionSummary[]>('/analysis/sessions'), 'overview', ['SES-01'], composedSummaries),
    get: (sessionId) => get<Session>(`/sessions/${sessionId}`),
    activeId: () => get<string>('/sessions/active/id'),
    drawings: (sessionId) => get<DrawingMeta[]>(`/sessions/${sessionId}/drawings`),
    create: (input) =>
      post<Session>('/sessions/', { ...sessionBody(input), activate: input.activate ?? true }),
    update: (sessionId, input) => put<Session>(`/sessions/${sessionId}`, { id: sessionId, ...sessionBody(input) }),
    activate: async (sessionId) => {
      await put(`/sessions/${sessionId}/activate`)
    },
    close: async (sessionId) => {
      await put(`/sessions/${sessionId}/close`)
    },
    remove: async (sessionId) => {
      await del(`/sessions/${sessionId}`)
    },
  },

  players: {
    info: (playerId) => get<PlayerInfo>(`/players/${playerId}/info`),
    async infos(playerIds) {
      const results = await Promise.allSettled(playerIds.map((id) => get<PlayerInfo>(`/players/${id}/info`)))
      return results.map((result) => (result.status === 'fulfilled' ? result.value : null))
    },
    async list() {
      const ids = await get<string[]>('/players/')
      return Promise.all(
        ids.map(async (id) => {
          const [info, role] = await Promise.all([
            get<PlayerInfo>(`/players/${id}/info`),
            get<RoleValue>(`/players/${id}/role`),
          ])
          return { id, info, role }
        }),
      )
    },
    drawings: (playerId) => get<DrawingMeta[]>(`/players/${playerId}/drawings`),
  },

  drawings: {
    get: (drawingId, ownerId) =>
      get<Drawing>(ownerId ? `/players/${ownerId}/drawings/${drawingId}` : `/drawings/${drawingId}`),
    meta: (drawingId) => get<DrawingMeta>(`/drawings/${drawingId}/meta`),
  },

  analysis: {
    overview: () =>
      analysis(
        () => get<Overview>('/analysis/overview'),
        'overview',
        ['DASH-03'],
        async () => buildOverview(await composedSummaries(), await get<string>('/sessions/active/id')),
      ),
    drawingsOverTime: () => analysis(() => get<TimePoint[]>('/analysis/over-time'), 'overTime', ['DASH-01', 'TEC-02']),
    recentDrawings: (limit) =>
      analysis(() => get<RecentDrawing[]>(`/analysis/drawings${query({ limit })}`), 'recentDrawings', ['DASH-02', 'TEC-02']),
    thumbnail: (drawingId) =>
      analysis(
        async () => URL.createObjectURL(await getBlob(`/analysis/drawings/${drawingId}/thumbnail`)),
        'thumbnails', ['SES-02', 'PLY-01', 'TEC-02'],
      ),
    geometry: (drawingId, tolerance) =>
      analysis(
        () => get<DrawingGeometry>(`/analysis/drawings/${drawingId}/geometry${query({ tolerance })}`),
        'metrics', ['DRW-03', 'TEC-02'],
        // An older server: the whole document, converted here (the viewer works, without the detail levels)
        async () => geometryFromDrawing(await get<Drawing>(`/drawings/${drawingId}`), tolerance),
      ),
    drawingAnalysis: (drawingId) =>
      analysis(() => get<DrawingAnalysis>(`/analysis/drawings/${drawingId}/metrics`), 'metrics', ['MET-01', 'DRW-04', 'TEC-02']),
    sessionStats: (sessionId) =>
      analysis(() => get<SessionStats>(`/analysis/sessions/${sessionId}/stats`), 'sessionStats', ['SES-03', 'TEC-02']),
    timeline: (drawingId, idleGapSeconds) =>
      analysis(
        () => get<TimelineData>(`/analysis/drawings/${drawingId}/timeline${query({ idleGap: idleGapSeconds })}`),
        'timeline', ['DRW-07', 'TEC-02'],
      ),
    tracking: (drawingId) =>
      analysis(() => get<TrackingData>(`/analysis/drawings/${drawingId}/tracking`), 'tracking', ['DRW-08', 'TEC-02']),
    heatmap: (drawingId, voxelSize) =>
      analysis(
        () => get<HeatmapData>(`/analysis/drawings/${drawingId}/heatmap${query({ voxelSize })}`),
        'heatmap', ['DRW-06', 'TEC-02'],
      ),
    multiplayer: (drawingId, proximity) =>
      analysis(
        () => get<MultiplayerData>(`/analysis/drawings/${drawingId}/multiplayer${query({ proximity })}`),
        'multiplayer', ['MUL-01', 'MUL-02', 'MUL-03', 'TEC-02'],
      ),
    cohort: (drawingId, filters: CohortFilters) =>
      analysis(
        () => get<CohortResult>(`/analysis/drawings/${drawingId}/cohort${query({ ...filters })}`),
        'cohort', ['CMP-03', 'TEC-02'],
      ),
    participantHistory: (playerId) =>
      analysis(() => get<ParticipantHistory>(`/analysis/participants/${playerId}/history`), 'history', ['PAR-01', 'CMP-02', 'TEC-02']),
    exportSessionCsv: (sessionId, dialect) =>
      analysis(() => getBlob(`/analysis/sessions/${sessionId}/export.csv${query({ dialect })}`), 'export', ['EXP-01', 'TEC-02']),
    exportDrawing: (drawingId, format, includeErased) =>
      analysis(
        () => getBlob(`/analysis/drawings/${drawingId}/export${query({ format, includeErased })}`),
        'export', ['EXP-03', 'TEC-02'],
      ),
    reports: () => analysis(() => get<ReportInfo[]>('/analysis/reports'), 'reports', ['REP-04', 'TEC-02', 'TEC-03']),
    createReport: (kind, targetId, regenerate = false) =>
      analysis(
        () => post<CreatedReport>('/analysis/reports', { kind, targetId, regenerate }),
        'reportGeneration', ['REP-01', 'TEC-02', 'TEC-05'],
      ),
    reportHtml: (reportId) =>
      analysis(() => getText(`/analysis/reports/${reportId}/html`), 'reports', ['REP-04', 'TEC-02', 'TEC-03']),
    deleteReport: async (reportId) => {
      await analysis(() => del(`/analysis/reports/${reportId}`), 'reports', ['REP-04', 'TEC-02', 'TEC-03'])
    },
  },
}
