import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApi } from '.'
import type {
  AiHeavyFeature, AiJob, AiScope, AiView, CohortFilters, MessageFilters, MessageInput, PlayerInfoInput,
  QuestionnaireInput, ReportKind, ResultFilters, SessionInput,
} from './types'

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

/**
 * A player saves their own info. Everything that was read from it is refetched: the info cards, and the feedback page,
 * which picks the questionnaire by the player's age.
 */
export function useUpdateMyInfo(playerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlayerInfoInput) => getApi().players.updateInfo(playerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
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

// --- Feedback and questionnaires (requirements FBK-*) ---

/** The questionnaires: the version, the scale and the item IDs. They only change with a new version of the server. */
export const useInstruments = () =>
  useQuery({ queryKey: ['feedback', 'instruments'], queryFn: () => getApi().feedback.instruments(), staleTime: Infinity })

export const useMySubmissions = (limit: number, offset: number) =>
  useQuery({
    queryKey: ['feedback', 'mine', limit, offset],
    queryFn: () => getApi().feedback.mine(limit, offset),
    placeholderData: (previous) => previous,
  })

export function useSendQuestionnaire() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: QuestionnaireInput) => getApi().feedback.sendQuestionnaire(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback', 'mine'] }),
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MessageInput) => getApi().feedback.sendMessage(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback', 'mine'] }),
  })
}

// --- Admin dashboard (requirements ADM-*) ---

export const useUsage = () => useQuery({ queryKey: ['admin', 'usage'], queryFn: () => getApi().admin.usage() })

export const useQuestionnaireResults = (filters: ResultFilters) =>
  useQuery({
    queryKey: ['admin', 'results', filters],
    queryFn: () => getApi().admin.questionnaireResults(filters),
    placeholderData: (previous) => previous,
  })

export const useAdminMessages = (filters: MessageFilters, limit: number, offset: number) =>
  useQuery({
    queryKey: ['admin', 'messages', filters, limit, offset],
    queryFn: () => getApi().admin.messages(filters, limit, offset),
    placeholderData: (previous) => previous,
  })

/** Marking a message read or deleting it changes the list and the numbers on the dashboard. */
function useInvalidateMessages() {
  const queryClient = useQueryClient()
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin', 'messages'] }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] }),
  ])
}

export function useSetMessageRead() {
  const invalidate = useInvalidateMessages()
  return useMutation({
    mutationFn: (args: { messageId: string; read: boolean }) => getApi().admin.setMessageRead(args.messageId, args.read),
    onSuccess: invalidate,
  })
}

export function useDeleteMessage() {
  const invalidate = useInvalidateMessages()
  return useMutation({ mutationFn: (messageId: string) => getApi().admin.deleteMessage(messageId), onSuccess: invalidate })
}

// --- AI decision support (requirements AI-*) ---

const isActive = (job: AiJob | null | undefined) => job?.status === 'queued' || job?.status === 'running'

export const useAiStatus = () => useQuery({ queryKey: ['ai', 'status'], queryFn: () => getApi().ai.status() })

/** The model list. While a download runs it is refreshed, so the new status appears when the download is done. */
export const useAiModels = () =>
  useQuery({
    queryKey: ['ai', 'models'],
    queryFn: () => getApi().ai.models(),
    refetchInterval: (query) => (query.state.data?.some((m) => m.status === 'notDownloaded') ? 4000 : false),
  })

/** The background jobs, followed every second while one of them is active. */
export const useAiJobs = () =>
  useQuery({
    queryKey: ['ai', 'jobs'],
    queryFn: () => getApi().ai.jobs(),
    refetchInterval: (query) => (query.state.data?.some(isActive) ? 1000 : false),
  })

export const useAiRules = () => useQuery({ queryKey: ['ai', 'rules'], queryFn: () => getApi().ai.rules() })
export const useAiVocabulary = () => useQuery({ queryKey: ['ai', 'vocabulary'], queryFn: () => getApi().ai.vocabulary() })

export function useAiDownload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (modelId: string) => getApi().ai.downloadModel(modelId),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ai', 'jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['ai', 'models'] }),
    ]),
  })
}

export const useAiCohort = (drawingId: string | undefined, scope: AiScope, enabled = true) =>
  useQuery({
    queryKey: ['ai', 'cohort', drawingId, scope],
    queryFn: () => getApi().ai.drawingCohort(drawingId!, scope),
    enabled: !!drawingId && enabled,
    placeholderData: (previous) => previous,
  })

export const useAiGroups = (drawingId: string | undefined) =>
  useQuery({
    queryKey: ['ai', 'groups', drawingId],
    queryFn: () => getApi().ai.drawingGroups(drawingId!),
    enabled: !!drawingId,
  })

export const useAiIndicators = (drawingId: string | undefined, scope: AiScope) =>
  useQuery({
    queryKey: ['ai', 'indicators', drawingId, scope],
    queryFn: () => getApi().ai.drawingIndicators(drawingId!, scope),
    enabled: !!drawingId,
    placeholderData: (previous) => previous,
  })

export const useAiSessionCohort = (sessionId: string | undefined) =>
  useQuery({
    queryKey: ['ai', 'sessionCohort', sessionId],
    queryFn: () => getApi().ai.sessionCohort(sessionId!),
    enabled: !!sessionId,
  })

export const useAiSessionInsights = (sessionId: string | undefined) =>
  useQuery({
    queryKey: ['ai', 'insights', sessionId],
    queryFn: () => getApi().ai.sessionInsights(sessionId!),
    enabled: !!sessionId,
  })

/** A heavy function of a drawing: its stored result and latest job. While the job runs the state is followed every second. */
export function useAiHeavy<F extends AiHeavyFeature>(drawingId: string | undefined, feature: F) {
  return useQuery({
    queryKey: ['ai', 'heavy', drawingId, feature],
    queryFn: () => getApi().ai.heavy(drawingId!, feature),
    enabled: !!drawingId,
    refetchInterval: (query) => (isActive(query.state.data?.job) ? 1000 : false),
  })
}

/** Starting a function or discarding its result changes the state, the report list (a report notices new AI results) and the session insights. */
function useInvalidateAi(drawingId: string, feature: AiHeavyFeature) {
  const queryClient = useQueryClient()
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['ai', 'heavy', drawingId, feature] }),
    queryClient.invalidateQueries({ queryKey: ['ai', 'insights'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
  ])
}

export function useStartAi<F extends AiHeavyFeature>(drawingId: string, feature: F) {
  const invalidate = useInvalidateAi(drawingId, feature)
  return useMutation({
    mutationFn: (regenerate: boolean) => getApi().ai.startHeavy(drawingId, feature, regenerate),
    onSuccess: invalidate,
  })
}

export function useDiscardAi(drawingId: string, feature: AiHeavyFeature) {
  const invalidate = useInvalidateAi(drawingId, feature)
  return useMutation({ mutationFn: () => getApi().ai.discardHeavy(drawingId, feature), onSuccess: invalidate })
}

export function useCancelAiJob(drawingId: string, feature: AiHeavyFeature) {
  const invalidate = useInvalidateAi(drawingId, feature)
  return useMutation({ mutationFn: (jobId: string) => getApi().ai.cancelJob(jobId), onSuccess: invalidate })
}

/** The image a model was shown (evidence). */
export const useAiViewImage = (drawingId: string, view: AiView, groupId?: string, enabled = true) =>
  useQuery({
    queryKey: ['ai', 'view', drawingId, view, groupId ?? null],
    queryFn: () => getApi().ai.viewImage(drawingId, view, groupId),
    enabled,
    staleTime: Infinity,
  })
