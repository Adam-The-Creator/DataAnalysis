import type { Api } from './contract'
import { notImplemented } from './errors'
import { get, post } from './http'
import type {
  Drawing, DrawingMeta, LoginResult, PlayerInfo, RoleValue, Session, SessionSummary,
} from './types'

/**
 * Client of the real DatabaseServer. It only uses endpoints that exist today.
 * Note the trailing slashes on the collection URLs: without them FastAPI answers with a redirect.
 */

async function sessionSummary(session: Session): Promise<SessionSummary> {
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
}

export const liveApi: Api = {
  auth: {
    login: (username, password) => post<LoginResult>('/auth/login', { username, password }),
    // The login answer has no role, the role endpoint is open to the player themself.
    role: (playerId) => get<RoleValue>(`/players/${playerId}/role`),
  },

  sessions: {
    // TEMPORARY: one request per session. The analysis API will return this in one call (SES-01, FUT-08).
    async summaries() {
      const ids = await get<string[]>('/sessions/')
      const sessions = await Promise.all(ids.map((id) => get<Session>(`/sessions/${id}`)))
      return Promise.all(sessions.map(sessionSummary))
    },
    get: (sessionId) => get<Session>(`/sessions/${sessionId}`),
    activeId: () => get<string>('/sessions/active/id'),
    drawings: (sessionId) => get<DrawingMeta[]>(`/sessions/${sessionId}/drawings`),
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
    drawingsOverTime: async () => notImplemented('overTime', 'DASH-01', 'TEC-02'),
    recentDrawings: async () => notImplemented('recentDrawings', 'DASH-02', 'TEC-02'),
    thumbnail: async () => notImplemented('thumbnails', 'SES-02', 'PLY-01', 'TEC-02'),
    drawingAnalysis: async () => notImplemented('metrics', 'MET-01', 'DRW-04', 'TEC-02'),
    sessionStats: async () => notImplemented('sessionStats', 'SES-03', 'TEC-02'),
    reports: async () => notImplemented('reports', 'REP-04', 'TEC-02', 'TEC-03'),
    createReport: async () => notImplemented('reportGeneration', 'REP-01', 'TEC-02', 'TEC-05'),
    reportHtml: async () => notImplemented('reports', 'REP-04', 'TEC-02', 'TEC-03'),
    deleteReport: async () => notImplemented('reports', 'REP-04', 'TEC-02', 'TEC-03'),
  },
}
