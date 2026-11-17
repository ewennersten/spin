import { expect, it } from 'vitest'
import type { Segment } from '../model/types'
import { chartShapes } from './chart'

it('räknar ut formerna', () => {
  const one: Segment[] = [{ name: 'A', startSec: 0, durationSec: 60, fromPct: 60, toPct: 120 }]
  expect(chartShapes(one, 1000, 200)).toEqual([{ points: '1,200 1,100 999,0 999,200', fromColor: '#378ADD', toColor: '#E24B4A' }])
})
it('delar bredden efter tid och höjer skalan över 120', () => {
  const two: Segment[] = [
    { name: 'A', startSec: 0, durationSec: 30, fromPct: 150, toPct: 150 },
    { name: 'B', startSec: 30, durationSec: 90, fromPct: 75, toPct: 75 },
  ]
  expect(chartShapes(two, 1000, 200).map(s => s.points)).toEqual(['1,200 1,0 249,0 249,200', '251,200 251,100 999,100 999,200'])
})
it('klarar ett tomt pass', () => {
  expect(chartShapes([], 1000, 200)).toEqual([])
})
it('ger aldrig negativ bredd, även för ett block på 5 sekunder i ett pass på 70 minuter', () => {
  const short: Segment[] = [
    { name: 'A', startSec: 0, durationSec: 5, fromPct: 100, toPct: 100 },
    { name: 'B', startSec: 5, durationSec: 4195, fromPct: 55, toPct: 55 },
  ]
  const xs = chartShapes(short, 1000, 200)[0].points.split(' ').map(p => Number(p.split(',')[0]))
  expect(xs[3]).toBeGreaterThan(xs[0])
  expect(xs[0]).toBeGreaterThanOrEqual(0)
  expect(xs[3]).toBeLessThanOrEqual(5 / 4200 * 1000)
})
