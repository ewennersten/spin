import { expect, it } from 'vitest'
import { EXAMPLES } from '../model/examples'
import { flatten, totalDuration } from '../model/flatten'
import { validateWorkout } from '../model/validate'
import { createStorage, type KV } from './storage'

const fakeKV = (init: Record<string, string> = {}): KV & { data: Map<string, string> } => {
  const data = new Map(Object.entries(init))
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) }
}
const KEY = 'spinning.workouts.v1'

it('fyller på med exempelpass första gången', async () => {
  const s = createStorage(fakeKV())
  expect((await s.listWorkouts()).map(w => w.name)).toEqual(['Sweetspot 3 × 12 min', 'Tröskel 4 × 8 min', 'VO2max 5 × 4 min'])
})
it('sparar, hämtar och tar bort', async () => {
  const s = createStorage(fakeKV({ [KEY]: '[]' }))
  await s.saveWorkout({ id: 'a', name: 'Mitt', items: [], updatedAt: 0 })
  expect((await s.getWorkout('a'))!.updatedAt).toBeGreaterThan(0)
  expect(await s.getWorkout('finns-inte')).toBeNull()
  await s.deleteWorkout('a')
  expect(await s.listWorkouts()).toEqual([])
})
it('rör inte trasig data', async () => {
  const kv = fakeKV({ [KEY]: '{trasigt' })
  await expect(createStorage(kv).listWorkouts()).rejects.toThrow('gick inte att läsa')
  expect(kv.data.get(KEY)).toBe('{trasigt')
})
it('exporterar och importerar utan att skriva över', async () => {
  const s = createStorage(fakeKV())
  const file = await s.exportAll()
  expect(await s.importAll(file)).toBe(3)
  const all = await s.listWorkouts()
  expect(all).toHaveLength(6)
  expect(new Set(all.map(w => w.id)).size).toBe(6)
})
it('avvisar ogiltiga filer utan att lägga till något', async () => {
  const s = createStorage(fakeKV({ [KEY]: '[]' }))
  await expect(s.importAll('inte json')).rejects.toThrow('giltig passfil')
  await expect(s.importAll('{"workouts": 5}')).rejects.toThrow('giltig passfil')
  const bad = JSON.stringify({ app: 'spinningskarm', version: 1, workouts: [
    { id: 'a', name: 'Bra', items: [], updatedAt: 0 },
    { id: 'b', name: 'Dåligt', items: [{ kind: 'block', id: 'x', name: '', durationSec: 1, fromPct: 100, toPct: 100 }], updatedAt: 0 }] })
  await expect(s.importAll(bad)).rejects.toThrow('Dåligt')
  expect(await s.listWorkouts()).toEqual([])
})
it('har standardvärden för peppord och mikrofon', async () => {
  const s = createStorage(fakeKV())
  expect(await s.getPepWords()).toHaveLength(8)
  expect(await s.getMicSettings()).toEqual({ sensitivity: 5, bassLoHz: 40, bassHiHz: 150 })
})

it('exempelpassen är giltiga och har rätt längd', () => {
  expect(EXAMPLES.map(w => validateWorkout(w).ok)).toEqual([true, true, true])
  expect(EXAMPLES.map(w => totalDuration(flatten(w)))).toEqual([74 * 60, 70 * 60, 66 * 60])
})
it('ger nya id:n på alla nivåer vid import', async () => {
  const s = createStorage(fakeKV())
  await s.importAll(await s.exportAll())
  const ids = (await s.listWorkouts()).flatMap(w =>
    [w.id, ...w.items.flatMap(i => i.kind === 'group' ? [i.id, ...i.blocks.map(b => b.id)] : [i.id])])
  expect(new Set(ids).size).toBe(ids.length)
})
it('skriver aldrig över data som inte går att tolka', async () => {
  const file = JSON.stringify({ workouts: [{ id: 'a', name: 'Bra', items: [], updatedAt: 0 }] })
  for (const raw of ['{trasigt', '{}', 'null', '[1]']) {
    const kv = fakeKV({ [KEY]: raw })
    const s = createStorage(kv)
    await expect(s.saveWorkout({ id: 'a', name: 'Mitt', items: [], updatedAt: 0 })).rejects.toThrow('gick inte att läsa')
    await expect(s.deleteWorkout('a')).rejects.toThrow('gick inte att läsa')
    await expect(s.importAll(file)).rejects.toThrow('gick inte att läsa')
    await expect(s.exportAll()).rejects.toThrow('gick inte att läsa')
    expect(kv.data.get(KEY)).toBe(raw)
  }
})
it('sparar och läser peppord och mikrofon, och faller tillbaka på standard vid trasig data', async () => {
  const kv = fakeKV()
  const s = createStorage(kv)
  await s.savePepWords([])
  expect(await s.getPepWords()).toEqual([])
  await s.saveMicSettings({ sensitivity: 8, bassLoHz: 50, bassHiHz: 120 })
  expect(await s.getMicSettings()).toEqual({ sensitivity: 8, bassLoHz: 50, bassHiHz: 120 })
  kv.data.set('spinning.pepwords.v1', '{')
  kv.data.set('spinning.mic.v1', '{"sensitivity": "hög"}')
  expect(await s.getPepWords()).toHaveLength(8)
  expect(await s.getMicSettings()).toEqual({ sensitivity: 5, bassLoHz: 40, bassHiHz: 150 })
})
