import { expect, it } from 'vitest'
import { mmss, pctText } from './format'

it('formaterar tid och procent', () => {
  expect([mmss(0), mmss(312), mmss(4110)]).toEqual(['00:00', '05:12', '68:30'])
  expect(pctText(105, 105)).toBe('105 %')
  expect(pctText(50, 75)).toBe('50 → 75 %')
})
