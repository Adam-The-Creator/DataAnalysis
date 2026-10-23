/**
 * Where every requirement of requirements.md stands. The Roadmap page and the "planned" panels read this list, so
 * the big picture of the app stays in one place. Update it when a feature changes state.
 *
 * Status:
 *  - done:    works in demo and live mode
 *  - partial: works, but with a temporary shortcut or a part missing (see the notes in the code)
 *  - demo:    the screen exists and works on demo data; live mode shows "not implemented" (needs the server module)
 *  - planned: not built yet
 */
export type Phase = 'MVP' | 'P2' | 'P3'
export type FeatureStatus = 'done' | 'partial' | 'demo' | 'planned'

const features = [
  // MVP
  ['AUTH-01', 'MVP', 'done'], ['AUTH-02', 'MVP', 'done'], ['AUTH-03', 'MVP', 'done'], ['AUTH-04', 'MVP', 'done'],
  ['ACC-01', 'MVP', 'done'], ['ACC-02', 'MVP', 'done'],
  ['DASH-01', 'MVP', 'partial'], ['DASH-02', 'MVP', 'partial'], ['DASH-03', 'MVP', 'partial'],
  ['SES-01', 'MVP', 'partial'], ['SES-02', 'MVP', 'partial'], ['SES-03', 'MVP', 'demo'], ['SES-04', 'MVP', 'demo'],
  ['DRW-01', 'MVP', 'done'], ['DRW-02', 'MVP', 'done'], ['DRW-03', 'MVP', 'planned'], ['DRW-04', 'MVP', 'partial'],
  ['PLY-01', 'MVP', 'partial'], ['PLY-02', 'MVP', 'done'], ['PLY-03', 'MVP', 'done'],
  ['MET-01', 'MVP', 'demo'], ['MET-02', 'MVP', 'demo'], ['MET-03', 'MVP', 'planned'], ['MET-04', 'MVP', 'planned'],
  ['MET-05', 'MVP', 'demo'], ['MET-06', 'MVP', 'demo'], ['MET-07', 'MVP', 'done'], ['MET-08', 'MVP', 'demo'],
  ['REP-01', 'MVP', 'demo'], ['REP-02', 'MVP', 'partial'], ['REP-03', 'MVP', 'demo'], ['REP-04', 'MVP', 'demo'],
  ['REP-05', 'MVP', 'demo'], ['REP-06', 'MVP', 'done'],
  ['TEC-01', 'MVP', 'done'], ['TEC-02', 'MVP', 'planned'], ['TEC-03', 'MVP', 'planned'], ['TEC-04', 'MVP', 'planned'],
  ['TEC-05', 'MVP', 'planned'], ['TEC-06', 'MVP', 'planned'], ['TEC-07', 'MVP', 'done'], ['TEC-08', 'MVP', 'partial'],
  ['TEC-09', 'MVP', 'partial'], ['TEC-10', 'MVP', 'partial'], ['TEC-11', 'MVP', 'planned'], ['TEC-12', 'MVP', 'planned'],
  // P2
  ['SES-05', 'P2', 'planned'],
  ['DRW-05', 'P2', 'planned'], ['DRW-06', 'P2', 'planned'], ['DRW-07', 'P2', 'planned'], ['DRW-08', 'P2', 'planned'],
  ['DRW-09', 'P2', 'planned'],
  ['PAR-01', 'P2', 'partial'],
  ['CMP-01', 'P2', 'planned'], ['CMP-02', 'P2', 'planned'], ['CMP-03', 'P2', 'planned'],
  ['MUL-01', 'P2', 'planned'], ['MUL-02', 'P2', 'planned'], ['MUL-03', 'P2', 'planned'],
  ['REP-07', 'P2', 'planned'], ['REP-08', 'P2', 'planned'],
  ['EXP-01', 'P2', 'planned'], ['EXP-02', 'P2', 'planned'], ['EXP-03', 'P2', 'planned'], ['EXP-04', 'P2', 'planned'],
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
