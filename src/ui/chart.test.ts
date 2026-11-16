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
