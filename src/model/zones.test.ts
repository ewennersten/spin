import { expect, it } from 'vitest'
import { zoneFor } from './zones'

it('väljer zon efter undre gräns', () => {
  const id = (p: number) => zoneFor(p).id
  expect([id(0), id(59.9), id(60), id(75.5), id(76), id(88), id(95), id(105.9), id(106), id(200)])
    .toEqual(['vila', 'vila', 'lugnt', 'lugnt', 'tempo', 'sweetspot', 'troskel', 'troskel', 'vo2max', 'vo2max'])
})
