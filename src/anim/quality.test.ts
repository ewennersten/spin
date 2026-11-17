import { expect, it } from 'vitest'
import { QualityController } from './quality'

const run = (q: QualityController, fps: number, ms: number) => { for (let t = 0; t < ms; t += 1000 / fps) q.frame(1000 / fps) }
it('stannar på bästa nivån vid 60 bilder per sekund', () => {
  const q = new QualityController(); run(q, 60, 10000); expect(q.level).toBe(0)
})
it('går ned en nivå per två sekunder under 50 bilder per sekund, högst till nivå 2', () => {
  const q = new QualityController()
  run(q, 40, 2100); expect(q.level).toBe(1)
  run(q, 40, 2100); expect(q.level).toBe(2)
  run(q, 40, 6000); expect(q.level).toBe(2)
})
it('går upp en nivå efter sex sekunder med marginal', () => {
  const q = new QualityController(); q.level = 2
  run(q, 60, 6100); expect(q.level).toBe(1)
})
it('räknar inte bildrutor efter en dold flik', () => {
  const q = new QualityController(); run(q, 60, 1000)
  q.frame(5000)
  run(q, 60, 1500)
  expect(q.level).toBe(0)
})
it('pendlar inte mellan två nivåer på en dator som klarar nivå 1 men inte nivå 0', () => {
  const q = new QualityController()
  const changes: number[] = []
  let last = q.level
  for (let t = 0; t < 120000; t += 0) {
    const dt = q.level === 0 ? 25 : 1000 / 60 // 40 bilder/s på nivå 0, 60 på nivå 1
    q.frame(dt)
    t += dt
    if (q.level !== last) { changes.push(t); last = q.level }
  }
  expect(changes.length).toBeLessThanOrEqual(3) // ned, upp, ned, och sedan stilla
  expect(q.level).toBe(1)
})
it('ett fönster mellan 50 och 58 bilder/s bryter följden mot att gå upp', () => {
  const q = new QualityController(); q.level = 1
  for (let t = 0; t < 4000; t += 1000 / 60) q.frame(1000 / 60) // två fönster med marginal
  for (let t = 0; t < 2000; t += 1000 / 54) q.frame(1000 / 54) // ett fönster utan marginal
  for (let t = 0; t < 4000; t += 1000 / 60) q.frame(1000 / 60) // två till med marginal
  expect(q.level).toBe(1)
})
it('en nivå utanför spannet kläms in', () => {
  const q = new QualityController(); q.level = 7
  q.frame(16)
  expect(q.level).toBe(2)
})
