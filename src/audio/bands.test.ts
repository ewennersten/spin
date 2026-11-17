import { expect, it } from 'vitest'
import { bandEnergy } from './bands'

it('mäter energin i ett frekvensband', () => {
  const freq = new Uint8Array(1024)
  for (let i = 2; i <= 6; i++) freq[i] = 255        // fack 2 till 6 är 46,9 till 140,6 Hz vid 48 kHz och 2048
  expect(bandEnergy(freq, 48000, 2048, 40, 150)).toBe(1)
  expect(bandEnergy(freq, 48000, 2048, 150, 2000)).toBe(0)
  expect(bandEnergy(freq, 48000, 2048, 1, 2)).toBe(0)
})
