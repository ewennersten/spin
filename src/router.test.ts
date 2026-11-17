import { expect, it } from 'vitest'
import { parseRoute } from './router'

it('tolkar adresser', () => {
  expect(parseRoute('')).toEqual({ view: 'library' })
  expect(parseRoute('#/')).toEqual({ view: 'library' })
  expect(parseRoute('#/edit/abc')).toEqual({ view: 'edit', id: 'abc' })
  expect(parseRoute('#/run/abc')).toEqual({ view: 'run', id: 'abc' })
  expect(parseRoute('#/run/')).toEqual({ view: 'library' })
  expect(parseRoute('#/peppord')).toEqual({ view: 'pep' })
  expect(parseRoute('#/okänt/x')).toEqual({ view: 'library' })
})
