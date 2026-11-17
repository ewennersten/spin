import { expect, it } from 'vitest'
import { bandLevel } from './bands'

it('mäter nivån i ett frekvensband', () => {
  const db = new Float32Array(1024).fill(-Infinity)
  for (let i = 2; i <= 6; i++) db[i] = 0             // fack 2 till 6 är 46,9 till 140,6 Hz vid 48 kHz och 2048
  expect(bandLevel(db, 48000, 2048, 40, 150)).toBe(1)
  expect(bandLevel(db, 48000, 2048, 150, 2000)).toBe(0)
  expect(bandLevel(db, 48000, 2048, 1, 2)).toBe(0)
})
it('räknar om decibel till linjär amplitud', () => {
  const db = new Float32Array(1024).fill(-Infinity)
  for (let i = 2; i <= 6; i++) db[i] = -20
  expect(bandLevel(db, 48000, 2048, 40, 150)).toBeCloseTo(0.1, 6)
})
