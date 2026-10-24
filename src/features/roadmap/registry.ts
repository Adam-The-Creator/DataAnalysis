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
export type Phase = 'MVP' | 'P2' | 'P3'
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
  ['TEC-05', 'MVP', 'planned'], ['TEC-06', 'MVP', 'partial'], ['TEC-07', 'MVP', 'done'], ['TEC-08', 'MVP', 'partial'],
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
  // P3
  ['AI-01', 'P3', 'planned'], ['AI-02', 'P3', 'planned'], ['AI-03', 'P3', 'planned'], ['AI-04', 'P3', 'planned'],
  ['AI-05', 'P3', 'planned'], ['AI-06', 'P3', 'planned'], ['AI-07', 'P3', 'planned'],
  ['AI-10', 'P3', 'planned'], ['AI-11', 'P3', 'planned'], ['AI-12', 'P3', 'planned'], ['AI-13', 'P3', 'planned'],
  ['AI-14', 'P3', 'planned'], ['AI-15', 'P3', 'planned'], ['AI-16', 'P3', 'planned'], ['AI-17', 'P3', 'planned'],
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
] as const

/** The agreed scope decisions of requirements.md. Titles: roadmap.decisions.*. */
export const decisionIds = ['SC-01', 'SC-02', 'SC-03', 'SC-04', 'SC-05', 'SC-06', 'SC-07'] as const
