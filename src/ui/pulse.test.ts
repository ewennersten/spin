import { expect, it } from 'vitest'
import { PERIOD, waveY } from './pulse'

it('ritar ett EKG-slag som upprepas', () => {
  expect(waveY(0)).toBe(0)
  expect(waveY(30)).toBe(0)
  expect(waveY(128)).toBe(-52) // toppen
  expect(waveY(140)).toBe(32) // dalen
  expect(waveY(134)).toBe(-10) // mitt emellan
  expect(waveY(128 + PERIOD * 3)).toBe(-52)
  expect(waveY(240)).toBe(0)
})
