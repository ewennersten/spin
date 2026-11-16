import { expect, it } from 'vitest'
import { flatten, totalDuration } from './flatten'
import type { Block, Group, Item, Workout } from './types'

const b = (durationSec: number, fromPct: number, toPct = fromPct, name = ''): Block =>
  ({ kind: 'block', id: crypto.randomUUID(), name, durationSec, fromPct, toPct })
const g = (repeat: number, ...blocks: Block[]): Group => ({ kind: 'group', id: crypto.randomUUID(), repeat, blocks })
const w = (...items: Item[]): Workout => ({ id: 'w', name: 'Test', items, updatedAt: 0 })
const names = (wk: Workout) => flatten(wk).map(s => s.name)

it('plattar ut grupper med starttider och numrering', () => {
  const segs = flatten(w(g(4, b(480, 100), b(180, 55))))
  expect(segs).toHaveLength(8)
  expect(segs[2]).toMatchObject({ name: 'Tröskel 2 av 4', startSec: 660, durationSec: 480 })
  expect(segs[3].name).toBe('Vila 2 av 4')
  expect(totalDuration(segs)).toBe(2640)
})
it('namnger uppvärmning, nedvarvning och sneda block', () => {
  expect(names(w(b(600, 45, 70), b(300, 80, 100), b(600, 60, 40)))).toEqual(['Uppvärmning', 'Sweetspot', 'Nedvarvning'])
})
it('lägger till procent när grannar har samma zon', () => {
  expect(names(w(g(2, b(120, 105), b(60, 95))))).toEqual(
    ['Tröskel 105 % 1 av 2', 'Tröskel 95 % 1 av 2', 'Tröskel 105 % 2 av 2', 'Tröskel 95 % 2 av 2'])
})
it('behåller egna namn och hoppar över numrering vid en upprepning', () => {
  expect(names(w(g(2, b(60, 110, 110, 'Över'))))).toEqual(['Över 1 av 2', 'Över 2 av 2'])
  expect(names(w(g(1, b(60, 100))))).toEqual(['Tröskel'])
})
it('räknar ett namn med bara blanksteg som tomt', () => {
  expect(names(w(b(60, 100, 100, '  ')))).toEqual(['Tröskel'])
})
it('klarar ett tomt pass', () => {
  expect(flatten(w())).toEqual([])
  expect(totalDuration([])).toBe(0)
})
