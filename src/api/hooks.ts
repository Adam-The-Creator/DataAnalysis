import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApi } from '.'
import { buildOverview } from './overview'
import type { ReportKind } from './types'

/** Query hooks: the only place where screens talk to the API. Each one is a thin wrapper around getApi(). */

export const useSessionSummaries = () =>
  useQuery({ queryKey: ['sessions', 'summaries'], queryFn: () => getApi().sessions.summaries() })

export const useActiveSessionId = () =>
  useQuery({ queryKey: ['sessions', 'active'], queryFn: () => getApi().sessions.activeId() })

export const useOverview = () =>
  useQuery({
    queryKey: ['overview'],
    queryFn: async () => {
      const api = getApi()
      const [summaries, activeId] = await Promise.all([api.sessions.summaries(), api.sessions.activeId()])
      return buildOverview(summaries, activeId)
    },
  })

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

export function useSessionsByIds(sessionIds: string[]) {
  const ids = [...new Set(sessionIds)].sort()
  return useQuery({
    queryKey: ['sessions', 'byIds', ids.join(',')],
    queryFn: () => Promise.all(ids.map((id) => getApi().sessions.get(id))),
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

export const useDrawing = (drawingId: string | undefined, ownerId?: string) =>
  useQuery({
    queryKey: ['drawings', drawingId, ownerId ?? null],
    queryFn: () => getApi().drawings.get(drawingId!, ownerId),
    enabled: !!drawingId,
  })

export const useDrawingMeta = (drawingId: string | undefined) =>
  useQuery({
    queryKey: ['drawings', drawingId, 'meta'],
    queryFn: () => getApi().drawings.meta(drawingId!),
    enabled: !!drawingId,
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

export const useDrawingsOverTime = () =>
  useQuery({ queryKey: ['analysis', 'overTime'], queryFn: () => getApi().analysis.drawingsOverTime() })

export const useRecentDrawings = (limit: number) =>
  useQuery({ queryKey: ['analysis', 'recent', limit], queryFn: () => getApi().analysis.recentDrawings(limit) })

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
