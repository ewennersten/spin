import { expect, it } from 'vitest'
import { duplicateAt, durationError, fieldError, moveItem, nameError, newBlock, newGroup, removeAt } from './edit'
import type { Group, Item } from './types'
import { validateWorkout } from './validate'

it('flyttar inom listan och stannar vid kanterna', () => {
  expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
})
it('duplicerar med nya id:n på alla nivåer', () => {
  const g = newGroup()
  const [first, copy] = duplicateAt<Item>([g], 0) as Group[]
  expect(first).toBe(g)
  expect(copy.id).not.toBe(g.id)
  expect(copy.blocks.map(b => b.id)).not.toEqual(g.blocks.map(b => b.id))
  expect(copy.blocks.map(b => b.durationSec)).toEqual([240, 120])
})
it('tar bort utan att ändra originalet', () => {
  const list = ['a', 'b']
  expect(removeAt(list, 0)).toEqual(['b'])
  expect(list).toEqual(['a', 'b'])
})
it('ger nya block och grupper med briefens värden', () => {
  expect(newBlock()).toMatchObject({ kind: 'block', name: '', durationSec: 300, fromPct: 55, toPct: 55 })
  expect(newBlock().id).not.toBe(newBlock().id)
  const g = newGroup()
  expect(g.repeat).toBe(4)
  expect(g.blocks.map(b => [b.durationSec, b.fromPct, b.toPct])).toEqual([[240, 100, 100], [120, 55, 55]])
})
it('lägger kopian av ett block direkt efter och ändrar inte originallistan', () => {
  const list: Item[] = [newBlock(), newBlock()]
  const out = duplicateAt(list, 0)
  expect(out).toHaveLength(3)
  expect(list).toHaveLength(2)
  expect(out[1]).toEqual({ ...list[0], id: out[1].id })
  expect(out[1].id).not.toBe(list[0].id)
  expect(out[2]).toBe(list[1])
})
it('godkänner bara heltal inom gränserna i procent och upprepningar', () => {
  expect(fieldError('from', 300)).toBeNull()
  expect(fieldError('from', 301)).toBe('Från % måste vara ett heltal mellan 20 och 300')
  expect(fieldError('to', 19)).toBe('Till % måste vara ett heltal mellan 20 och 300')
  expect(fieldError('to', NaN)).not.toBeNull() // tomt fält
  expect(fieldError('from', 55.5)).not.toBeNull()
  expect(fieldError('repeat', 50)).toBeNull()
  expect(fieldError('repeat', 0)).toBe('Upprepa måste vara ett heltal mellan 1 och 50')
  expect(fieldError('repeat', 2.5)).not.toBeNull()
})
it('kräver minuter från 0 och sekunder från 0 till 59', () => {
  expect(fieldError('min', 0)).toBeNull()
  expect(fieldError('min', 500)).toBeNull() // längden kontrolleras för sig
  expect(fieldError('min', -1)).toBe('Minuter måste vara ett heltal från 0')
  expect(fieldError('min', 2.5)).toBe('Minuter måste vara ett heltal från 0')
  expect(fieldError('min', NaN)).not.toBeNull()
  expect(fieldError('sec', 59)).toBeNull()
  expect(fieldError('sec', 60)).toBe('Sekunder måste vara ett heltal mellan 0 och 59')
  expect(fieldError('sec', -30)).not.toBeNull()
})
it('håller längden mellan 5 sekunder och 3 timmar', () => {
  expect(durationError(0, 5)).toBeNull()
  expect(durationError(180, 0)).toBeNull()
  expect(durationError(0, 4)).toBe('Längden måste vara mellan 5 sekunder och 3 timmar')
  expect(durationError(180, 1)).not.toBeNull()
})
it('kräver namn på passet men inte på blocken, och högst 80 tecken', () => {
  expect(nameError('', false)).toBeNull()
  expect(nameError('  ', true)).toBe('Namnet får inte vara tomt')
  expect(nameError('x'.repeat(80), true)).toBeNull()
  expect(nameError('x'.repeat(81), false)).toBe('Namnet får vara högst 80 tecken')
})
it('släpper bara igenom värden som validateWorkout också godkänner', () => {
  const edges = [[0, 5, 20, 300], [180, 0, 300, 20]]
  for (const [min, sec, from, to] of edges) {
    expect([fieldError('min', min), fieldError('sec', sec), durationError(min, sec), fieldError('from', from), fieldError('to', to)]).toEqual([null, null, null, null, null])
    const block = { ...newBlock(), name: 'x'.repeat(80), durationSec: min * 60 + sec, fromPct: from, toPct: to }
    expect(validateWorkout({ id: 'w', name: 'P', items: [block, { ...newGroup(), repeat: 50 }], updatedAt: 0 }).ok).toBe(true)
  }
})
