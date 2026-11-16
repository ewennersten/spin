import { expect, it } from 'vitest'
import type { Workout } from '../model/types'
import type { KV } from '../storage/storage'
import type { ClockState } from './clock'
import { clearRun, loadRun, saveRun } from './runState'

const fakeKV = (init: Record<string, string> = {}): KV & { data: Map<string, string> } => {
  const data = new Map(Object.entries(init))
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) }
}

const wk: Workout = { id: 'w', name: 'P', items: [], updatedAt: 7 }
const clock: ClockState = { running: true, anchorMs: 1000, posAtAnchorMs: 0 }
const H4 = 4 * 3600 * 1000
it('återupptar bara samma oförändrade pass inom fyra timmar', () => {
  const kv = fakeKV()
  saveRun(kv, wk, clock, 1000)
  expect(loadRun(kv, wk, 1000 + H4 - 1)).toEqual(clock)
  expect(loadRun(kv, wk, 1000 + H4)).toBeNull()
  expect(loadRun(kv, { ...wk, updatedAt: 8 }, 2000)).toBeNull()
  expect(loadRun(kv, { ...wk, id: 'annat' }, 2000)).toBeNull()
  clearRun(kv)
  expect(loadRun(kv, wk, 2000)).toBeNull()
})
it('tål trasig data', () => {
  expect(loadRun(fakeKV({ 'spinning.run.v1': '{' }), wk, 0)).toBeNull()
  const badClock = JSON.stringify({ workoutId: 'w', updatedAt: 7, savedAtMs: 0, clock: { running: 'ja', anchorMs: 0, posAtAnchorMs: 0 } })
  expect(loadRun(fakeKV({ 'spinning.run.v1': badClock }), wk, 0)).toBeNull()
  expect(loadRun(fakeKV({ 'spinning.run.v1': 'null' }), wk, 0)).toBeNull()
})
