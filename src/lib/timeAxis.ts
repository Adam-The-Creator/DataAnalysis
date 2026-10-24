import type { BreakMark, Drawing } from '@/api/types'
import { strokeTimes } from './geometry'

/**
 * The time axis of a drawing, like the analysis module builds it (analysis/common.py, TimeAxis). Used by the demo
 * stand-in and by the fallback for an older server. The real answers carry times on this axis already.
 *
 * A drawing can be continued after a break of hours or days, so a gap longer than BREAK_SECONDS between two strokes
 * is a break between sittings, cut down to BREAK_DISPLAY_MS on the axis.
 */
export const BREAK_SECONDS = 30 * 60
export const BREAK_DISPLAY_MS = 5000
export const IDLE_GAP_SECONDS = 5

export interface Interval {
  start: number
  end: number
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = []
  for (const interval of [...intervals].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

/** Gaps between the (merged) drawing intervals longer than BREAK_SECONDS. */
export function breaksBetween(intervals: Interval[]): Interval[] {
  const merged = mergeIntervals(intervals)
  const breaks: Interval[] = []
  for (let i = 1; i < merged.length; i++) {
    if (merged[i].start - merged[i - 1].end > BREAK_SECONDS * 1000) {
      breaks.push({ start: merged[i - 1].end, end: merged[i].start })
    }
  }
  return breaks
}

/** The pauses longer than gapMs, not counting the breaks between sittings. */
export function idlePeriods(intervals: Interval[], gapMs: number): Interval[] {
  const merged = mergeIntervals(intervals)
  const pauses: Interval[] = []
  for (let i = 1; i < merged.length; i++) {
    const gap = merged[i].start - merged[i - 1].end
    if (gap > gapMs && gap <= BREAK_SECONDS * 1000) {
      pauses.push({ start: merged[i - 1].end, end: merged[i].start })
    }
  }
  return pauses
}

export interface TimeAxis {
  /** Absolute time (ms) of the start of the drawing's activity. */
  origin: number
  breaks: Interval[]
  /** Absolute time to the axis. A time inside a break lands at the start of the break. */
  map(moment: number): number
  breakMarks(): BreakMark[]
}

export function buildTimeAxis(drawing: Drawing): TimeAxis {
  const intervals = mergeIntervals(
    drawing.lines.flatMap((line) => {
      const times = strokeTimes(line.points)
      return times ? [{ start: times.start, end: times.end }] : []
    }),
  )
  const breaks = breaksBetween(intervals)
  let origin = intervals[0]?.start
  if (origin === undefined) {
    // No strokes: the first event or tracked pose
    const others: number[] = (drawing.events ?? []).map((e) => e.utcMs)
    for (const behavior of drawing.trackedBehaviors ?? []) {
      for (const pose of [...behavior.head, ...behavior.rightHand, ...behavior.leftHand, ...behavior.player]) {
        if (pose.utcMs != null) others.push(pose.utcMs)
      }
    }
    origin = others.length ? Math.min(...others) : 0
  }
  const start = origin

  return {
    origin: start,
    breaks,
    map(moment) {
      let removed = 0
      for (const b of breaks) {
        if (moment >= b.end) {
          removed += b.end - b.start - BREAK_DISPLAY_MS
        } else if (moment > b.start) {
          return b.start - start - removed
        } else {
          break
        }
      }
      return moment - start - removed
    },
    breakMarks() {
      return breaks.map((b) => ({ atMs: this.map(b.start), realMs: b.end - b.start }))
    },
  }
}
