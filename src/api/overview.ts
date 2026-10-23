import type { Overview, SessionSummary } from './types'

/**
 * TEMPORARY: builds the dashboard overview on the client from the session summaries. The analysis API will return
 * it from one server side call (requirement DASH-03), and this function can then be deleted.
 */
export function buildOverview(summaries: SessionSummary[], activeSessionId: string): Overview {
  const byGameType = new Map<number, number>()
  for (const summary of summaries) {
    for (const [gameType, count] of Object.entries(summary.gameTypeCounts)) {
      byGameType.set(Number(gameType), (byGameType.get(Number(gameType)) ?? 0) + count)
    }
  }
  const open = summaries.filter((s) => !s.endDate).length

  return {
    sessions: { total: summaries.length, open, closed: summaries.length - open },
    drawings: summaries.reduce((sum, s) => sum + s.drawingCount, 0),
    participants: new Set(summaries.flatMap((s) => s.participantIds)).size,
    activeSession: summaries.find((s) => s.id === activeSessionId) ?? null,
    drawingsByGameType: [...byGameType.entries()]
      .map(([gameType, count]) => ({ gameType, count }))
      .sort((a, b) => a.gameType - b.gameType),
    // "yyyy.MM.dd-HH:mm" sorts correctly as text
    recentSessions: [...summaries].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5),
  }
}
