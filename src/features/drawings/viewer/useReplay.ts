import { useCallback, useEffect, useRef, useState } from 'react'

export const REPLAY_SPEEDS = [0.5, 1, 2, 4, 8] as const

export interface Replay {
  /** The drawing has time data to replay. */
  available: boolean
  /** The viewer shows the state at `time` instead of the whole drawing. */
  active: boolean
  playing: boolean
  /** Milliseconds on the drawing's time axis. */
  time: number
  duration: number
  speed: number
  /** Starts at the beginning, or continues, and plays. */
  play(): void
  pause(): void
  seek(ms: number): void
  setSpeed(speed: number): void
  /** Back to the whole drawing. */
  stop(): void
}

/**
 * The clock of the replay (requirement DRW-05). It advances by the time between two animation frames times the
 * speed, and tells React about 30 times a second at most.
 */
export function useReplay(duration: number, available: boolean): Replay {
  const [state, setState] = useState({ active: false, playing: false, time: 0, speed: 1 })
  const clock = useRef(0)

  useEffect(() => {
    if (!state.playing) return
    let frame = 0
    let last = performance.now()
    let shown = last
    clock.current = state.time

    const tick = (now: number) => {
      clock.current = Math.min(duration, clock.current + (now - last) * state.speed)
      last = now
      const finished = clock.current >= duration
      if (finished || now - shown >= 33) {
        shown = now
        const time = clock.current
        setState((s) => ({ ...s, time, playing: finished ? false : s.playing }))
      }
      if (!finished) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // The clock restarts from the shown time whenever playing or the speed changes, not on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.playing, state.speed, duration])

  const play = useCallback(() => {
    setState((s) => ({ ...s, active: true, playing: true, time: s.active && s.time < duration ? s.time : 0 }))
  }, [duration])
  const pause = useCallback(() => setState((s) => ({ ...s, playing: false })), [])
  const seek = useCallback((ms: number) => {
    setState((s) => ({ ...s, active: true, time: Math.max(0, Math.min(duration, ms)) }))
  }, [duration])
  const setSpeed = useCallback((speed: number) => setState((s) => ({ ...s, speed })), [])
  const stop = useCallback(() => setState((s) => ({ ...s, active: false, playing: false, time: 0 })), [])

  return { available, ...state, duration, play, pause, seek, setSpeed, stop }
}

/** "m:ss" of a time in milliseconds. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
