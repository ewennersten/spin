import type { Segment } from '../model/types'

export interface Located { done: boolean; index: number; segment: Segment | null; elapsedMs: number; remainingMs: number; pctNow: number }

const endMs = (s: Segment) => (s.startSec + s.durationSec) * 1000

export function locate(segments: Segment[], posMs: number): Located {
  // Strikt mindre än slutet: en position exakt på en gräns hör till det senare blocket.
  const index = segments.findIndex(s => posMs < endMs(s))
  if (index < 0) return { done: true, index: segments.length, segment: null, elapsedMs: 0, remainingMs: 0, pctNow: 0 }
  const segment = segments[index]
  const durMs = segment.durationSec * 1000
  const elapsedMs = posMs - segment.startSec * 1000
  return { done: false, index, segment, elapsedMs, remainingMs: durMs - elapsedMs, pctNow: segment.fromPct + (segment.toPct - segment.fromPct) * elapsedMs / durMs }
}

// Blocken ligger kant i kant (flatten), så blockets slut är nästa blocks start, och sista blockets slut är passets slut.
export function nextStartMs(segments: Segment[], posMs: number): number {
  const s = locate(segments, posMs).segment ?? segments.at(-1)
  return s ? endMs(s) : 0
}

export function prevStartMs(segments: Segment[], posMs: number): number {
  const { done, index, elapsedMs } = locate(segments, posMs)
  const i = Math.max(0, done || elapsedMs < 3000 ? index - 1 : index)
  return (segments[i]?.startSec ?? 0) * 1000
}
