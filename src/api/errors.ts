/** A failed request. The kind tells the UI which message to show (the texts live in the translations). */
export class ApiError extends Error {
  kind: 'network' | 'http'
  status: number | null
  /** The server's own message (FastAPI "detail"), when there is one. */
  detail: string | null

  constructor(kind: 'network' | 'http', status: number | null = null, detail: string | null = null) {
    super(detail ?? (kind === 'network' ? 'Network error' : `HTTP ${status}`))
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.detail = detail
  }
}

/** The features that need the missing server module. The ids are translation keys (notImplemented.features.*). */
export type FeatureId =
  | 'overTime'
  | 'recentDrawings'
  | 'thumbnails'
  | 'metrics'
  | 'sessionStats'
  | 'reports'
  | 'reportGeneration'

/**
 * A feature that needs a part of the server that does not exist yet (mostly the analysis module, TEC-02).
 * The UI shows a "not implemented" panel instead of a generic error, so the gaps stay visible.
 */
export class NotImplementedError extends Error {
  feature: FeatureId
  requirements: string[]

  constructor(feature: FeatureId, requirements: string[]) {
    super(`Not implemented: ${feature}`)
    this.name = 'NotImplementedError'
    this.feature = feature
    this.requirements = requirements
  }
}

export function notImplemented(feature: FeatureId, ...requirements: string[]): never {
  throw new NotImplementedError(feature, requirements)
}
