import type { Block, Group, Item, Workout } from './types'

export const LIMITS = { pctMin: 20, pctMax: 300, durMinSec: 5, durMaxSec: 10800, repeatMin: 1, repeatMax: 50, nameMax: 80 }
export type Validation = { ok: true; workout: Workout } | { ok: false; error: string }

type Obj = Record<string, unknown>
class Invalid extends Error {}

function fail(message: string): never { throw new Invalid(message) }

function obj(v: unknown, what: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${what} måste vara ett objekt`)
  return v as Obj
}

function list(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) fail(`${what} måste vara en lista`)
  return Array.from(v) // Array.from gör hål i glesa listor till undefined så att de avvisas
}

function str(v: unknown, what: string): string {
  if (typeof v !== 'string') fail(`${what} måste vara text`)
  return v
}

function name(v: unknown, what: string): string {
  const s = str(v, what)
  if (s.length > LIMITS.nameMax) fail(`${what} får vara högst ${LIMITS.nameMax} tecken`)
  return s
}

function num(v: unknown, what: string, min: number, max: number, span: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${what} måste vara ett tal`)
  if (v < min || v > max) fail(`${what} måste vara mellan ${span}`)
  return v
}

function int(v: unknown, what: string, min: number, max: number, span: string, whole = 'ett heltal'): number {
  const n = num(v, what, min, max, span)
  if (!Number.isInteger(n)) fail(`${what} måste vara ${whole}`)
  return n
}

const pctSpan = `${LIMITS.pctMin} och ${LIMITS.pctMax}`
const durSpan = `${LIMITS.durMinSec} sekunder och ${LIMITS.durMaxSec / 3600} timmar`

function block(v: unknown, where: string): Block {
  const b = obj(v, `${where}:`)
  if (b.kind === 'group') fail(`${where}: grupper kan inte innehålla grupper`)
  if (b.kind !== 'block') fail(`${where}: okänd typ`)
  return {
    kind: 'block',
    id: str(b.id, `${where}: id`),
    name: name(b.name, `${where}: namn`),
    durationSec: int(b.durationSec, `${where}: längd`, LIMITS.durMinSec, LIMITS.durMaxSec, durSpan, 'hela sekunder'),
    fromPct: int(b.fromPct, `${where}: procent`, LIMITS.pctMin, LIMITS.pctMax, pctSpan),
    toPct: int(b.toPct, `${where}: procent`, LIMITS.pctMin, LIMITS.pctMax, pctSpan),
  }
}

function group(g: Obj, where: string): Group {
  return {
    kind: 'group',
    id: str(g.id, `${where}: id`),
    repeat: int(g.repeat, `${where}: upprepningar`, LIMITS.repeatMin, LIMITS.repeatMax, `${LIMITS.repeatMin} och ${LIMITS.repeatMax}`),
    blocks: list(g.blocks, `${where}: blocken`).map((x, i) => block(x, `${where}, block ${i + 1}`)),
  }
}

function item(v: unknown, n: number): Item {
  const o = obj(v, `Block ${n}:`)
  return o.kind === 'group' ? group(o, `Grupp ${n}`) : block(o, `Block ${n}`)
}

export function validateWorkout(input: unknown): Validation {
  try {
    const w = obj(input, 'Passet')
    const id = str(w.id, 'Passets id')
    const wName = name(w.name, 'Passets namn')
    if (wName.trim() === '') fail('Passets namn får inte vara tomt')
    const updatedAt = w.updatedAt === undefined ? 0 : num(w.updatedAt, 'Passets ändringstid', -Infinity, Infinity, '')
    const items = list(w.items, 'Passets block').map((x, i) => item(x, i + 1))
    return { ok: true, workout: { id, name: wName, items, updatedAt } }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message }
    throw e
  }
}
