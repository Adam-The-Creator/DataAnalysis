import type { Api } from './contract'
import { ApiError, notImplemented, type FeatureId } from './errors'
import { del, get, getBlob, getText, post, put } from './http'
import { buildOverview } from './overview'
import type {
  AdminMessage, AiDrawingCohort, AiGroups, AiHeavyState, AiIndicators, AiInsights, AiJob, AiModelEntry, AiOutput, AiRulesInfo,
  AiSessionCohort, AiStatusInfo, AiVocabularyInfo, CohortFilters, CohortResult, CreatedReport, Drawing, DrawingAnalysis,
  DrawingGeometry, DrawingMeta,
  HeatmapData, InstrumentDefinition, LoginResult, MessagePage, MultiplayerData, MySubmissions, Overview,
  ParticipantHistory, PlayerInfo, QuestionnaireResults, RecentDrawing, ReportInfo, RoleValue, Session, SessionInput,
  SessionStats, SessionSummary, SubmissionReceipt, TimePoint, TimelineData, TrackingData, UsageNumbers,
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
    updateInfo: async (playerId, input) => {
      await put(`/players/${playerId}/info`, input)
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

  // A server build without the AI module answers "Not Found": the screens show a "not implemented" panel
  ai: {
    status: () => analysis(() => get<AiStatusInfo>('/ai/status'), 'ai', ['AI-03', 'AI-06']),
    models: () => analysis(() => get<AiModelEntry[]>('/ai/models'), 'ai', ['AI-06']),
    downloadModel: (modelId) => analysis(() => post<AiJob>(`/ai/models/${modelId}/download`, {}), 'ai', ['AI-06']),
    jobs: () => analysis(() => get<AiJob[]>('/ai/jobs'), 'ai', ['AI-02']),
    rules: () => analysis(() => get<AiRulesInfo>('/ai/rules'), 'ai', ['AI-14']),
    vocabulary: () => analysis(() => get<AiVocabularyInfo>('/ai/vocabulary'), 'ai', ['AI-12']),
    drawingCohort: (drawingId, scope, ageMin, ageMax) =>
      analysis(() => get<AiOutput<AiDrawingCohort>>(`/ai/drawings/${drawingId}/cohort${query({ scope, ageMin, ageMax })}`), 'ai', ['AI-10']),
    drawingGroups: (drawingId) =>
      analysis(() => get<AiOutput<AiGroups>>(`/ai/drawings/${drawingId}/groups`), 'ai', ['AI-11']),
    drawingIndicators: (drawingId, scope, ageMin, ageMax) =>
      analysis(() => get<AiOutput<AiIndicators>>(`/ai/drawings/${drawingId}/indicators${query({ scope, ageMin, ageMax })}`), 'ai', ['AI-14']),
    sessionCohort: (sessionId) =>
      analysis(() => get<AiOutput<AiSessionCohort>>(`/ai/sessions/${sessionId}/cohort`), 'ai', ['AI-10']),
    sessionInsights: (sessionId) =>
      analysis(() => get<AiOutput<AiInsights>>(`/ai/sessions/${sessionId}/insights`), 'ai', ['AI-15']),
    heavy: (drawingId, feature) =>
      analysis(() => get<AiHeavyState<never>>(`/ai/drawings/${drawingId}/${feature}`), 'ai', ['AI-12', 'AI-13', 'AI-16']),
    startHeavy: (drawingId, feature, regenerate = false) =>
      analysis(() => post<AiHeavyState<never>>(`/ai/drawings/${drawingId}/${feature}`, { regenerate }), 'ai', ['AI-12', 'AI-13', 'AI-16']),
    discardHeavy: async (drawingId, feature) => {
      await analysis(() => del(`/ai/drawings/${drawingId}/${feature}`), 'ai', ['AI-12', 'AI-13', 'AI-16'])
    },
    cancelJob: (jobId) => analysis(() => post<AiJob>(`/ai/jobs/${jobId}/cancel`, {}), 'ai', ['AI-02']),
    viewImage: (drawingId, view, groupId) =>
      analysis(
        async () => URL.createObjectURL(await getBlob(`/ai/drawings/${drawingId}/views/${view}.png${query({ groupId })}`)),
        'ai', ['AI-04'],
      ),
  },

  // A server build without the feedback module answers "Not Found": the screens show a "not implemented" panel
  feedback: {
    instruments: () => analysis(() => get<InstrumentDefinition[]>('/feedback/instruments'), 'feedback', ['FBK-01', 'TEC-13']),
    sendQuestionnaire: (input) =>
      analysis(() => post<SubmissionReceipt>('/feedback/questionnaires', input), 'feedback', ['FBK-10', 'FBK-11', 'TEC-13']),
    sendMessage: (input) =>
      analysis(() => post<SubmissionReceipt>('/feedback/messages', input), 'feedback', ['FBK-20', 'TEC-13']),
    mine: (limit, offset) =>
      analysis(() => get<MySubmissions>(`/feedback/mine${query({ limit, offset })}`), 'feedback', ['FBK-04', 'TEC-13']),
  },

  admin: {
    usage: () => analysis(() => get<UsageNumbers>('/admin/usage'), 'admin', ['ADM-05', 'TEC-13']),
    questionnaireResults: (filters) =>
      analysis(
        () => get<QuestionnaireResults>(`/admin/questionnaires/results${query({ ...filters })}`),
        'admin', ['ADM-06', 'ADM-07', 'ADM-08', 'TEC-13'],
      ),
    messages: (filters, limit, offset) =>
      analysis(() => get<MessagePage>(`/admin/messages${query({ ...filters, limit, offset })}`), 'admin', ['ADM-11', 'TEC-13']),
    // PUT, not PATCH: the server's CORS setting only allows GET, POST, PUT and DELETE
    setMessageRead: (messageId, read) =>
      analysis(() => put<AdminMessage>(`/admin/messages/${messageId}/read`, { read }), 'admin', ['ADM-11', 'TEC-13']),
    deleteMessage: async (messageId) => {
      await analysis(() => del(`/admin/messages/${messageId}`), 'admin', ['ADM-11', 'TEC-13'])
    },
    exportQuestionnaires: (instrument, dialect, filters) =>
      analysis(
        () => getBlob(`/admin/export/questionnaires${query({ ...filters, instrument, dialect })}`),
        'admin', ['ADM-13', 'TEC-13'],
      ),
    exportMessages: (dialect, filters) =>
      analysis(() => getBlob(`/admin/export/messages${query({ ...filters, dialect })}`), 'admin', ['ADM-13', 'TEC-13']),
  },
}
