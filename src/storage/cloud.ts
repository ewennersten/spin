import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClockState } from '../clock/clock'
import type { Workout } from '../model/types'
import { validateWorkout } from '../model/validate'
import { parseImport, type Access, type Store } from './storage'

// Passen i Supabase: kontots egna och de som andra har delat. Behörighetsreglerna i databasen ser till att bara
// ägaren kan ändra, dela och ta bort ett pass.
export interface WorkoutRow extends Access { workout: Workout }
export interface WorkoutRows {
  list(): Promise<WorkoutRow[]>
  upsert(workouts: Workout[]): Promise<void>
  remove(id: string): Promise<void>
  setShared(id: string, shared: boolean): Promise<void>
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
      const { data, error } = await table().select('data, user_id, shared').order('created_at').order('id')
      fail(error)
      return (data ?? []).map(r => ({ workout: r.data as Workout, mine: r.user_id === userId, shared: r.shared === true }))
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
    async setShared(id, shared) {
      const { error } = await table().update({ shared }).eq('id', id)
      fail(error)
    },
  }
}

// Passen ligger i molnet. Inställningarna (peppord, mikrofon, animationer) och det pågående passet hör till datorn
// i salen och ligger kvar i webbläsarens lagring.
export function createCloudStorage(rows: WorkoutRows, local: Store): Store {
  let access = new Map<string, Access>()
  async function list() {
    const rs = await rows.list()
    access = new Map(rs.map(r => [r.workout.id, { mine: r.mine, shared: r.shared }]))
    return rs.map(r => r.workout)
  }
  return {
    ...local,
    listWorkouts: list,
    async getWorkout(id) { return (await list()).find(w => w.id === id) ?? null },
    accessOf: id => access.get(id),
    setShared: (id, shared) => rows.setShared(id, shared),
    async saveWorkout(w) {
      // Samma kontroll som i webbläsarens lagring, så att allt som sparas också går att importera från exporten.
      const r = validateWorkout(w)
      if (!r.ok) throw new Error(r.error)
      await rows.upsert([{ ...r.workout, updatedAt: Date.now() }])
    },
    deleteWorkout: id => rows.remove(id),
    async exportAll() { return JSON.stringify({ app: 'spinningskarm', version: 1, workouts: await list() }) },
    async importAll(json) {
      // Allt kontrolleras innan något skrivs, och allt skrivs i en enda förfrågan: allt eller inget.
      const added = parseImport(json)
      await rows.upsert(added)
      return added.length
    },
  }
}

// Första gången ett konto loggar in på en dator laddas datorns pass upp, om kontot inte redan har egna pass i molnet.
// Det görs en gång per konto och dator, så att pass man har tagit bort i molnet inte kommer tillbaka.
export async function uploadLocalOnce(rows: WorkoutRows, local: Store, userId: string): Promise<void> {
  const key = `spinning.uploaded.${userId}`
  if (local.kv.getItem(key)) return
  const cloud = await rows.list()
  // Exempelpassen har samma id hos alla, så ett exempel som redan finns delat laddas inte upp igen.
  const fresh = (await local.listWorkouts()).filter(w => !cloud.some(r => r.workout.id === w.id))
  if (!cloud.some(r => r.mine)) await rows.upsert(fresh)
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
