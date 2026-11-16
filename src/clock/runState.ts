import type { Workout } from '../model/types'
import type { KV } from '../storage/storage'
import type { ClockState } from './clock'

const KEY = 'spinning.run.v1'
const MAX_AGE_MS = 14_400_000

export function saveRun(kv: KV, workout: Workout, clock: ClockState, nowMs: number): void {
  kv.setItem(KEY, JSON.stringify({ workoutId: workout.id, updatedAt: workout.updatedAt, savedAtMs: nowMs, clock }))
}

export function loadRun(kv: KV, workout: Workout, nowMs: number): ClockState | null {
  try {
    const r = JSON.parse(kv.getItem(KEY) ?? 'null')
    const c = r?.clock
    if (r?.workoutId !== workout.id || r.updatedAt !== workout.updatedAt || !(nowMs - r.savedAtMs < MAX_AGE_MS)) return null
    if (typeof c?.running !== 'boolean' || !Number.isFinite(c.anchorMs) || !Number.isFinite(c.posAtAnchorMs)) return null
    return { running: c.running, anchorMs: c.anchorMs, posAtAnchorMs: c.posAtAnchorMs }
  } catch {
    return null
  }
}

export function clearRun(kv: KV): void {
  kv.removeItem(KEY)
}
