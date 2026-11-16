import type { Block, Group, Item } from './types'
import { LIMITS } from './validate'

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

// Fälten i redigeraren. Ett värde som släpps igenom här godkänns också av validateWorkout.
export type NumberField = 'min' | 'sec' | 'from' | 'to' | 'repeat'
const FIELDS: Record<NumberField, [what: string, lo: number, hi: number]> = {
  min: ['Minuter', 0, Infinity], // övre gränsen gäller hela längden, se durationError
  sec: ['Sekunder', 0, 59],
  from: ['Från %', LIMITS.pctMin, LIMITS.pctMax],
  to: ['Till %', LIMITS.pctMin, LIMITS.pctMax],
  repeat: ['Upprepa', LIMITS.repeatMin, LIMITS.repeatMax],
}

// Felet i ett sifferfälts värde (valueAsNumber, som är NaN för ett tomt fält), eller null om värdet är giltigt.
export function fieldError(field: NumberField, value: number): string | null {
  const [what, lo, hi] = FIELDS[field]
  if (Number.isInteger(value) && value >= lo && value <= hi) return null
  return `${what} måste vara ett heltal ${hi === Infinity ? `från ${lo}` : `mellan ${lo} och ${hi}`}`
}

export function durationError(min: number, sec: number): string | null {
  const total = min * 60 + sec
  return total >= LIMITS.durMinSec && total <= LIMITS.durMaxSec ? null
    : `Längden måste vara mellan ${LIMITS.durMinSec} sekunder och ${LIMITS.durMaxSec / 3600} timmar`
}

export function nameError(name: string, required: boolean): string | null {
  if (required && name.trim() === '') return 'Namnet får inte vara tomt'
  return name.length > LIMITS.nameMax ? `Namnet får vara högst ${LIMITS.nameMax} tecken` : null
}
