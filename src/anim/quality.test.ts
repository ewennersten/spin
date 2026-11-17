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
