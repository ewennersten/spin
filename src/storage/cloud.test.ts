import { expect, it } from 'vitest'
import { EXAMPLES } from '../model/examples'
import type { Workout } from '../model/types'
import { createCloudStorage, fail, toLiveRun, uploadLocalOnce, type WorkoutRows } from './cloud'
import { createStorage, type KV } from './storage'

const fakeKV = (): KV => {
  const data = new Map<string, string>()
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) }
}
// Som tabellen i Supabase: upsert ersätter ett pass med samma id och behåller dess plats i listan.
const fakeRows = (): WorkoutRows & { calls: number } => {
  const rows = new Map<string, Workout>()
  return {
    calls: 0,
    async list() { return [...rows.values()] },
    async upsert(ws) { this.calls++; for (const w of ws) rows.set(w.id, structuredClone(w)) },
    async remove(id) { rows.delete(id) },
  }
}

it('molnet: sparar, ersätter, hämtar och tar bort pass', async () => {
  const rows = fakeRows()
  const s = createCloudStorage(rows, createStorage(fakeKV()))
  const w = EXAMPLES[0]
  await s.saveWorkout(w)
  await s.saveWorkout({ ...w, name: 'Nytt namn' })
  expect((await s.listWorkouts()).map(x => x.name)).toEqual(['Nytt namn'])
  expect((await s.getWorkout(w.id))?.updatedAt).toBeGreaterThan(0)
  await s.deleteWorkout(w.id)
  expect(await s.getWorkout(w.id)).toBeNull()
})

it('molnet: ogiltiga pass sparas inte, och en import skrivs i en enda förfrågan', async () => {
  const rows = fakeRows()
  const s = createCloudStorage(rows, createStorage(fakeKV()))
  await expect(s.saveWorkout({ ...EXAMPLES[0], name: 'x'.repeat(1000) })).rejects.toThrow()
  expect(rows.calls).toBe(0)
  const n = await s.importAll(JSON.stringify({ workouts: EXAMPLES }))
  expect(n).toBe(EXAMPLES.length)
  expect(rows.calls).toBe(1)
  // Importen får nya id, så att den inte skriver över befintliga pass.
  expect((await s.listWorkouts()).some(w => w.id === EXAMPLES[0].id)).toBe(false)
  expect(JSON.parse(await s.exportAll()).workouts).toHaveLength(EXAMPLES.length)
})

it('molnet: datorns pass laddas upp en gång, och bara till ett tomt konto', async () => {
  const local = createStorage(fakeKV())
  const rows = fakeRows()
  await uploadLocalOnce(rows, local, 'anna')
  expect(await rows.list()).toHaveLength(EXAMPLES.length)
  // Pass som tas bort i molnet kommer inte tillbaka vid nästa start.
  for (const w of await rows.list()) await rows.remove(w.id)
  await uploadLocalOnce(rows, local, 'anna')
  expect(await rows.list()).toHaveLength(0)
  // Ett annat konto med egna pass får inte datorns pass.
  const other = fakeRows()
  await other.upsert([EXAMPLES[1]])
  await uploadLocalOnce(other, local, 'bertil')
  expect(await other.list()).toHaveLength(1)
})

it('molnet: nätfel och serverfel ger svensk text', () => {
  expect(() => fail(null)).not.toThrow()
  expect(() => fail({ message: 'TypeError: Failed to fetch' })).toThrow('Ingen kontakt med servern')
  expect(() => fail({ message: 'permission denied' })).toThrow('Servern svarade med ett fel')
})

it('följvyn: läget från servern kontrolleras, och inget pass ger null', () => {
  const clock = { running: true, anchorMs: 1000, posAtAnchorMs: 5000 }
  expect(toLiveRun({ workout_id: 'p1', clock })).toEqual({ workoutId: 'p1', clock })
  expect(toLiveRun({ workout_id: null, clock: null })).toBeNull()
  expect(toLiveRun({ workout_id: 'p1', clock: { running: 'ja', anchorMs: 1, posAtAnchorMs: 2 } })).toBeNull()
  expect(toLiveRun(null)).toBeNull()
})
