import { expect, it } from 'vitest'
import { follow } from './discoball'

it('discokulans prickar tonas in och ut mjukt, utan hopp efter ett långt glapp', () => {
  expect(follow(0, 1, 0)).toBe(0)
  expect(follow(0, 1, 900)).toBeCloseTo(0.1, 1) // glappet räknas som högst 100 ms
  expect(follow(0, 1, 100)).toBeCloseTo(1 - Math.exp(-100 / 900))
  let v = 1
  for (let t = 0; t < 5000; t += 16) v = follow(v, 0, 16)
  expect(v).toBeLessThan(0.01)
})
