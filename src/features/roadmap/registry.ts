/**
 * Where every requirement of requirements.md stands. The Roadmap page and the "planned" panels read this list, so
 * the big picture of the app stays in one place. Update it when a feature changes state.
 *
 * Status:
 *  - done:    works in demo mode and against the DatabaseServer's analysis module
 *  - partial: works, with a part missing (see the notes in the code)
 *  - demo:    the screen exists and works on demo data only (needs a server part that does not exist yet)
 *  - planned: not built yet
 */
export type Phase = 'MVP' | 'P2' | 'P3' | 'P4'
export type FeatureStatus = 'done' | 'partial' | 'demo' | 'planned'

const features = [
  // MVP
  ['AUTH-01', 'MVP', 'done'], ['AUTH-02', 'MVP', 'done'], ['AUTH-03', 'MVP', 'done'], ['AUTH-04', 'MVP', 'done'],
  ['ACC-01', 'MVP', 'done'], ['ACC-02', 'MVP', 'done'],
  ['DASH-01', 'MVP', 'done'], ['DASH-02', 'MVP', 'done'], ['DASH-03', 'MVP', 'done'],
  ['SES-01', 'MVP', 'partial'], ['SES-02', 'MVP', 'done'], ['SES-03', 'MVP', 'done'], ['SES-04', 'MVP', 'done'],
  ['DRW-01', 'MVP', 'done'], ['DRW-02', 'MVP', 'done'], ['DRW-03', 'MVP', 'done'], ['DRW-04', 'MVP', 'done'],
  ['PLY-01', 'MVP', 'done'], ['PLY-02', 'MVP', 'done'], ['PLY-03', 'MVP', 'done'],
  ['MET-01', 'MVP', 'done'], ['MET-02', 'MVP', 'done'], ['MET-03', 'MVP', 'partial'], ['MET-04', 'MVP', 'done'],
  ['MET-05', 'MVP', 'done'], ['MET-06', 'MVP', 'done'], ['MET-07', 'MVP', 'done'], ['MET-08', 'MVP', 'done'],
  ['REP-01', 'MVP', 'done'], ['REP-02', 'MVP', 'done'], ['REP-03', 'MVP', 'partial'], ['REP-04', 'MVP', 'done'],
  ['REP-05', 'MVP', 'done'], ['REP-06', 'MVP', 'done'],
  ['TEC-01', 'MVP', 'done'], ['TEC-02', 'MVP', 'done'], ['TEC-03', 'MVP', 'done'], ['TEC-04', 'MVP', 'done'],
  ['TEC-05', 'MVP', 'planned'], ['TEC-06', 'MVP', 'partial'], ['TEC-07', 'MVP', 'done'], ['TEC-08', 'MVP', 'done'],
  ['TEC-09', 'MVP', 'done'], ['TEC-10', 'MVP', 'partial'], ['TEC-11', 'MVP', 'partial'], ['TEC-12', 'MVP', 'partial'],
  // P2
  ['SES-05', 'P2', 'done'],
  ['DRW-05', 'P2', 'done'], ['DRW-06', 'P2', 'done'], ['DRW-07', 'P2', 'done'], ['DRW-08', 'P2', 'done'],
  ['DRW-09', 'P2', 'done'],
  ['PAR-01', 'P2', 'done'],
  ['CMP-01', 'P2', 'done'], ['CMP-02', 'P2', 'done'], ['CMP-03', 'P2', 'done'],
  ['MUL-01', 'P2', 'done'], ['MUL-02', 'P2', 'done'], ['MUL-03', 'P2', 'done'],
  ['REP-07', 'P2', 'done'], ['REP-08', 'P2', 'done'],
  ['EXP-01', 'P2', 'done'], ['EXP-02', 'P2', 'done'], ['EXP-03', 'P2', 'done'], ['EXP-04', 'P2', 'done'],
  // P3: feedback, questionnaires and admin
  // Partly: FBK-12 (the wording has to be compared with the official handbooks), FBK-14 (the smiley questions are a
  // proposal), ADM-08 (no benchmark comparison), SEC-10 (HTTPS
  // is a matter of the deployment), SEC-11 (blocked logins are logged, single failed ones are not), TEC-16 (the UI
  // flows were checked by throw-away scripts, there is no test runner in the repo). Planned: FBK-13 (terms of use).
  ['ACC-03', 'P3', 'done'],
  ['FBK-01', 'P3', 'done'], ['FBK-02', 'P3', 'done'], ['FBK-03', 'P3', 'done'], ['FBK-04', 'P3', 'done'],
  ['FBK-05', 'P3', 'done'], ['FBK-10', 'P3', 'done'], ['FBK-11', 'P3', 'done'], ['FBK-12', 'P3', 'partial'],
  ['FBK-13', 'P3', 'planned'], ['FBK-14', 'P3', 'partial'], ['FBK-20', 'P3', 'done'],
  ['ADM-01', 'P3', 'done'], ['ADM-02', 'P3', 'done'], ['ADM-03', 'P3', 'done'], ['ADM-04', 'P3', 'done'],
  ['ADM-05', 'P3', 'done'], ['ADM-06', 'P3', 'done'], ['ADM-07', 'P3', 'done'], ['ADM-08', 'P3', 'partial'],
  ['ADM-09', 'P3', 'done'], ['ADM-10', 'P3', 'done'], ['ADM-11', 'P3', 'done'], ['ADM-12', 'P3', 'done'],
  ['ADM-13', 'P3', 'done'],
  ['SEC-01', 'P3', 'done'], ['SEC-02', 'P3', 'done'], ['SEC-03', 'P3', 'done'], ['SEC-04', 'P3', 'done'],
  ['SEC-05', 'P3', 'done'], ['SEC-06', 'P3', 'done'], ['SEC-07', 'P3', 'done'], ['SEC-08', 'P3', 'done'],
  ['SEC-09', 'P3', 'done'], ['SEC-10', 'P3', 'partial'], ['SEC-11', 'P3', 'partial'], ['SEC-12', 'P3', 'done'],
  ['TEC-13', 'P3', 'done'], ['TEC-14', 'P3', 'done'], ['TEC-15', 'P3', 'done'], ['TEC-16', 'P3', 'partial'],
  // P4: AI based data analysis and decision support
  // The real models were run by hand on the demo drawings (CLIP on the CPU, the two Ollama models on the GPU).
  // Partly: AI-02 (the Ollama models were only tried on the GPU, not on a CPU), AI-06 (the licences are recorded from
  // the model cards, not yet verified against the study), AI-07 (the evaluated flag and the "not evaluated" notes exist,
  // the trial with psychologists is still to be done: how well the models do on real drawings is unknown).
  // Planned: AI-17 (optional, adopted only if it beats AI-12 and AI-13 on the sample set of AI-07).
  ['AI-01', 'P4', 'done'], ['AI-02', 'P4', 'partial'], ['AI-03', 'P4', 'done'], ['AI-04', 'P4', 'done'],
  ['AI-05', 'P4', 'done'], ['AI-06', 'P4', 'partial'], ['AI-07', 'P4', 'partial'],
  ['AI-10', 'P4', 'done'], ['AI-11', 'P4', 'done'], ['AI-12', 'P4', 'done'], ['AI-13', 'P4', 'done'],
  ['AI-14', 'P4', 'done'], ['AI-15', 'P4', 'done'], ['AI-16', 'P4', 'done'], ['AI-17', 'P4', 'planned'],
  // Added after the first review of Phase 4: a player edits their own information
  ['PLY-04', 'P4', 'done'],
] as const

export type RequirementId = (typeof features)[number][0]

export interface Feature {
  id: RequirementId
  phase: Phase
  status: FeatureStatus
}

export const featureList: readonly Feature[] = features.map(([id, phase, status]) => ({ id, phase, status }))

const byId = new Map(featureList.map((feature) => [feature.id, feature]))

export function featureOf(id: RequirementId): Feature {
  const feature = byId.get(id)
  if (!feature) {
    throw new Error(`Unknown requirement: ${id}`)
  }
  return feature
}

type AreaOf<T> = T extends `${infer Area}-${string}` ? Area : never
export type AreaId = AreaOf<RequirementId>

/** "DRW-05" -> "DRW": the area of a requirement (a translation key: roadmap.areas.*). */
export function areaOf(id: RequirementId): AreaId {
  return id.split('-')[0] as AreaId
}

/** The future improvements of requirements.md (not requirements now). Titles: roadmap.future.*. */
export const futureIds = [
  'FUT-01', 'FUT-02', 'FUT-03', 'FUT-04', 'FUT-05', 'FUT-06', 'FUT-07',
  'FUT-08', 'FUT-09', 'FUT-10', 'FUT-11', 'FUT-12', 'FUT-13', 'FUT-14',
  'FUT-15', 'FUT-16', 'FUT-17', 'FUT-18', 'FUT-19', 'FUT-20', 'FUT-21', 'FUT-22',
] as const

/** The agreed scope decisions of requirements.md. Titles: roadmap.decisions.*. */
export const decisionIds = ['SC-01', 'SC-02', 'SC-03', 'SC-04', 'SC-05', 'SC-06', 'SC-07', 'SC-08', 'SC-09'] as const
