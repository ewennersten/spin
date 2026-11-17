import { expect, it } from 'vitest'
import { VARIANTS, envelope, pickVariant } from './drops'

it('slumpar bland alla sex varianterna, men aldrig samma två gånger i rad', () => {
  const seen = new Set<string>()
  let last = pickVariant(null, () => 0)
  for (let i = 0; i < 300; i++) {
    const next = pickVariant(last)
    expect(next).not.toBe(last)
    seen.add(next)
    last = next
  }
  expect(seen.size).toBe(VARIANTS.length)
  expect(pickVariant(null, () => 0.999)).toBe(VARIANTS[VARIANTS.length - 1])
})

it('tonar ut mjukt under andra halvan', () => {
  expect(envelope(0)).toBe(1)
  expect(envelope(0.5)).toBe(1)
  expect(envelope(0.75)).toBeCloseTo(0.5)
  expect(envelope(1)).toBe(0)
  for (let p = 0.5; p < 1; p += 0.01) expect(envelope(p + 0.01)).toBeLessThanOrEqual(envelope(p))
})
