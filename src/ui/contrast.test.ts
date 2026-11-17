import { expect, it } from 'vitest'
import { ZONES } from '../model/zones'
import { PLATE_ALPHA, contrastOnPlate } from './contrast'

const texts = ['#fff6f4', '#c9b8b6', ...ZONES.map(z => z.textColor)]
it.each(texts)('%s går att läsa på plattan även när det bakom är helvitt', hex => {
  expect(contrastOnPlate(hex, PLATE_ALPHA)).toBeGreaterThanOrEqual(7)
})
it('80 % täckning räcker inte för den dämpade texten', () => {
  expect(contrastOnPlate('#c9b8b6', 0.8)).toBeLessThan(7)
})
