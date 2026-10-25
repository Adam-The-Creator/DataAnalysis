import type {
  AdminMessage, AiDrawingCohort, AiGroups, AiHeavyFeature, AiHeavyState, AiIndicators, AiInsights, AiJob, AiModelEntry,
  AiOutput, AiResultTypes, AiRulesInfo, AiScope, AiSessionCohort, AiStatusInfo, AiView, AiVocabularyInfo,
  CohortFilters, CohortResult, CreatedReport, CsvDialect, Drawing, DrawingAnalysis, DrawingGeometry,
  DrawingMeta, ExportFormat, HeatmapData, InstrumentDefinition, InstrumentId, LoginResult, MessageFilters, MessageInput,
  MessagePage, MultiplayerData, MySubmissions, Overview, ParticipantHistory, PlayerInfo, PlayerInfoInput, PlayerListEntry,
  QuestionnaireInput, QuestionnaireResults, RecentDrawing, ReportInfo, ReportKind, ResultFilters, RoleValue, Session,
  SessionInput, SessionStats, SessionSummary, SubmissionReceipt, TimePoint, TimelineData, TrackingData, UsageNumbers,
} from './types'

/**
 * Everything the UI needs from a backend. There are two implementations:
 *  - live: the DatabaseServer. What an older server build does not have throws NotImplementedError.
 *  - demo: generated sample data, including a stand-in for the analysis module, so the whole app can be tried
 *    without a server.
 */
export interface Api {
  auth: {
    login(username: string, password: string): Promise<LoginResult>
    role(playerId: string): Promise<RoleValue>
  }

  sessions: {
    /** Sessions with their drawing and participant counts. */
    summaries(): Promise<SessionSummary[]>
    get(sessionId: string): Promise<Session>
    activeId(): Promise<string>
    drawings(sessionId: string): Promise<DrawingMeta[]>
    // Session management (requirement SES-05). The server's rules come back as readable messages.
    create(input: SessionInput): Promise<Session>
    update(sessionId: string, input: SessionInput): Promise<Session>
    activate(sessionId: string): Promise<void>
    close(sessionId: string): Promise<void>
    remove(sessionId: string): Promise<void>
  }

  players: {
    info(playerId: string): Promise<PlayerInfo>
    /** A null entry means the info could not be read (for example a player may only read their own). */
    infos(playerIds: string[]): Promise<(PlayerInfo | null)[]>
    list(): Promise<PlayerListEntry[]>
    /** A player changes their own info (My profile). The server refuses values outside its limits with a message. */
    updateInfo(playerId: string, input: PlayerInfoInput): Promise<void>
    drawings(playerId: string): Promise<DrawingMeta[]>
  }

  drawings: {
    /** The whole stored document (large). Only needed for the raw JSON download. */
    get(drawingId: string, ownerId?: string): Promise<Drawing>
    /** The name, owner and session of a drawing (the drawing document itself has no name). */
    meta(drawingId: string): Promise<DrawingMeta>
  }

  /** The server side analysis module (requirement TEC-02). */
  analysis: {
    overview(): Promise<Overview>
    drawingsOverTime(): Promise<TimePoint[]>
    /** Without a limit: every drawing, newest first. */
    recentDrawings(limit?: number): Promise<RecentDrawing[]>
    /** An image URL (a data or object URL). */
    thumbnail(drawingId: string): Promise<string>
    /** The strokes for the viewer, simplified by a tolerance in metres (0 keeps every point). */
    geometry(drawingId: string, tolerance: number): Promise<DrawingGeometry>
    drawingAnalysis(drawingId: string): Promise<DrawingAnalysis>
    sessionStats(sessionId: string): Promise<SessionStats>
    timeline(drawingId: string, idleGapSeconds: number): Promise<TimelineData>
    tracking(drawingId: string): Promise<TrackingData>
    heatmap(drawingId: string, voxelSize: number): Promise<HeatmapData>
    multiplayer(drawingId: string, proximity: number): Promise<MultiplayerData>
    cohort(drawingId: string, filters: CohortFilters): Promise<CohortResult>
    participantHistory(playerId: string): Promise<ParticipantHistory>
    exportSessionCsv(sessionId: string, dialect: CsvDialect): Promise<Blob>
    exportDrawing(drawingId: string, format: ExportFormat, includeErased: boolean): Promise<Blob>
    reports(): Promise<ReportInfo[]>
    /** Reuses a stored report unless regenerate is set (requirement REP-04). */
    createReport(kind: ReportKind, targetId: string, regenerate?: boolean): Promise<CreatedReport>
    reportHtml(reportId: string): Promise<string>
    deleteReport(reportId: string): Promise<void>
  }

  /**
   * AI decision support (requirements AI-01..AI-16), psychologists only. Every output is an AiOutput: labelled as
   * AI-generated, with model, parameters, confidence and evidence. The heavy functions (labels, description, summary)
   * run as background jobs: start one, then follow the state until its job is done.
   */
  ai: {
    status(): Promise<AiStatusInfo>
    models(): Promise<AiModelEntry[]>
    /** An explicit download of a listed model (AI-06). A background job. */
    downloadModel(modelId: string): Promise<AiJob>
    jobs(): Promise<AiJob[]>
    rules(): Promise<AiRulesInfo>
    vocabulary(): Promise<AiVocabularyInfo>
    drawingCohort(drawingId: string, scope: AiScope, ageMin?: number, ageMax?: number): Promise<AiOutput<AiDrawingCohort>>
    drawingGroups(drawingId: string): Promise<AiOutput<AiGroups>>
    drawingIndicators(drawingId: string, scope: AiScope, ageMin?: number, ageMax?: number): Promise<AiOutput<AiIndicators>>
    sessionCohort(sessionId: string): Promise<AiOutput<AiSessionCohort>>
    sessionInsights(sessionId: string): Promise<AiOutput<AiInsights>>
    heavy<F extends AiHeavyFeature>(drawingId: string, feature: F): Promise<AiHeavyState<AiResultTypes[F]>>
    /** Starts the job unless an up to date result exists (or regenerate is set). Returns the new state. */
    startHeavy<F extends AiHeavyFeature>(drawingId: string, feature: F, regenerate?: boolean): Promise<AiHeavyState<AiResultTypes[F]>>
    discardHeavy(drawingId: string, feature: AiHeavyFeature): Promise<void>
    cancelJob(jobId: string): Promise<AiJob>
    /** The view the models are shown, as an image URL (AI-04, evidence). */
    viewImage(drawingId: string, view: AiView, groupId?: string): Promise<string>
  }

  /** Questionnaires and messages of a player or psychologist (requirements FBK-01..FBK-20). */
  feedback: {
    instruments(): Promise<InstrumentDefinition[]>
    /** Refused with the server's own message when a send limit is reached (SEC-01). */
    sendQuestionnaire(input: QuestionnaireInput): Promise<SubmissionReceipt>
    sendMessage(input: MessageInput): Promise<SubmissionReceipt>
    /** The caller's own submissions, newest first. */
    mine(limit: number, offset: number): Promise<MySubmissions>
  }

  /** The admin dashboard (requirements ADM-01..ADM-13). The senders are pseudonym codes. */
  admin: {
    usage(): Promise<UsageNumbers>
    questionnaireResults(filters: ResultFilters): Promise<QuestionnaireResults>
    messages(filters: MessageFilters, limit: number, offset: number): Promise<MessagePage>
    setMessageRead(messageId: string, read: boolean): Promise<AdminMessage>
    deleteMessage(messageId: string): Promise<void>
    exportQuestionnaires(instrument: InstrumentId, dialect: CsvDialect, filters: ResultFilters): Promise<Blob>
    exportMessages(dialect: CsvDialect, filters: MessageFilters): Promise<Blob>
  }
}
