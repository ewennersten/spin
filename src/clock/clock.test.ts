import { expect, it } from 'vitest'
import { pause, position, seek, start, type ClockState } from './clock'

it('räknar position ur väggklockan', () => {
  const paused: ClockState = { running: false, anchorMs: 1000, posAtAnchorMs: 5000 }
  expect(position(paused, 99999)).toBe(5000)
  const running = start(paused, 2000)
  expect(position(running, 3000)).toBe(6000)
  expect(position(running, 3_600_000 + 2000)).toBe(3_605_000)
  const again = pause(running, 3000)
  expect(again).toEqual({ running: false, anchorMs: 3000, posAtAnchorMs: 6000 })
  expect(position(seek(running, 0, 4000), 4500)).toBe(500)
  expect(seek(paused, 9000, 4000).running).toBe(false)
  expect(position({ running: true, anchorMs: 5000, posAtAnchorMs: 0 }, 1000)).toBe(0)
})
