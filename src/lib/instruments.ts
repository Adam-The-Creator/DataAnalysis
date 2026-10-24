import type { AgeBand, InstrumentDefinition, InstrumentId, UeqScaleId } from '@/api/types'

/**
 * The questionnaires (requirements FBK-10..FBK-14). The live server is the authority: it sends the version, the scale
 * and the item IDs, and it computes every score. This file has the same definitions for the demo mode (which stands in
 * for the server) and the typed item IDs the translations are keyed by. Keep it in step with
 * DatabaseServer/feedback/instruments.py.
 */

/** How long a feedback message can be (the server's config.FEEDBACK_MESSAGE_MAX_CHARS). */
export const MESSAGE_MAX_CHARS = 2000

const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1)

export const SUS_ITEMS = range(10).map((n) => `sus${n}`) as unknown as readonly SusItemId[]
export const UEQ_ITEMS = range(26).map((n) => `ueq${n}`) as unknown as readonly UeqItemId[]
export const SMILEY_ITEMS = range(4).map((n) => `smiley${n}`) as unknown as readonly SmileyItemId[]

export type SusItemId = 'sus1' | 'sus2' | 'sus3' | 'sus4' | 'sus5' | 'sus6' | 'sus7' | 'sus8' | 'sus9' | 'sus10'
export type SmileyItemId = 'smiley1' | 'smiley2' | 'smiley3' | 'smiley4'
export type UeqItemId =
  | 'ueq1' | 'ueq2' | 'ueq3' | 'ueq4' | 'ueq5' | 'ueq6' | 'ueq7' | 'ueq8' | 'ueq9' | 'ueq10' | 'ueq11' | 'ueq12' | 'ueq13'
  | 'ueq14' | 'ueq15' | 'ueq16' | 'ueq17' | 'ueq18' | 'ueq19' | 'ueq20' | 'ueq21' | 'ueq22' | 'ueq23' | 'ueq24' | 'ueq25'
  | 'ueq26'

/** The definitions the demo mode answers with (the live server sends the same). */
export const INSTRUMENT_DEFINITIONS: InstrumentDefinition[] = [
  { id: 'SUS', version: 1, targets: ['game', 'webapp'], scaleMin: 1, scaleMax: 5, itemIds: [...SUS_ITEMS] },
  { id: 'UEQ', version: 1, targets: ['game', 'webapp'], scaleMin: 1, scaleMax: 7, itemIds: [...UEQ_ITEMS] },
  { id: 'SMILEY', version: 1, targets: ['game'], scaleMin: 1, scaleMax: 5, itemIds: [...SMILEY_ITEMS] },
]

export const UEQ_SCALES: Record<UeqScaleId, readonly number[]> = {
  attractiveness: [1, 12, 14, 16, 24, 25],
  perspicuity: [2, 4, 13, 21],
  efficiency: [9, 20, 22, 23],
  dependability: [8, 11, 17, 19],
  stimulation: [5, 6, 7, 18],
  novelty: [3, 10, 15, 26],
}
export const UEQ_SCALE_IDS = Object.keys(UEQ_SCALES) as UeqScaleId[]
export const UEQ_PRAGMATIC: UeqScaleId[] = ['perspicuity', 'efficiency', 'dependability']
export const UEQ_HEDONIC: UeqScaleId[] = ['stimulation', 'novelty']
/** Items whose positive word stands on the left: their answer is turned around. */
const UEQ_LEFT_POSITIVE = new Set([3, 4, 5, 9, 10, 12, 17, 18, 19, 21, 23, 24, 25])

export const ageBandOf = (age: number | null | undefined): AgeBand =>
  age == null || age <= 0 ? 'unknown' : age <= 12 ? 'child' : age <= 17 ? 'teen' : 'adult'

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

/** Each SUS item as 0 (worst) to 4 (best). */
export function susContributions(answers: Record<string, number>): Record<string, number> {
  return Object.fromEntries(SUS_ITEMS.map((id, i) => [id, (i + 1) % 2 === 1 ? answers[id] - 1 : 5 - answers[id]]))
}

/** Each UEQ item as -3 (very negative) to +3 (very positive). */
export function ueqValues(answers: Record<string, number>): Record<string, number> {
  return Object.fromEntries(UEQ_ITEMS.map((id, i) => [id, UEQ_LEFT_POSITIVE.has(i + 1) ? 4 - answers[id] : answers[id] - 4]))
}

export type Scores = { score: number } | { scales: Record<UeqScaleId, number>; pragmatic: number; hedonic: number } | { mean: number }

export function scoreAnswers(instrument: InstrumentId, answers: Record<string, number>): Scores {
  if (instrument === 'SUS') {
    return { score: Object.values(susContributions(answers)).reduce((a, b) => a + b, 0) * 2.5 }
  }
  if (instrument === 'UEQ') {
    const values = ueqValues(answers)
    const scales = Object.fromEntries(
      UEQ_SCALE_IDS.map((id) => [id, mean(UEQ_SCALES[id].map((n) => values[`ueq${n}`]))]),
    ) as Record<UeqScaleId, number>
    return { scales, pragmatic: mean(UEQ_PRAGMATIC.map((id) => scales[id])), hedonic: mean(UEQ_HEDONIC.map((id) => scales[id])) }
  }
  return { mean: mean(Object.values(answers)) }
}

/** The one number of a submission that is followed over time. */
export function headline(instrument: InstrumentId, scores: Scores): number {
  if (instrument === 'SUS') return (scores as { score: number }).score
  if (instrument === 'UEQ') return mean(Object.values((scores as { scales: Record<string, number> }).scales))
  return (scores as { mean: number }).mean
}

/** A fresh ID for a submission. crypto.randomUUID needs a secure context, so there is a fallback for plain http. */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined') crypto.getRandomValues(bytes)
  else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256) })
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
