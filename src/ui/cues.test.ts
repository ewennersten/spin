import { expect, it } from 'vitest'
import { bannerVisible, countdownNumber, jumped, pepAllowed, pepIntervalSec } from './cues'

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
