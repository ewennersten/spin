import { expect, it } from 'vitest'
import { LightGovernor, MAX_MEAN, RISE_PER_400MS } from './governor'

it('jämnt ljus lämnas orört', () => {
  const g = new LightGovernor()
  let gain = 1
  for (let t = 0; t < 2000; t += 16) gain = g.update(0.1, 16)
  expect(gain).toBeCloseTo(1)
})
it('ett plötsligt ljust ögonblick dämpas så att ljuset stiger högst 0,08 per 400 ms', () => {
  const g = new LightGovernor()
  for (let t = 0; t < 2000; t += 16) g.update(0.05, 16)
  let shown = 0.05
  for (let t = 0; t < 400; t += 16) shown = 0.15 * g.update(0.15, 16)
  expect(shown - 0.05).toBeLessThanOrEqual(RISE_PER_400MS + 1e-9)
})
it('medelljuset hålls under taket även när bilden är ljus länge', () => {
  const g = new LightGovernor()
  let gain = 1
  for (let t = 0; t < 20000; t += 16) gain = g.update(0.6, 16)
  expect(0.6 * gain).toBeCloseTo(MAX_MEAN)
})
it('ljuset får sjunka direkt, och svart bild ger förstärkning 1', () => {
  const g = new LightGovernor()
  for (let t = 0; t < 5000; t += 16) g.update(0.15, 16)
  expect(g.update(0.01, 16)).toBe(1)
  expect(g.update(0, 16)).toBe(1)
})
it('ett glapp på tio sekunder ger inget hopp i ljus', () => {
  const g = new LightGovernor()
  for (let t = 0; t < 2000; t += 16) g.update(0.02, 16)
  expect(0.5 * g.update(0.5, 10000) - 0.02).toBeLessThanOrEqual(RISE_PER_400MS * 100 / 400 + 1e-9)
})
