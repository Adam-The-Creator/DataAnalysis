/**
 * The detail levels of the viewer (requirement DRW-03): how far the server may simplify the strokes, in metres.
 * No point of a simplified stroke is further than this from where it was drawn.
 */
export const DETAIL_LEVELS = { full: 0, high: 0.001, medium: 0.003, low: 0.01 } as const
export type DetailLevel = keyof typeof DETAIL_LEVELS
