import { expect, it } from 'vitest'
import type { Segment } from '../model/types'
import { borgColor, borgPct, borgTicks, chartShapes, scaleTicks, scaleTop } from './chart'

it('ger skalsteg var 25:e procent under bildens topp, och var 50:e över 200', () => {
  expect(scaleTicks(120)).toEqual([25, 50, 75, 100])
  expect(scaleTicks(150)).toEqual([25, 50, 75, 100, 125])
  expect(scaleTicks(200)).toEqual([25, 50, 75, 100, 125, 150, 175])
  expect(scaleTicks(325)).toEqual([50, 100, 150, 200, 250, 300])
})

const at = (pct: number): Segment[] => [{ name: 'A', startSec: 0, durationSec: 60, fromPct: 50, toPct: pct }]
it('lägger skalans topp lite över passets högsta procent', () => {
  expect(scaleTop(at(115))).toBe(125)
  expect(scaleTop(at(110))).toBe(120)
  expect(scaleTop(at(70))).toBe(80)
  expect(scaleTop(at(230))).toBe(250)
  expect(scaleTop([])).toBe(100)
})
it('räknar ut formerna', () => {
  const one: Segment[] = [{ name: 'A', startSec: 0, durationSec: 60, fromPct: 62.5, toPct: 115 }] // toppen 125
  expect(chartShapes(one, 1000, 200)).toEqual([{ points: '1,200 1,100 999,16 999,200', fromColor: '#378ADD', toColor: '#E24B4A' }])
})
it('delar bredden efter tid', () => {
  const two: Segment[] = [
    { name: 'A', startSec: 0, durationSec: 30, fromPct: 230, toPct: 230 }, // toppen 250
    { name: 'B', startSec: 30, durationSec: 90, fromPct: 125, toPct: 125 },
  ]
  expect(chartShapes(two, 1000, 200).map(s => s.points)).toEqual(['1,200 1,16 249,16 249,200', '251,200 251,100 999,100 999,200'])
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

it('räknar om Borgskalan till procent av FTP', () => {
  expect(borgPct(6)).toBe(20)
  expect(borgPct(12)).toBe(75)
  expect(borgPct(16)).toBe(105)
  expect(borgPct(17)).toBeCloseTo(112.5)
  expect(borgPct(20)).toBe(150)
  for (let b = 6; b < 20; b++) expect(borgPct(b + 1)).toBeGreaterThan(borgPct(b))
})
it('visar bara Borgvärden som ryms under bildens topp', () => {
  expect(borgTicks(125)).toEqual([6, 8, 10, 12, 14, 16, 18])
  expect(borgTicks(80)).toEqual([6, 8, 10, 12])
  expect(borgTicks(165)).toEqual([6, 8, 10, 12, 14, 16, 18, 20])
})

it('ger varje Borgvärde på skalan en egen färg, läsbar mot den mörka skärmen', () => {
  const colors = borgTicks(200).map(borgColor)
  expect(new Set(colors).size).toBe(colors.length)
  for (const hex of colors) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    expect((lum + 0.05) / 0.05).toBeGreaterThanOrEqual(4.5) // mot svart
  }
})
