import { expect, it } from 'vitest'
import { duplicateAt, moveItem, newBlock, newGroup, removeAt } from './edit'
import type { Group, Item } from './types'

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
