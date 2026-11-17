import { expect, it } from 'vitest'
import { bannerVisible, buildupLevel, celebrates, countdownNumber, jumped, pepAllowed, pepIntervalSec } from './cues'

it('räknar ned de sista fem sekunderna på block från 15 sekunder', () => {
  expect(countdownNumber(15, 5001)).toBeNull()
  expect(countdownNumber(15, 5000)).toBe(5)
  expect(countdownNumber(15, 4200)).toBe(5)
  expect(countdownNumber(15, 800)).toBe(1)
  expect(countdownNumber(15, 0)).toBeNull()
  expect(countdownNumber(14, 3000)).toBeNull()
})
it('visar banderollen i tre sekunder', () => {
  expect(bannerVisible(0)).toBe(true)
  expect(bannerVisible(2999)).toBe(true)
  expect(bannerVisible(3000)).toBe(false)
})
it('ger tätare peppord ju högre procent', () => {
  expect(pepIntervalSec(87.9)).toBeNull()
  expect(pepIntervalSec(88)).toBe(90)
  expect(pepIntervalSec(104)).toBe(57.5)
  expect(pepIntervalSec(120)).toBe(25)
  expect(pepIntervalSec(150)).toBe(25)
})
it('håller peppord borta från banderoll och blockets slut', () => {
  expect(pepAllowed(100, 3000, 14001)).toBe(true)
  expect(pepAllowed(100, 2999, 60000)).toBe(false)
  expect(pepAllowed(100, 30000, 14000)).toBe(false)
  expect(pepAllowed(80, 30000, 60000)).toBe(false)
})
it('märker när positionen har hoppat', () => {
  expect(jumped(1000, 1016)).toBe(false)
  expect(jumped(1000, 3000)).toBe(false)
  expect(jumped(1000, 3001)).toBe(true)
  expect(jumped(600000, 9e9)).toBe(true)
  expect(jumped(5000, 4000)).toBe(true)
})
it('firar bara hårda block med nedräkning', () => {
  const block = (durationSec: number, fromPct: number, toPct: number) => ({ name: '', startSec: 0, durationSec, fromPct, toPct })
  expect(celebrates(block(240, 115, 115))).toBe(true)
  expect(celebrates(block(30, 110, 110))).toBe(true)
  expect(celebrates(block(600, 60, 76))).toBe(true)
  expect(celebrates(block(90, 55, 55))).toBe(false)
  expect(celebrates(block(600, 45, 70))).toBe(false)
  expect(celebrates(block(10, 120, 120))).toBe(false)
})

it('bygger upp de sista tio sekunderna av ett hårt block', () => {
  const hard = { name: 'VO2max', startSec: 0, durationSec: 240, fromPct: 115, toPct: 115 }
  const rest = { ...hard, fromPct: 55, toPct: 55 }
  expect(buildupLevel(hard, rest, 10_001)).toBeNull()
  expect(buildupLevel(hard, rest, 10_000)).toBe(0)
  expect(buildupLevel(hard, rest, 5_000)).toBeCloseTo(0.5)
  expect(buildupLevel(hard, undefined, 0)).toBeNull()
  expect(buildupLevel(rest, rest, 5_000)).toBeNull() // vila före vila
  expect(buildupLevel(rest, undefined, 5_000)).toBeNull() // sista blocket
})
it('bygger också upp de sista tio sekunderna före ett hårt block', () => {
  const hard = { name: 'VO2max', startSec: 0, durationSec: 240, fromPct: 115, toPct: 115 }
  const rest = { ...hard, fromPct: 50, toPct: 50 }
  expect(buildupLevel(rest, hard, 5_000)).toBeCloseTo(0.5)
  expect(buildupLevel(rest, hard, 20_000)).toBeNull()
})
