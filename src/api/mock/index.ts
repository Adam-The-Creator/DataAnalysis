import type { Api } from '../contract'
import { ApiError } from '../errors'
import type { CreatedReport, Drawing, DrawingMeta, PlayerInfo, ReportInfo, ReportKind, SessionSummary } from '../types'
import { toViewerStrokes } from '@/lib/strokes'
import { drawingSvg, svgDataUrl } from '@/lib/thumbnail'
import { analyzeDrawing, analyzeSession } from './analysisEngine'
import { buildDrawingReport, buildSessionReport } from './reportHtml'
import { getWorld } from './world'

/** Demo client: answers from generated data and simulates the analysis module. Needs no server. */

/** A little latency, so the loading states are visible and the demo behaves like a network. */
function later<T>(compute: () => T, ms = 180): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(compute())
      } catch (error) {
        reject(error)
      }
    }, ms)
  })
}

const notFound = (what: string) => new ApiError('http', 404, `${what} not found`)

function findDrawing(drawingId: string): Drawing {
  const drawing = getWorld().drawings.find((d) => d.metadata.id === drawingId)
  if (!drawing) throw notFound('Drawing')
  return drawing
}

function infoOf(id: string): PlayerInfo | undefined {
  return getWorld().players.find((p) => p.id === id)?.info
}

// --- Report store (in memory, like the server's file store would persist it) ---

interface StoredReport {
  info: ReportInfo
  html: string
}

let reportStore: StoredReport[] | null = null

function generateReport(kind: ReportKind, targetId: string): { title: string; html: string } {
  const world = getWorld()
  if (kind === 'drawing') {
    const drawing = findDrawing(targetId)
    const meta = world.metas.find((m) => m.id === targetId)
    const owner = infoOf(drawing.metadata.owner)
    const title = `${meta?.name ?? targetId}${owner?.name ? ` (${owner.name})` : ''}`
    const session = world.sessions.find((s) => s.id === drawing.metadata.sessionID)
    return { title, html: buildDrawingReport(drawing, analyzeDrawing(drawing), title, owner, session) }
  }
  const session = world.sessions.find((s) => s.id === targetId)
  if (!session) throw notFound('Session')
  const drawings = world.drawings.filter((d) => d.metadata.sessionID === targetId)
  const players = new Map(world.players.map((p) => [p.id, p.info]))
  return { title: session.name, html: buildSessionReport(session, analyzeSession(targetId, drawings), players) }
}

function reports(): StoredReport[] {
  if (!reportStore) {
    const world = getWorld()
    const seeds: [ReportKind, string, boolean][] = [
      ['drawing', world.metas[0].id, false],
      ['session', world.sessions[1].id, true], // shows the "stale" state
    ]
    reportStore = seeds.map(([kind, targetId, stale], i) => {
      const { title, html } = generateReport(kind, targetId)
      const createdAt = new Date(Date.now() - (i + 1) * 36 * 3600_000).toISOString()
      return { info: { id: `demo-report-${i + 1}`, kind, targetId, title, createdAt, stale }, html }
    })
  }
  return reportStore
}

// --- Api ---

export const mockApi: Api = {
  auth: {
    login: (username, password) =>
      later(() => {
        const player = getWorld().players.find((p) => p.username === username)
        if (!player || password !== 'demo') {
          throw new ApiError('http', 401, 'Invalid username or password.')
        }
        return { playerId: player.id, accessToken: `demo-token-${player.id}`, expiresIn: 12 * 3600 }
      }),
    role: (playerId) =>
      later(() => {
        const player = getWorld().players.find((p) => p.id === playerId)
        if (!player) throw notFound('Player')
        return player.role
      }, 60),
  },

  sessions: {
    summaries: () =>
      later(() => {
        const { sessions, metas } = getWorld()
        return sessions.map((session): SessionSummary => {
          const own = metas.filter((m) => m.sessionID === session.id)
          const gameTypeCounts: Record<number, number> = {}
          own.forEach((m) => { gameTypeCounts[m.gameType] = (gameTypeCounts[m.gameType] ?? 0) + 1 })
          return { ...session, drawingCount: own.length, participantIds: [...new Set(own.map((m) => m.playerID))], gameTypeCounts }
        })
      }),
    get: (sessionId) =>
      later(() => {
        const session = getWorld().sessions.find((s) => s.id === sessionId)
        if (!session) throw notFound('Session')
        return session
      }, 80),
    activeId: () => later(() => getWorld().activeSessionId, 60),
    drawings: (sessionId) => later(() => getWorld().metas.filter((m) => m.sessionID === sessionId), 100),
  },

  players: {
    info: (playerId) =>
      later(() => {
        const info = infoOf(playerId)
        if (!info) throw notFound('Player')
        return info
      }, 60),
    infos: (playerIds) => later(() => playerIds.map((id) => infoOf(id) ?? null), 80),
    list: () => later(() => getWorld().players.map((p) => ({ id: p.id, role: p.role, info: p.info }))),
    drawings: (playerId) => later(() => getWorld().metas.filter((m): m is DrawingMeta => m.playerID === playerId), 100),
  },

  drawings: {
    get: (drawingId, ownerId) =>
      later(() => {
        const drawing = findDrawing(drawingId)
        if (ownerId && drawing.metadata.owner !== ownerId) {
          throw notFound('Drawing') // same answer as the server's player-scoped endpoint
        }
        return drawing
      }, 250),
    meta: (drawingId) =>
      later(() => {
        const meta = getWorld().metas.find((m) => m.id === drawingId)
        if (!meta) throw notFound('Drawing')
        return meta
      }, 60),
  },

  analysis: {
    drawingsOverTime: () =>
      later(() => {
        const perDay = new Map<string, number>()
        for (const { metadata } of getWorld().drawings) {
          const day = metadata.date.slice(0, 10)
          perDay.set(day, (perDay.get(day) ?? 0) + 1)
        }
        return [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
      }),
    recentDrawings: (limit) =>
      later(() => {
        const { metas, drawings } = getWorld()
        return metas
          .map((meta, i) => ({ meta, playerName: infoOf(meta.playerID)?.name ?? meta.playerID, date: drawings[i].metadata.date }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, limit)
      }),
    thumbnail: (drawingId) => later(() => svgDataUrl(drawingSvg(toViewerStrokes(findDrawing(drawingId)), 'front')), 120),
    drawingAnalysis: (drawingId) => later(() => analyzeDrawing(findDrawing(drawingId)), 300),
    sessionStats: (sessionId) =>
      later(() => analyzeSession(sessionId, getWorld().drawings.filter((d) => d.metadata.sessionID === sessionId)), 350),

    reports: () => later(() => reports().map((r) => r.info).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    createReport: (kind, targetId, regenerate = false) =>
      later((): CreatedReport => {
        const store = reports()
        const existing = store.find((r) => r.info.kind === kind && r.info.targetId === targetId)
        if (existing && !regenerate && !existing.info.stale) {
          return { report: existing.info, reused: true } // the stored report is reused (REP-04)
        }
        const { title, html } = generateReport(kind, targetId)
        const createdAt = new Date().toISOString()
        if (existing) {
          existing.info = { ...existing.info, title, createdAt, stale: false }
          existing.html = html
          return { report: existing.info, reused: false }
        }
        const info: ReportInfo = { id: `demo-report-${store.length + 1}-${Date.now()}`, kind, targetId, title, createdAt, stale: false }
        store.push({ info, html })
        return { report: info, reused: false }
      }, 700),
    reportHtml: (reportId) =>
      later(() => {
        const report = reports().find((r) => r.info.id === reportId)
        if (!report) throw notFound('Report')
        return report.html
      }, 100),
    deleteReport: (reportId) =>
      later(() => {
        reportStore = reports().filter((r) => r.info.id !== reportId)
      }, 100),
  },
}
