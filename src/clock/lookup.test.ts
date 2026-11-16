import { expect, it } from 'vitest'
import type { Segment } from '../model/types'
import { locate, nextStartMs, prevStartMs } from './lookup'

const segs: Segment[] = [
  { name: 'A', startSec: 0, durationSec: 60, fromPct: 50, toPct: 70 },
  { name: 'B', startSec: 60, durationSec: 30, fromPct: 100, toPct: 100 },
  { name: 'C', startSec: 90, durationSec: 60, fromPct: 55, toPct: 55 },
]
it('hittar aktuellt block', () => {
  expect(locate(segs, 0)).toMatchObject({ done: false, index: 0, remainingMs: 60000, pctNow: 50 })
  expect(locate(segs, 30000).pctNow).toBe(60)
  expect(locate(segs, 60000)).toMatchObject({ index: 1, elapsedMs: 0, remainingMs: 30000 })
})
it('ger klart efter slutet och för tomt pass', () => {
  expect(locate(segs, 150000)).toMatchObject({ done: true, index: 3, segment: null })
  expect(locate(segs, 9e9).done).toBe(true)
  expect(locate([], 0).done).toBe(true)
})
it('hoppar framåt och bakåt', () => {
  expect(nextStartMs(segs, 10000)).toBe(60000)
  expect(nextStartMs(segs, 100000)).toBe(150000)
  expect(prevStartMs(segs, 70000)).toBe(60000)
  expect(prevStartMs(segs, 62000)).toBe(0)
  expect(prevStartMs(segs, 1000)).toBe(0)
})
it('hoppar rätt vid gränsen på 3000 ms, efter slutet och i tomt pass', () => {
  expect(prevStartMs(segs, 63000)).toBe(60000)
  expect(prevStartMs(segs, 200000)).toBe(90000)
  expect(nextStartMs(segs, 200000)).toBe(150000)
  expect(prevStartMs([], 5000)).toBe(0)
  expect(nextStartMs([], 5000)).toBe(0)
})
