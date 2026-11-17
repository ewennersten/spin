import { expect, it } from 'vitest'
import { BeatDetector } from './beat'

const run = (energyAt: (tMs: number) => number, sensitivity = 5) => {
  const d = new BeatDetector(); d.sensitivity = sensitivity
  let beats = 0
  for (let t = 0; t < 10000; t += 1000 / 60) if (d.feed(energyAt(t), t)) beats++
  return beats
}
const pulse = (periodMs: number) => (t: number) => (t % periodMs < 1000 / 60 ? 1 : 0.1)

it('hittar slagen i 130 slag per minut', () => {
  const beats = run(pulse(60000 / 130))
  expect(beats).toBeGreaterThanOrEqual(20)
  expect(beats).toBeLessThanOrEqual(22)
})
it('ger aldrig mer än 2,5 slag per sekund', () => {
  expect(run(pulse(100))).toBeLessThanOrEqual(26)
})
it('ger lika många slag när hela signalen är svagare', () => {
  const p = pulse(60000 / 130)
  expect(run(t => 0.05 * p(t))).toBe(run(p))
})
it('ger inga slag på jämnt ljud eller tystnad', () => {
  expect(run(() => 0.5)).toBe(0)
  expect(run(() => 0)).toBe(0)
})
it('klipper känsligheten till 1 till 10', () => {
  const d = new BeatDetector()
  d.sensitivity = 99; expect(d.sensitivity).toBe(10)
  d.sensitivity = -3; expect(d.sensitivity).toBe(1)
})
