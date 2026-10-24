import type { Api } from '../contract'
import { ApiError } from '../errors'
import { buildOverview } from '../overview'
import type {
  CreatedReport, Drawing, DrawingMeta, MetricId, PlayerInfo, ReportInfo, ReportKind, Session, SessionInput,
  SessionSummary,
} from '../types'
import i18n from '@/i18n'
import { geometryFromDrawing } from '@/lib/drawingGeometry'
import { metricCatalog } from '@/lib/metricCatalog'
import { toViewerStrokes } from '@/lib/strokes'
import { drawingSvg, svgDataUrl } from '@/lib/thumbnail'
import { analyzeDrawing, analyzeSession, buildNarrative, metricValues } from './analysisEngine'
import {
  analyzeMultiplayer, buildHeatmap, buildTimeline, compareWithCohort, historyRow, summarizeTracking,
} from './analytics'
import { exportDrawingFile, sessionCsv } from './exports'
import { DEMO_ADMIN, mockFeedback } from './feedback'
import { buildDrawingReport, buildParticipantReport, buildSessionReport } from './reportHtml'
import { DEFAULT_SESSION_ID } from '@/lib/sessions'
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

/** The feedback stand-in answers at once: this gives it the same little latency as the other demo calls. */
const after = <T>(ms: number, call: () => Promise<T>): Promise<T> => later(() => undefined, ms).then(call)

const notFound = (what: string) => new ApiError('http', 404, `${what} not found`)
const badRequest = (detail: string) => new ApiError('http', 400, detail)

function findDrawing(drawingId: string): Drawing {
  const drawing = getWorld().drawings.find((d) => d.metadata.id === drawingId)
  if (!drawing) throw notFound('Drawing')
  return drawing
}

function infoOf(id: string): PlayerInfo | undefined {
  return getWorld().players.find((p) => p.id === id)?.info ?? (id === DEMO_ADMIN.id ? DEMO_ADMIN.info : undefined)
}

function findSession(sessionId: string): Session {
  const session = getWorld().sessions.find((s) => s.id === sessionId)
  if (!session) throw notFound('Session')
  return session
}

/** The active session: a closed or deleted one falls back to the default session, like on the server. */
function activeSessionId(): string {
  const { sessions, activeSessionId: id } = getWorld()
  const active = sessions.find((s) => s.id === id)
  return active && !active.endDate ? id : DEFAULT_SESSION_ID
}

function summaries(): SessionSummary[] {
  const { sessions, metas } = getWorld()
  return sessions.map((session): SessionSummary => {
    const own = metas.filter((m) => m.sessionID === session.id)
    const gameTypeCounts: Record<number, number> = {}
    own.forEach((m) => { gameTypeCounts[m.gameType] = (gameTypeCounts[m.gameType] ?? 0) + 1 })
    return { ...session, drawingCount: own.length, participantIds: [...new Set(own.map((m) => m.playerID))], gameTypeCounts }
  })
}

function serverDate(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}-${p(now.getHours())}:${p(now.getMinutes())}`
}

let sessionCounter = 0

// --- Report store (in memory, like the server's file store would persist it) ---

interface StoredReport {
  info: ReportInfo
  html: string
}

let reportStore: StoredReport[] | null = null

function historyOf(playerId: string) {
  const world = getWorld()
  return world.drawings
    .filter((d) => d.metadata.owner === playerId)
    .map((d) => historyRow(d, world.metas.find((m) => m.id === d.metadata.id)!, world.sessions))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function generateReport(kind: ReportKind, targetId: string): { title: string; html: string } {
  const world = getWorld()
  if (kind === 'drawing') {
    const drawing = findDrawing(targetId)
    const meta = world.metas.find((m) => m.id === targetId)
    const owner = infoOf(drawing.metadata.owner)
    const title = `${meta?.name ?? targetId}${owner?.name ? ` (${owner.name})` : ''}`
    const session = world.sessions.find((s) => s.id === drawing.metadata.sessionID)
    const analysis = analyzeDrawing(drawing)
    return { title, html: buildDrawingReport(drawing, analysis, buildNarrative(analysis, owner?.dominantHand ?? null), title, owner, session) }
  }
  if (kind === 'participant') {
    const player = infoOf(targetId)
    if (!player) throw notFound('Player')
    return {
      title: i18n.t('report.participantTitle', { name: player.name ?? i18n.t('report.info.participant') }),
      html: buildParticipantReport(player, historyOf(targetId)),
    }
  }
  const session = findSession(targetId)
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
        const player = getWorld().players.find((p) => p.username === username) ?? (username === DEMO_ADMIN.username ? DEMO_ADMIN : undefined)
        if (!player || password !== 'demo') {
          throw new ApiError('http', 401, 'Invalid username or password.')
        }
        return { playerId: player.id, accessToken: `demo-token-${player.id}`, expiresIn: 12 * 3600 }
      }),
    role: (playerId) =>
      later(() => {
        const player = getWorld().players.find((p) => p.id === playerId) ?? (playerId === DEMO_ADMIN.id ? DEMO_ADMIN : undefined)
        if (!player) throw notFound('Player')
        return player.role
      }, 60),
  },

  sessions: {
    summaries: () => later(summaries),
    get: (sessionId) => later(() => findSession(sessionId), 80),
    activeId: () => later(activeSessionId, 60),
    drawings: (sessionId) => later(() => getWorld().metas.filter((m) => m.sessionID === sessionId), 100),

    // The same rules and messages as the server's session endpoints
    create: (input: SessionInput) =>
      later(() => {
        const world = getWorld()
        const session: Session = {
          id: `demo-session-new-${++sessionCounter}`, name: input.name, description: input.description || null,
          startDate: serverDate(), endDate: null,
          showBoy: input.showBoy ? 1 : 0, showGirl: input.showGirl ? 1 : 0, multiplayer: input.multiplayer ? 1 : 0,
        }
        world.sessions.push(session)
        if (input.activate ?? true) world.activeSessionId = session.id
        return session
      }, 300),
    update: (sessionId, input) =>
      later(() => {
        const session = findSession(sessionId)
        Object.assign(session, {
          name: input.name, description: input.description || null,
          showBoy: input.showBoy ? 1 : 0, showGirl: input.showGirl ? 1 : 0, multiplayer: input.multiplayer ? 1 : 0,
        })
        return { ...session }
      }, 300),
    activate: (sessionId) =>
      later(() => {
        const session = findSession(sessionId)
        if (session.endDate) throw badRequest('A closed session cannot be activated')
        getWorld().activeSessionId = sessionId
      }, 200),
    close: (sessionId) =>
      later(() => {
        if (sessionId === DEFAULT_SESSION_ID) throw badRequest('The default session cannot be closed')
        const session = getWorld().sessions.find((s) => s.id === sessionId)
        if (!session || session.endDate) throw badRequest('Session not found or already closed')
        session.endDate = serverDate()
      }, 200),
    remove: (sessionId) =>
      later(() => {
        const world = getWorld()
        findSession(sessionId)
        if (world.metas.some((m) => m.sessionID === sessionId)) {
          throw badRequest('Cannot delete a session that still has drawings or an active room linked to it.')
        }
        world.sessions = world.sessions.filter((s) => s.id !== sessionId)
      }, 200),
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
    overview: () => later(() => buildOverview(summaries(), activeSessionId())),
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
        const { metas, drawings, sessions } = getWorld()
        const items = metas
          .map((meta, i) => ({
            meta,
            playerName: infoOf(meta.playerID)?.name ?? meta.playerID,
            sessionName: sessions.find((s) => s.id === meta.sessionID)?.name ?? meta.sessionID,
            date: drawings[i].metadata.date,
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
        return limit ? items.slice(0, limit) : items
      }),
    thumbnail: (drawingId) =>
      later(() => svgDataUrl(drawingSvg(toViewerStrokes(geometryFromDrawing(findDrawing(drawingId))), 'front')), 120),
    geometry: (drawingId, tolerance) => later(() => geometryFromDrawing(findDrawing(drawingId), tolerance), 200),
    drawingAnalysis: (drawingId) =>
      later(() => {
        const drawing = findDrawing(drawingId)
        const analysis = analyzeDrawing(drawing)
        return { ...analysis, narrative: buildNarrative(analysis, infoOf(drawing.metadata.owner)?.dominantHand ?? null) }
      }, 300),
    sessionStats: (sessionId) =>
      later(() => analyzeSession(sessionId, getWorld().drawings.filter((d) => d.metadata.sessionID === sessionId)), 350),
    timeline: (drawingId, idleGapSeconds) => later(() => buildTimeline(findDrawing(drawingId), idleGapSeconds), 250),
    tracking: (drawingId) => later(() => summarizeTracking(findDrawing(drawingId)), 250),
    heatmap: (drawingId, voxelSize) => later(() => buildHeatmap(findDrawing(drawingId), voxelSize), 250),
    multiplayer: (drawingId, proximity) => later(() => analyzeMultiplayer(findDrawing(drawingId), proximity), 250),
    cohort: (drawingId, filters) =>
      later(() => {
        const { drawings } = getWorld()
        const subject = metricValues(analyzeDrawing(findDrawing(drawingId)))
        const members = drawings.filter((d) => {
          if (d.metadata.id === drawingId) return false
          if (filters.sessionId !== undefined && d.metadata.sessionID !== filters.sessionId) return false
          if (filters.gameType !== undefined && d.metadata.gameType !== filters.gameType) return false
          const age = infoOf(d.metadata.owner)?.age
          if (filters.ageMin !== undefined && (age == null || age < filters.ageMin)) return false
          if (filters.ageMax !== undefined && (age == null || age > filters.ageMax)) return false
          return true
        })
        return compareWithCohort(drawingId, filters, subject, members.map((d) => metricValues(analyzeDrawing(d))))
      }, 300),
    participantHistory: (playerId) =>
      later(() => {
        const player = infoOf(playerId)
        if (!player) throw notFound('Player')
        return { playerId, player, drawings: historyOf(playerId) }
      }, 250),
    exportSessionCsv: (sessionId, dialect) =>
      later(() => {
        const world = getWorld()
        const session = findSession(sessionId)
        const rows = world.drawings
          .filter((d) => d.metadata.sessionID === sessionId)
          .map((d) => {
            const meta = world.metas.find((m) => m.id === d.metadata.id)!
            const info = infoOf(d.metadata.owner)
            const values = metricValues(analyzeDrawing(d))
            return {
              drawingId: meta.id, drawingName: meta.name, sessionId, sessionName: session.name,
              gameType: i18n.t(`gameTypes.${d.metadata.gameType as 0 | 1 | 2 | 3 | 4 | 5}`), date: d.metadata.date,
              participantId: d.metadata.owner, participantName: info?.name, age: info?.age, gender: info?.gender,
              dominantHand: info?.dominantHand,
              ...Object.fromEntries(metricCatalog.map((m) => [m.id, values[m.id as MetricId]])),
            }
          })
        return sessionCsv(rows, dialect)
      }, 300),
    exportDrawing: (drawingId, format, includeErased) =>
      later(() => exportDrawingFile(findDrawing(drawingId), format, includeErased), 300),

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

  // Questionnaires, messages and the admin dashboard (requirements FBK-*, ADM-*)
  feedback: {
    instruments: () => after(80, () => mockFeedback.feedback.instruments()),
    sendQuestionnaire: (input) => after(250, () => mockFeedback.feedback.sendQuestionnaire(input)),
    sendMessage: (input) => after(250, () => mockFeedback.feedback.sendMessage(input)),
    mine: (limit, offset) => after(120, () => mockFeedback.feedback.mine(limit, offset)),
  },
  admin: {
    usage: () => after(150, () => mockFeedback.admin.usage()),
    questionnaireResults: (filters) => after(250, () => mockFeedback.admin.questionnaireResults(filters)),
    messages: (filters, limit, offset) => after(150, () => mockFeedback.admin.messages(filters, limit, offset)),
    setMessageRead: (messageId, read) => after(100, () => mockFeedback.admin.setMessageRead(messageId, read)),
    deleteMessage: (messageId) => after(100, () => mockFeedback.admin.deleteMessage(messageId)),
    exportQuestionnaires: (instrument, dialect, filters) =>
      after(250, () => mockFeedback.admin.exportQuestionnaires(instrument, dialect, filters)),
    exportMessages: (dialect, filters) => after(250, () => mockFeedback.admin.exportMessages(dialect, filters)),
  },
}
