import type { Block, Group, Item } from './types'

const newId = () => crypto.randomUUID()
const block = (durationSec: number, pct: number): Block => ({ kind: 'block', id: newId(), name: '', durationSec, fromPct: pct, toPct: pct })

export function newBlock(): Block {
  return block(300, 55)
}

export function newGroup(): Group {
  return { kind: 'group', id: newId(), repeat: 4, blocks: [block(240, 100), block(120, 55)] }
}

export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta
  const out = [...list]
  if (to < 0 || to >= list.length) return out
  ;[out[index], out[to]] = [out[to], out[index]]
  return out
}

export function duplicateAt<T extends Item>(list: T[], index: number): T[] {
  const i = list[index]
  const copy = i.kind === 'block'
    ? { ...i, id: newId() }
    : { ...i, id: newId(), blocks: i.blocks.map(b => ({ ...b, id: newId() })) }
  return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index)
}
