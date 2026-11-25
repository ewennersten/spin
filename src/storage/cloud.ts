import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClockState } from '../clock/clock'
import type { Workout } from '../model/types'
import { validateWorkout } from '../model/validate'
import { parseImport, type Store } from './storage'

// Passen i Supabase. De är gemensamma för alla godkända konton; behörighetsreglerna i databasen ser till det.
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

export function supabaseRows(client: SupabaseClient): WorkoutRows {
  const table = () => client.from('workouts')
  return {
    async list() {
      const { data, error } = await table().select('data').order('created_at').order('id')
      fail(error)
      return (data ?? []).map(r => r.data as Workout)
    },
    async upsert(workouts) {
      if (!workouts.length) return
      // user_id skickas inte: ett nytt pass får den inloggades id i databasen, och den som skapade ett pass behålls när någon annan ändrar det.
      const rows = workouts.map(w => ({ id: w.id, data: w, updated_at: new Date(w.updatedAt || Date.now()).toISOString() }))
      const { error } = await table().upsert(rows, { onConflict: 'id' })
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

// Första gången ett konto loggar in på en dator laddas datorns pass upp, om molnet inte redan har pass.
// Det görs en gång per konto och dator, så att pass man har tagit bort i molnet inte kommer tillbaka.
export async function uploadLocalOnce(rows: WorkoutRows, local: Store, userId: string): Promise<void> {
  const key = `spinning.uploaded.${userId}`
  if (local.kv.getItem(key)) return
  if (!(await rows.list()).length) await rows.upsert(await local.listWorkouts())
  local.kv.setItem(key, '1')
}

// Passet som pågår på datorn i salen, för följvyn på mobilen.
export interface LiveRun { workoutId: string; clock: ClockState }

// Raden kommer från servern, så den kontrolleras innan mobilen räknar med den. Inget pass ger null.
export function toLiveRun(row: unknown): LiveRun | null {
  const r = row as { workout_id?: unknown; clock?: Partial<ClockState> } | null
  const c = r?.clock
  if (typeof r?.workout_id !== 'string' || typeof c?.running !== 'boolean' || !Number.isFinite(c.anchorMs) || !Number.isFinite(c.posAtAnchorMs)) return null
  return { workoutId: r.workout_id, clock: { running: c.running, anchorMs: c.anchorMs!, posAtAnchorMs: c.posAtAnchorMs! } }
}

export interface Live {
  share(workoutId: string | null, clock: ClockState | null): Promise<void>
  get(): Promise<LiveRun | null>
  // onChange får varje ändring; onConnect anropas när förbindelsen är uppe, så att följvyn kan hämta läget som
  // kan ha ändrats medan den var nere. Returnerar en funktion som stänger förbindelsen.
  subscribe(onChange: (run: LiveRun | null) => void, onConnect: () => void): () => void
}

export function supabaseLive(client: SupabaseClient, userId: string): Live {
  const table = () => client.from('live_runs')
  return {
    async share(workoutId, clock) {
      const { error } = await table().upsert({ user_id: userId, workout_id: workoutId, clock, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      fail(error)
    },
    async get() {
      const { data, error } = await table().select('workout_id, clock').eq('user_id', userId).maybeSingle()
      fail(error)
      return toLiveRun(data)
    },
    subscribe(onChange, onConnect) {
      const channel = client.channel(`live_runs:${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_runs', filter: `user_id=eq.${userId}` }, p => onChange(toLiveRun(p.new)))
        .subscribe(s => { if (s === 'SUBSCRIBED') onConnect() })
      return () => { void client.removeChannel(channel) }
    },
  }
}
