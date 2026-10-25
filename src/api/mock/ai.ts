import type {
  AiCohortRow, AiDescription, AiDirectoryEntry, AiDrawingCohort, AiEvidence, AiFeatureId, AiFeatureStatus, AiGroups,
  AiHeavyFeature, AiHeavyState, AiIndicators, AiInsights, AiJob, AiLabelEntry, AiLabels, AiModelEntry, AiModelInfo, AiOutput,
  AiReason, AiResultTypes, AiRulesInfo, AiScope, AiSessionCohort, AiStatus, AiStatusInfo, AiSummary, AiView, AiVocabularyInfo,
  Drawing,
} from '@/api/types'
import { geometryFromDrawing } from '@/lib/drawingGeometry'
import { toViewerStrokes } from '@/lib/strokes'
import { drawingSvg, svgDataUrl } from '@/lib/thumbnail'
import { analyzeDrawing, metricValues } from './analysisEngine'
import {
  aggregateInsights, analyzeCohort, clusterStrokes, evaluateIndicators, ruleBase, type InsightDrawing, type MetricRow,
} from './aiClassical'
import vocabularyJson from './aiVocabulary.json'
import { getWorld } from './world'

/**
 * STAND-IN for the server's AI module (DatabaseServer, ai/, routers/ai.py) in demo mode. The classical functions
 * (atypical and similar drawings, the map, stroke groups, fuzzy indicators, session insights) are real calculations,
 * ported from the server. The functions that need a model (semantic labels, description, conclusion) give SAMPLE output:
 * no model is run, and the answers say so in the model name and in a note, so nobody can mistake them for real findings.
 */

const DISCLAIMER = 'AI-generated decision support for the psychologist. It describes and suggests, it is not a diagnosis, and it has to be reviewed by a psychologist.'
const MIN_COHORT = 8
const MIN_FUZZY_COHORT = 8
const MODULE_VERSION = '1.0'

const STATISTICS: AiModelInfo = {
  id: 'cohort-ml', name: 'Robust z-scores, PCA, nearest neighbours (demo port)', version: 'demo', licence: 'Own work of the project', kind: 'statistical',
}
const GROUPING: AiModelInfo = { id: 'groups-dbscan', name: 'DBSCAN stroke clustering (demo port)', version: 'demo', licence: 'Own work of the project', kind: 'statistical' }
const RULES: AiModelInfo = { id: 'fuzzy-rules', name: ruleBase.name, version: ruleBase.version, licence: 'Own work of the project', kind: 'rules' }
const sample = (id: string, kind: string): AiModelInfo => ({ id, name: 'Demo sample (no model was run)', version: '-', licence: '-', kind })

const FEATURES: { id: AiFeatureId; requirement: string; kind: AiFeatureStatus['kind']; models: string[] }[] = [
  { id: 'cohort', requirement: 'AI-10', kind: 'classical', models: ['scikit-learn'] },
  { id: 'groups', requirement: 'AI-11', kind: 'classical', models: ['scikit-learn'] },
  { id: 'indicators', requirement: 'AI-14', kind: 'rules', models: ['fuzzy-rules'] },
  { id: 'insights', requirement: 'AI-15', kind: 'classical', models: [] },
  { id: 'labels', requirement: 'AI-12', kind: 'model', models: ['clip'] },
  { id: 'description', requirement: 'AI-13', kind: 'model', models: ['vision'] },
  { id: 'summary', requirement: 'AI-16', kind: 'model', models: ['text'] },
]

function envelope<T>(
  feature: AiFeatureId, model: AiModelInfo, result: T | null,
  extra: Partial<Pick<AiOutput<T>, 'params' | 'promptVersion' | 'confidence' | 'confidenceKind' | 'evidence' | 'notes' | 'status' | 'reason'>> = {},
): AiOutput<T> {
  return {
    ai: true, label: 'AI-generated', disclaimer: DISCLAIMER, feature,
    requirement: FEATURES.find((f) => f.id === feature)!.requirement,
    status: extra.status ?? 'ok', reason: extra.reason ?? null, evaluated: false, model, params: extra.params ?? {},
    promptVersion: extra.promptVersion ?? null, confidence: extra.confidence ?? null, confidenceKind: extra.confidenceKind ?? null,
    evidence: extra.evidence ?? [], notes: extra.notes ?? [], moduleVersion: MODULE_VERSION, generatedAt: new Date().toISOString(), result,
  }
}

const notEnough = <T>(feature: AiFeatureId, model: AiModelInfo, have: number, params: Record<string, unknown>, need = MIN_COHORT) =>
  envelope<T>(feature, model, null, { status: 'notEnoughData' as AiStatus, reason: 'notEnoughData' as AiReason, params: { ...params, have, need } })

// --- Data ---

const metricsCache = new Map<string, MetricRow>()

function findDrawing(drawingId: string): Drawing {
  const drawing = getWorld().drawings.find((d) => d.metadata.id === drawingId)
  if (!drawing) throw new Error('Drawing not found')
  return drawing
}

function metricsOf(drawing: Drawing): MetricRow {
  const id = drawing.metadata.id
  if (!metricsCache.has(id)) metricsCache.set(id, metricValues(analyzeDrawing(drawing)))
  return metricsCache.get(id)!
}

function cohortOf(drawing: Drawing, scope: AiScope, ageMin?: number, ageMax?: number): Drawing[] {
  const { players } = getWorld()
  return getWorld().drawings.filter((d) => {
    if (d.metadata.id === drawing.metadata.id) return false
    if (scope === 'gameType' && d.metadata.gameType !== drawing.metadata.gameType) return false
    if (scope === 'session' && d.metadata.sessionID !== drawing.metadata.sessionID) return false
    const age = players.find((p) => p.id === d.metadata.owner)?.info.age
    if (ageMin !== undefined && (age == null || age < ageMin)) return false
    if (ageMax !== undefined && (age == null || age > ageMax)) return false
    return true
  })
}

function directory(ids: Iterable<string>): Record<string, AiDirectoryEntry> {
  const { metas } = getWorld()
  const out: Record<string, AiDirectoryEntry> = {}
  for (const id of [...new Set(ids)].sort()) {
    const meta = metas.find((m) => m.id === id)
    if (meta) out[id] = { name: meta.name, playerId: meta.playerID, gameType: meta.gameType }
  }
  return out
}

// --- Classical functions (real calculations) ---

function drawingCohort(drawingId: string, scope: AiScope, ageMin?: number, ageMax?: number): AiOutput<AiDrawingCohort> {
  const drawing = findDrawing(drawingId)
  const subject = metricsOf(drawing)
  const entries = [drawing, ...cohortOf(drawing, scope, ageMin, ageMax)].map((d) => ({ id: d.metadata.id, metrics: metricsOf(d) }))
  const params = { scope, ageMin: ageMin ?? null, ageMax: ageMax ?? null, minCohort: MIN_COHORT }
  if (entries.length < MIN_COHORT) return notEnough('cohort', STATISTICS, entries.length, params)
  const analysis = analyzeCohort(entries, drawingId)
  const row = analysis.drawings[0]
  const shown = new Set([...(analysis.map?.points ?? []).map((p) => p.id), ...row.similar.map((s) => s.id)])
  return envelope('cohort', STATISTICS, {
    cohortSize: analysis.cohortSize, metrics: analysis.metrics, zLimit: analysis.zLimit, subject: row, map: analysis.map, directory: directory(shown),
  }, {
    params: { ...params, isolationForest: false },
    evidence: analysis.metrics.map((id): AiEvidence => ({ kind: 'metric', id, value: subject[id] ?? null })),
    notes: ['Atypical only means far from the others on these measurements. It does not mean better, worse or abnormal.',
      'Demo mode: the isolation forest (a second opinion) needs the server.'],
  })
}

function sessionCohort(sessionId: string): AiOutput<AiSessionCohort> {
  const drawings = getWorld().drawings.filter((d) => d.metadata.sessionID === sessionId)
  const params = { scope: 'session', gameType: null, minCohort: MIN_COHORT }
  if (drawings.length < MIN_COHORT) return notEnough('cohort', STATISTICS, drawings.length, params)
  const analysis = analyzeCohort(drawings.map((d) => ({ id: d.metadata.id, metrics: metricsOf(d) })))
  return envelope('cohort', STATISTICS, { ...analysis, directory: directory(drawings.map((d) => d.metadata.id)) }, {
    params: { ...params, isolationForest: false },
    evidence: drawings.map((d): AiEvidence => ({ kind: 'drawing', id: d.metadata.id })),
    notes: ['Atypical only means far from the others on these measurements. It does not mean better, worse or abnormal.'],
  })
}

const groupsCache = new Map<string, AiGroups>()
function groupsOf(drawing: Drawing): AiGroups {
  const id = drawing.metadata.id
  if (!groupsCache.has(id)) groupsCache.set(id, clusterStrokes(drawing))
  return groupsCache.get(id)!
}

function drawingGroups(drawingId: string): AiOutput<AiGroups> {
  const drawing = findDrawing(drawingId)
  const params = { spaceEps: 0.1, timeEps: 20, minPoints: 3, spacing: 0.02 }
  if (!drawing.lines.some((l) => l.status === 1)) {
    return envelope<AiGroups>('groups', GROUPING, null, { status: 'notEnoughData', reason: 'noStrokes', params })
  }
  return envelope('groups', GROUPING, groupsOf(drawing), {
    params, evidence: [{ kind: 'drawing', id: drawingId }],
    notes: ['The groups describe how the lines lie in space and time. The method does not know what they depict, so it has no confidence value.'],
  })
}

function indicatorsOf(drawing: Drawing, scope: AiScope, ageMin?: number, ageMax?: number) {
  const cohort = cohortOf(drawing, scope, ageMin, ageMax).map(metricsOf)
  return evaluateIndicators(metricsOf(drawing), cohort, MIN_FUZZY_COHORT)
}

function drawingIndicators(drawingId: string, scope: AiScope, ageMin?: number, ageMax?: number): AiOutput<AiIndicators> {
  const drawing = findDrawing(drawingId)
  const evaluation = indicatorsOf(drawing, scope, ageMin, ageMax)
  const notes = ['The indicators say how this drawing compares with the others on measurements. They are not a diagnosis.']
  if (ruleBase.status !== 'reviewed') notes.push('The rule base is a proposal that psychologists have not reviewed yet.')
  if (evaluation.basis !== 'cohort') notes.push('The comparison group is small, so fixed ranges are used for some or all measurements.')
  const used = new Set(evaluation.indicators.flatMap((i) => i.inputs.map((x) => x.metric)))
  const subject = metricsOf(drawing)
  return envelope('indicators', RULES, {
    ruleBase: { name: ruleBase.name, version: ruleBase.version, status: ruleBase.status, reviewed: ruleBase.reviewed }, ...evaluation,
  }, {
    promptVersion: `${ruleBase.name} v${ruleBase.version} (${ruleBase.status})`,
    params: { scope, ageMin: ageMin ?? null, ageMax: ageMax ?? null, minCohort: MIN_FUZZY_COHORT },
    evidence: [...used].sort().map((id): AiEvidence => ({ kind: 'metric', id, value: subject[id] ?? null })), notes,
  })
}

// --- Functions that need a model (sample output) ---

interface Sample {
  words: RegExp
  label: string
  objects: string[]
  scene: string
  features: string[]
  mood: string[]
  abstract: boolean
}

const SAMPLES: Sample[] = [
  { words: /garden|flower|two hands|together/i, label: 'flower', objects: ['flower', 'stem'], scene: 'A flower with several petals on a long stem.', features: ['curved petals around a centre'], mood: ['warm', 'bright'], abstract: false },
  { words: /oak|branches|forest/i, label: 'tree', objects: ['tree', 'branches'], scene: 'A tree with a thick trunk and spreading branches.', features: ['branching lines'], mood: ['green', 'calm'], abstract: false },
  { words: /home|house/i, label: 'house', objects: ['house', 'roof'], scene: 'A small house with a pointed roof.', features: ['straight walls', 'triangular roof'], mood: ['warm'], abstract: false },
  { words: /morning|sunset/i, label: 'sun', objects: ['sun', 'rays'], scene: 'A sun with rays above a low line.', features: ['radiating lines'], mood: ['warm', 'bright'], abstract: false },
  { words: /sea|shell/i, label: 'water', objects: ['waves'], scene: 'Wavy lines that look like water.', features: ['repeating wave lines'], mood: ['cool', 'calm'], abstract: false },
  { words: /spiral/i, label: 'pattern', objects: [], scene: 'Nested spirals without a clear object.', features: ['spiral lines'], mood: ['cool'], abstract: true },
  { words: /./, label: 'scribble', objects: [], scene: 'Dense, tangled lines without a clear object.', features: ['many crossing lines'], mood: ['dark'], abstract: true },
]

const sampleOf = (name: string): Sample => SAMPLES.find((s) => s.words.test(name)) ?? SAMPLES[SAMPLES.length - 1]
const labelName = (id: string) => vocabularyJson.labels.find((l) => l.id === id)?.name ?? id
const isOther = (id: string) => vocabularyJson.labels.find((l) => l.id === id)?.other === true

function entry(label: string, score: number): AiLabelEntry {
  return { label, name: labelName(label), other: isOther(label), score }
}

function sampleLabels(drawing: Drawing, name: string): AiLabels {
  const chosen = sampleOf(name)
  const others = vocabularyJson.labels.map((l) => l.id).filter((id) => id !== chosen.label)
  const rotate = (n: number) => others[(chosen.label.length * 3 + n) % others.length]
  const confident = !isOther(chosen.label)
  const verdict = (top: AiLabelEntry[]) => ({
    top, margin: Math.round((top[0].score - top[1].score) * 1000) / 1000,
    unspecific: top[0].other || top[0].score < 0.25 || top[0].score - top[1].score < 0.05,
  })
  const topWhole = confident
    ? [entry(chosen.label, 0.62), entry(rotate(1), 0.17), entry(rotate(2), 0.08)]
    : [entry(chosen.label, 0.41), entry(rotate(1), 0.2), entry(rotate(2), 0.12)]
  const views: AiView[] = ['front', 'top', 'side', 'iso']
  return {
    vocabulary: { name: vocabularyJson.name, version: vocabularyJson.version },
    whole: { ...verdict(topWhole), views: views.map((view, i) => ({ view, top: [entry(chosen.label, 0.55 - i * 0.06), entry(rotate(i + 3), 0.2), entry(rotate(i + 4), 0.1)] })) },
    groups: groupsOf(drawing).groups.slice(0, 6).map((group, i) => ({
      groupId: group.id, strokeIds: group.strokeIds,
      ...verdict(i === 0 && confident ? [entry(chosen.label, 0.48), entry(rotate(5), 0.2), entry(rotate(6), 0.1)] : [entry('scribble', 0.3), entry(rotate(7), 0.22), entry(rotate(8), 0.15)]),
    })),
  }
}

function sampleDescription(name: string): AiDescription {
  const s = sampleOf(name)
  return {
    depictedObjects: s.objects.map((object, i) => ({ name: object, certainty: i === 0 ? 'medium' : 'low' })),
    scene: s.scene, notableFeatures: s.features, colourMoodWords: s.mood, abstract: s.abstract,
  }
}

function sampleSummary(drawing: Drawing, name: string): AiSummary {
  const metrics = metricsOf(drawing)
  const indicators = indicatorsOf(drawing, 'gameType').indicators.filter((i) => i.level)
  const strokes = metrics.strokesDrawn ?? 0
  return {
    overview: `This drawing has ${strokes} strokes and was compared with the other drawings of its game type. The comparison suggests ${indicators.slice(0, 2).map((i) => i.text).join(' and ') || 'no clear pattern'}.`,
    observations: indicators.slice(0, 4).map((i) => `${i.name}: ${i.text}.`),
    thingsToExplore: [`What was the participant thinking of while drawing “${name}”?`, 'How did the participant feel about the amount of space the drawing used?'],
    limitations: ['This is a demo sample, no language model was run.', 'Only one drawing was considered, not the participant over time.'],
  }
}

function sampleOutput(feature: AiHeavyFeature, drawing: Drawing, name: string): AiOutput<unknown> {
  const notes = ['Demo mode: this is sample output, no model was run. A real run shows the model that produced it.']
  if (feature === 'labels') {
    const result = sampleLabels(drawing, name)
    return envelope('labels', sample('clip', 'neural'), result, {
      promptVersion: `${vocabularyJson.name} v${vocabularyJson.version}`, confidence: result.whole.top[0].score, confidenceKind: 'vocabularyShare',
      params: { clipModel: 'ViT-B-32', views: ['front', 'top', 'side', 'iso'], groupViews: ['front', 'iso'], groupsLabelled: result.groups.length },
      evidence: (['front', 'top', 'side', 'iso'] as const).map((view): AiEvidence => ({ kind: 'view', view })),
      notes: [...notes, 'The share is how the model spreads 100 % over the vocabulary. It is not the probability that the label is right.'],
    })
  }
  if (feature === 'description') {
    return envelope('description', sample('vision', 'vision-language'), sampleDescription(name), {
      promptVersion: 'vlm-2', params: { temperature: 0, seed: 0, views: ['iso', 'front', 'side'] },
      evidence: (['iso', 'front', 'side'] as const).map((view): AiEvidence => ({ kind: 'view', view })),
      notes: [...notes, 'The certainty values are stated by the model itself and are not calibrated.'],
    })
  }
  return envelope('summary', sample('text', 'language'), sampleSummary(drawing, name), {
    promptVersion: 'llm-2', params: { temperature: 0, seed: 0 },
    evidence: [{ kind: 'facts', facts: { measurements: 'the metrics of the drawing', indicators: 'the fuzzy indicators' } }],
    notes: [...notes, 'A language model can state things that are not in the facts. Check every statement against the data.'],
  })
}

// --- Jobs (simulated: a few steps, then the sample result) ---

const jobs = new Map<string, AiJob>()
const timers = new Map<string, ReturnType<typeof setInterval>>()
const stored = new Map<string, AiOutput<unknown>>()
const keyOf = (feature: string, drawingId: string) => `${feature}:${drawingId}`
const STEPS = ['Rendering the views', 'Waiting for the model', 'Checking the answer']
let jobCounter = 0

const isActive = (job: AiJob | undefined) => job?.status === 'queued' || job?.status === 'running'
/** The newest job of this kind for this target (the map keeps the order in which the jobs were made). */
const latestJob = (kind: string, targetId: string) =>
  [...jobs.values()].reverse().find((j) => j.kind === kind && j.targetId === targetId)

function startJob(kind: string, targetId: string, finish: () => void): AiJob {
  const job: AiJob = {
    id: `demo-job-${++jobCounter}`, kind, targetId, status: 'running', progress: 0.05, message: STEPS[0],
    error: null, createdAt: new Date().toISOString(), finishedAt: null,
  }
  jobs.set(job.id, job)
  let step = 0
  timers.set(job.id, setInterval(() => {
    step++
    if (step >= 6) {
      clearInterval(timers.get(job.id))
      timers.delete(job.id)
      finish()
      Object.assign(job, { status: 'done', progress: 1, finishedAt: new Date().toISOString() })
    } else {
      Object.assign(job, { progress: step / 6, message: STEPS[Math.min(STEPS.length - 1, Math.floor(step / 2))] })
    }
  }, 450))
  return job
}

function heavyState<F extends AiHeavyFeature>(drawingId: string, feature: F): AiHeavyState<AiResultTypes[F]> {
  findDrawing(drawingId)
  const job = latestJob(feature, drawingId)
  return {
    feature, result: (stored.get(keyOf(feature, drawingId)) as AiOutput<AiResultTypes[F]> | undefined) ?? null, stale: false,
    available: true, reason: null, detail: null, job: job ? { ...job } : null,
  }
}

function startHeavy<F extends AiHeavyFeature>(drawingId: string, feature: F, regenerate: boolean): AiHeavyState<AiResultTypes[F]> {
  const drawing = findDrawing(drawingId)
  const key = keyOf(feature, drawingId)
  if (!isActive(latestJob(feature, drawingId)) && (regenerate || !stored.has(key))) {
    const name = getWorld().metas.find((m) => m.id === drawingId)?.name ?? ''
    startJob(feature, drawingId, () => stored.set(key, sampleOutput(feature, drawing, name)))
  }
  return heavyState(drawingId, feature)
}

// --- Insights ---

function sessionInsights(sessionId: string): AiOutput<AiInsights> {
  const drawings = getWorld().drawings.filter((d) => d.metadata.sessionID === sessionId)
  const params = { sessionId }
  if (drawings.length < 2) return notEnough<AiInsights>('insights', STATISTICS, drawings.length, params, 2)
  const cohort = drawings.length >= MIN_COHORT ? sessionCohort(sessionId) : null
  const atypical = new Set(cohort?.result?.drawings.filter((r: AiCohortRow) => r.atypical).map((r) => r.id))
  const insightDrawings: InsightDrawing[] = drawings.map((d) => ({
    id: d.metadata.id, playerId: d.metadata.owner, indicators: indicatorsOf(d, 'gameType').indicators,
    labels: (stored.get(keyOf('labels', d.metadata.id)) as AiOutput<AiLabels> | undefined)?.result ?? null,
    atypical: cohort?.result ? atypical.has(d.metadata.id) : null,
  }))
  return envelope('insights', STATISTICS, {
    drawingCount: drawings.length, insights: aggregateInsights(insightDrawings),
    atypicalSkipped: cohort?.result ? null : 'notEnoughData',
    coverage: { labels: insightDrawings.filter((d) => d.labels).length, indicators: insightDrawings.filter((d) => d.indicators.length).length },
    directory: directory(drawings.map((d) => d.metadata.id)),
  }, {
    params, evidence: drawings.map((d): AiEvidence => ({ kind: 'drawing', id: d.metadata.id })),
    notes: ['Counting only: a recurring label means that a model named it for several drawings, not that they show it.'],
  })
}

/** What a demo report shows of the AI results: the calculated parts, and the sample output that exists. */
export function reportOutputs(kind: 'drawing' | 'session', targetId: string): AiOutput<unknown>[] {
  if (kind === 'session') return [sessionInsights(targetId)].filter((o) => o.status === 'ok')
  const heavy = (['labels', 'description', 'summary'] as const).flatMap((f) => stored.get(keyOf(f, targetId)) ?? [])
  return [drawingIndicators(targetId, 'gameType'), drawingCohort(targetId, 'gameType'), drawingGroups(targetId), ...heavy]
    .filter((o) => o.status === 'ok' || o.status === 'notEnoughData')
}

// --- Settings ---

const MODELS: AiModelEntry[] = [
  { id: 'numpy', name: 'NumPy', version: 'demo', kind: 'library', licence: 'BSD-3-Clause', licenceChecked: false, source: 'pypi.org', sizeHint: null, usedBy: ['cohort', 'groups', 'labels'], status: 'installed', statusDetail: null, downloadable: false, hint: null },
  { id: 'scikit-learn', name: 'scikit-learn', version: 'demo', kind: 'library', licence: 'BSD-3-Clause', licenceChecked: false, source: 'pypi.org', sizeHint: null, usedBy: ['cohort', 'groups'], status: 'installed', statusDetail: null, downloadable: false, hint: null },
  { id: 'fuzzy-rules', name: 'Fuzzy rule base', version: ruleBase.version, kind: 'rules', licence: 'Own work of the project (editable)', licenceChecked: true, source: 'fuzzy_rules.toml', sizeHint: null, usedBy: ['indicators'], status: 'installed', statusDetail: `${ruleBase.name}, status: ${ruleBase.status}`, downloadable: false, hint: null },
  { id: 'clip', name: 'OpenCLIP ViT-B-32', version: 'laion2b_s34b_b79k', kind: 'neural', licence: 'MIT (OpenCLIP code and the LAION-2B weights)', licenceChecked: false, source: 'github.com/mlfoundations/open_clip', sizeHint: 'about 0.6 GB (plus PyTorch)', usedBy: ['labels'], status: 'installed', statusDetail: null, downloadable: false, hint: null },
  { id: 'ollama', name: 'Ollama', version: 'demo', kind: 'runtime', licence: 'MIT', licenceChecked: false, source: 'ollama.com', sizeHint: null, usedBy: ['description', 'summary'], status: 'installed', statusDetail: null, downloadable: false, hint: null },
  { id: 'vision', name: 'qwen2.5vl:7b', version: 'Ollama tag', kind: 'vision-language', licence: 'Apache-2.0', licenceChecked: false, source: 'ollama.com/library', sizeHint: 'about 6 GB', usedBy: ['description'], status: 'installed', statusDetail: null, downloadable: false, hint: null },
  { id: 'text', name: 'qwen2.5:7b-instruct', version: 'Ollama tag', kind: 'language', licence: 'Apache-2.0', licenceChecked: false, source: 'ollama.com/library', sizeHint: 'about 4.7 GB', usedBy: ['summary'], status: 'installed', statusDetail: null, downloadable: false, hint: null },
]

export const mockAi = {
  status: (): AiStatusInfo => ({
    enabled: true, label: 'AI-generated', disclaimer: DISCLAIMER, moduleVersion: MODULE_VERSION,
    features: FEATURES.map((f): AiFeatureStatus => ({ ...f, enabled: true, evaluated: false, available: true, reason: null, detail: null })),
  }),
  models: (): AiModelEntry[] => MODELS,
  downloadModel: (modelId: string): AiJob => startJob('download', modelId, () => undefined),
  jobs: (): AiJob[] => [...jobs.values()].reverse().map((j) => ({ ...j })),
  rules: (): AiRulesInfo => ({ file: 'fuzzy_rules.toml', ruleBase, problems: [] }),
  vocabulary: (): AiVocabularyInfo => ({
    file: 'vocabulary.toml',
    vocabulary: {
      name: vocabularyJson.name, version: vocabularyJson.version, templates: vocabularyJson.templates,
      labels: vocabularyJson.labels.map((l) => ({ id: l.id, name: l.name, other: l.other, phrases: l.phrases })),
    },
    problem: null,
  }),
  drawingCohort, drawingGroups, drawingIndicators, sessionCohort, sessionInsights,
  heavy: heavyState,
  startHeavy,
  discardHeavy: (drawingId: string, feature: AiHeavyFeature): void => { stored.delete(keyOf(feature, drawingId)) },
  cancelJob: (jobId: string): AiJob => {
    const job = jobs.get(jobId)
    if (!job) throw new Error('Job not found')
    if (isActive(job)) {
      clearInterval(timers.get(jobId))
      timers.delete(jobId)
      Object.assign(job, { status: 'cancelled', finishedAt: new Date().toISOString() })
    }
    return { ...job }
  },
  viewImage: (drawingId: string, view: AiView, groupId?: string): string => {
    const drawing = findDrawing(drawingId)
    let strokes = toViewerStrokes(geometryFromDrawing(drawing))
    const group = groupId ? groupsOf(drawing).groups.find((g) => g.id === groupId) : undefined
    if (group) strokes = strokes.filter((s) => group.strokeIds.includes(s.id))
    return svgDataUrl(drawingSvg(strokes, view === 'iso' ? 'front' : view))
  },
}
