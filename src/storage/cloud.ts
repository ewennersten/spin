import type { SupabaseClient } from '@supabase/supabase-js'
import type { Workout } from '../model/types'
import { validateWorkout } from '../model/validate'
import { parseImport, type Store } from './storage'

// Passen i Supabase. Raderna är användarens egna; behörighetsreglerna i databasen ser till det.
export interface WorkoutRows {
  list(): Promise<Workout[]>
  upsert(workouts: Workout[]): Promise<void>
  remove(id: string): Promise<void>
}

// Supabase-klientens fel är på engelska. Ett nätfel kommer som ett fel från fetch, med olika text i olika webbläsare.
export function fail(e: { message: string } | null): void {
  if (!e) return
  if (/fetch|network|load failed/i.test(e.message)) throw new Error('Ingen kontakt med servern. Kontrollera nätet och försök igen.')
  throw new Error(`Servern svarade med ett fel: ${e.message}`)
}

export function supabaseRows(client: SupabaseClient, userId: string): WorkoutRows {
  const table = () => client.from('workouts')
  return {
    async list() {
      const { data, error } = await table().select('data').order('created_at').order('id')
      fail(error)
      return (data ?? []).map(r => r.data as Workout)
    },
    async upsert(workouts) {
      if (!workouts.length) return
      const rows = workouts.map(w => ({ user_id: userId, id: w.id, data: w, updated_at: new Date(w.updatedAt || Date.now()).toISOString() }))
      const { error } = await table().upsert(rows, { onConflict: 'user_id,id' })
      fail(error)
    },
    async remove(id) {
      const { error } = await table().delete().eq('id', id)
      fail(error)
    },
  }
}

// Passen ligger i molnet. Inställningarna (peppord, mikrofon, animationer) och det pågående passet hör till datorn
// i salen och ligger kvar i webbläsarens lagring.
export function createCloudStorage(rows: WorkoutRows, local: Store): Store {
  return {
    ...local,
    listWorkouts: () => rows.list(),
    async getWorkout(id) { return (await rows.list()).find(w => w.id === id) ?? null },
    async saveWorkout(w) {
      // Samma kontroll som i webbläsarens lagring, så att allt som sparas också går att importera från exporten.
      const r = validateWorkout(w)
      if (!r.ok) throw new Error(r.error)
      await rows.upsert([{ ...r.workout, updatedAt: Date.now() }])
    },
    deleteWorkout: id => rows.remove(id),
    async exportAll() { return JSON.stringify({ app: 'spinningskarm', version: 1, workouts: await rows.list() }) },
    async importAll(json) {
      // Allt kontrolleras innan något skrivs, och allt skrivs i en enda förfrågan: allt eller inget.
      const added = parseImport(json)
      await rows.upsert(added)
      return added.length
    },
  }
}

// Första gången ett konto loggar in på en dator laddas datorns pass upp, om kontot inte redan har pass i molnet.
// Det görs en gång per konto och dator, så att pass man har tagit bort i molnet inte kommer tillbaka.
export async function uploadLocalOnce(rows: WorkoutRows, local: Store, userId: string): Promise<void> {
  const key = `spinning.uploaded.${userId}`
  if (local.kv.getItem(key)) return
  if (!(await rows.list()).length) await rows.upsert(await local.listWorkouts())
  local.kv.setItem(key, '1')
}
