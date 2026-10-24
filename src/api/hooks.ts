import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApi } from '.'
import type { CohortFilters, ReportKind, SessionInput } from './types'

/** Query hooks: the only place where screens talk to the API. Each one is a thin wrapper around getApi(). */

// --- Sessions ---

export const useSessionSummaries = () =>
  useQuery({ queryKey: ['sessions', 'summaries'], queryFn: () => getApi().sessions.summaries() })

export const useActiveSessionId = () =>
  useQuery({ queryKey: ['sessions', 'active'], queryFn: () => getApi().sessions.activeId() })

export const useOverview = () =>
  useQuery({ queryKey: ['overview'], queryFn: () => getApi().analysis.overview() })

export const useSession = (sessionId: string | undefined) =>
  useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => getApi().sessions.get(sessionId!),
    enabled: !!sessionId,
  })

export const useSessionDrawings = (sessionId: string | undefined) =>
  useQuery({
    queryKey: ['sessions', sessionId, 'drawings'],
    queryFn: () => getApi().sessions.drawings(sessionId!),
    enabled: !!sessionId,
  })

export const useSessionStats = (sessionId: string | undefined) =>
  useQuery({
    queryKey: ['sessions', sessionId, 'stats'],
    queryFn: () => getApi().analysis.sessionStats(sessionId!),
    enabled: !!sessionId,
  })

export function useSessionsByIds(sessionIds: string[]) {
  const ids = [...new Set(sessionIds)].sort()
  return useQuery({
    queryKey: ['sessions', 'byIds', ids.join(',')],
    queryFn: () => Promise.all(ids.map((id) => getApi().sessions.get(id))),
    enabled: ids.length > 0,
  })
}

/** Everything that depends on the sessions is refetched after a change (SES-05). */
function useInvalidateSessions() {
  const queryClient = useQueryClient()
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    queryClient.invalidateQueries({ queryKey: ['overview'] }),
    queryClient.invalidateQueries({ queryKey: ['analysis'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ])
}

export function useCreateSession() {
  const invalidate = useInvalidateSessions()
  return useMutation({ mutationFn: (input: SessionInput) => getApi().sessions.create(input), onSuccess: invalidate })
}

export function useUpdateSession(sessionId: string) {
  const invalidate = useInvalidateSessions()
  return useMutation({ mutationFn: (input: SessionInput) => getApi().sessions.update(sessionId, input), onSuccess: invalidate })
}

/**
 * Activate, close or delete a session. After a delete the screen leaves through onRemoved, and what is cached about
 * the deleted session is dropped instead of refetched: the refetch would only answer "not found" and flash an error
 * on the page that is being left.
 */
export function useSessionAction(sessionId: string, onRemoved?: () => void) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateSessions()
  return useMutation({
    mutationFn: (action: 'activate' | 'close' | 'remove') => getApi().sessions[action](sessionId),
    onSuccess: async (_result, action) => {
      if (action === 'remove') {
        onRemoved?.()
        queryClient.removeQueries({ queryKey: ['sessions', sessionId] })
      }
      await invalidate()
    },
  })
}

// --- Players ---

/** Player infos by player ID. A null value means the info could not be read. */
export function usePlayerInfos(playerIds: string[]) {
  const ids = [...new Set(playerIds)].sort()
  return useQuery({
    queryKey: ['players', 'infos', ids.join(',')],
    queryFn: async () => {
      const infos = await getApi().players.infos(ids)
      return new Map(ids.map((id, i) => [id, infos[i]] as const))
    },
    enabled: ids.length > 0,
  })
}

export const usePlayerList = () =>
  useQuery({ queryKey: ['players', 'list'], queryFn: () => getApi().players.list() })

export const usePlayerDrawings = (playerId: string | undefined) =>
  useQuery({
    queryKey: ['players', playerId, 'drawings'],
    queryFn: () => getApi().players.drawings(playerId!),
    enabled: !!playerId,
  })

export const useParticipantHistory = (playerId: string | undefined) =>
  useQuery({
    queryKey: ['analysis', 'history', playerId],
    queryFn: () => getApi().analysis.participantHistory(playerId!),
    enabled: !!playerId,
  })

// --- Drawings ---

export const useDrawingMeta = (drawingId: string | undefined) =>
  useQuery({
    queryKey: ['drawings', drawingId, 'meta'],
    queryFn: () => getApi().drawings.meta(drawingId!),
    enabled: !!drawingId,
  })

/** The strokes for the viewer. A different detail level (tolerance) is a different query. */
export const useGeometry = (drawingId: string | undefined, tolerance: number) =>
  useQuery({
    queryKey: ['drawings', drawingId, 'geometry', tolerance],
    queryFn: () => getApi().analysis.geometry(drawingId!, tolerance),
    enabled: !!drawingId,
    placeholderData: (previous) => previous, // the previous detail level stays on screen while the new one loads
  })

export const useDrawingAnalysis = (drawingId: string | undefined) =>
  useQuery({
    queryKey: ['drawings', drawingId, 'analysis'],
    queryFn: () => getApi().analysis.drawingAnalysis(drawingId!),
    enabled: !!drawingId,
  })

export const useThumbnail = (drawingId: string) =>
  useQuery({
    queryKey: ['drawings', drawingId, 'thumbnail'],
    queryFn: () => getApi().analysis.thumbnail(drawingId),
    staleTime: Infinity,
  })

export const useTimeline = (drawingId: string | undefined, idleGapSeconds: number) =>
  useQuery({
    queryKey: ['analysis', 'timeline', drawingId, idleGapSeconds],
    queryFn: () => getApi().analysis.timeline(drawingId!, idleGapSeconds),
    enabled: !!drawingId,
    placeholderData: (previous) => previous,
  })

export const useTracking = (drawingId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ['analysis', 'tracking', drawingId],
    queryFn: () => getApi().analysis.tracking(drawingId!),
    enabled: !!drawingId && enabled,
  })

export const useHeatmap = (drawingId: string | undefined, voxelSize: number, enabled = true) =>
  useQuery({
    queryKey: ['analysis', 'heatmap', drawingId, voxelSize],
    queryFn: () => getApi().analysis.heatmap(drawingId!, voxelSize),
    enabled: !!drawingId && enabled,
    placeholderData: (previous) => previous,
  })

export const useMultiplayer = (drawingId: string | undefined, proximity: number, enabled = true) =>
  useQuery({
    queryKey: ['analysis', 'multiplayer', drawingId, proximity],
    queryFn: () => getApi().analysis.multiplayer(drawingId!, proximity),
    enabled: !!drawingId && enabled,
    placeholderData: (previous) => previous,
  })

export const useCohort = (drawingId: string | undefined, filters: CohortFilters) =>
  useQuery({
    queryKey: ['analysis', 'cohort', drawingId, filters],
    queryFn: () => getApi().analysis.cohort(drawingId!, filters),
    enabled: !!drawingId,
    placeholderData: (previous) => previous,
  })

// --- Dashboard and lists ---

export const useDrawingsOverTime = () =>
  useQuery({ queryKey: ['analysis', 'overTime'], queryFn: () => getApi().analysis.drawingsOverTime() })

/** Without a limit: every drawing, newest first. */
export const useRecentDrawings = (limit?: number) =>
  useQuery({ queryKey: ['analysis', 'recent', limit ?? 'all'], queryFn: () => getApi().analysis.recentDrawings(limit) })

// --- Reports ---

export const useReports = () =>
  useQuery({ queryKey: ['reports'], queryFn: () => getApi().analysis.reports() })

export function useCreateReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { kind: ReportKind; targetId: string; regenerate?: boolean }) =>
      getApi().analysis.createReport(args.kind, args.targetId, args.regenerate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useDeleteReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reportId: string) => getApi().analysis.deleteReport(reportId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  })
}
