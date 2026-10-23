import type { TFunction } from 'i18next'

/** Mirrors GameType in the server's models/mongodb/models.py. */
export const GameType = {
  InnerChild: 0,
  WordForest: 1,
  Beach: 2,
  Room: 3,
  BilateralDrawing: 4,
  SafePlace: 5,
} as const

export type KnownGameType = (typeof GameType)[keyof typeof GameType]

export const knownGameTypes: KnownGameType[] = [0, 1, 2, 3, 4, 5]

function isKnown(id: number): id is KnownGameType {
  return (knownGameTypes as number[]).includes(id)
}

/** Unknown ids are shown as "Unknown (n)" instead of failing (requirement MET-05). */
export function gameTypeLabel(t: TFunction, id: number): string {
  return isKnown(id) ? t(`gameTypes.${id}`) : t('gameTypes.unknown', { id })
}
