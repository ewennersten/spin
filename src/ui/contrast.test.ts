import { expect, it } from 'vitest'
import { ZONES } from '../model/zones'
import { PLATE_ALPHA, contrastOnPlate } from './contrast'

const texts = ['#f1efe8', '#b4b2a9', ...ZONES.map(z => z.textColor)]
it.each(texts)('%s går att läsa på plattan även när det bakom är helvitt', hex => {
  expect(contrastOnPlate(hex, PLATE_ALPHA)).toBeGreaterThanOrEqual(7)
})
it('85 % täckning räcker inte för den dämpade texten', () => {
  expect(contrastOnPlate('#b4b2a9', 0.85)).toBeLessThan(7)
})
