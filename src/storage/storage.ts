import type { ClockState } from '../clock/clock'
import { EXAMPLES } from '../model/examples'
import type { MicSettings, Workout } from '../model/types'
import { validateWorkout } from '../model/validate'

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export interface Store {
  kv: KV
  listWorkouts(): Promise<Workout[]>
  getWorkout(id: string): Promise<Workout | null>
  saveWorkout(w: Workout): Promise<void>          // sätter updatedAt till Date.now()
  deleteWorkout(id: string): Promise<void>
  exportAll(): Promise<string>
  importAll(json: string): Promise<number>        // antal tillagda pass
  getPepWords(): Promise<string[]>
  savePepWords(words: string[]): Promise<void>
  getMicSettings(): Promise<MicSettings>
  saveMicSettings(s: MicSettings): Promise<void>
  getAnimationsOn(): Promise<boolean>              // standard true
  saveAnimationsOn(on: boolean): Promise<void>
  getLightLimitOn(): Promise<boolean>              // standard false
  saveLightLimitOn(on: boolean): Promise<void>
  // Delar passet som pågår med följvyn på mobilen; null när inget pass pågår. Finns bara med Supabase.
  shareRun?(workoutId: string | null, clock: ClockState | null): Promise<void>
  // Vem som äger ett pass och om det är delat, för passen från senaste listWorkouts eller getWorkout. Finns bara med Supabase.
  accessOf?(id: string): Access | undefined
  setShared?(id: string, shared: boolean): Promise<void>
}
export interface Access { mine: boolean; shared: boolean }

const WORKOUTS = 'spinning.workouts.v1'
const PEPWORDS = 'spinning.pepwords.v1'
const MIC = 'spinning.mic.v1'
const ANIM = 'spinning.anim.v1'
const LIGHT_LIMIT = 'spinning.lightlimit.v1'
// Exempelpassen som redan har lagts in. Saknas nyckeln fanns bara de tre första när biblioteket skapades.
const OFFERED = 'spinning.examples.v1'
const FIRST_EXAMPLES = ['exempel-sweetspot', 'exempel-troskel', 'exempel-vo2max']
const PEP_DEFAULT = ['Kom igen!', 'Håll i!', 'Starkt!', 'Tryck på!', 'Ni äger det här!', 'Snart där!', 'Ge allt!', 'Bra jobbat!']
const MIC_DEFAULT: MicSettings = { sensitivity: 5, bassLoHz: 40, bassHiHz: 150, leadMs: 120 }

const newId = () => crypto.randomUUID()
export const withNewIds = (w: Workout): Workout => ({
  ...w,
  id: newId(),
  items: w.items.map(i => i.kind === 'block'
    ? { ...i, id: newId() }
    : { ...i, id: newId(), blocks: i.blocks.map(b => ({ ...b, id: newId() })) }),
})

// Passen i en exporterad fil, kontrollerade och med nya id, så att de inte krockar med befintliga pass.
export function parseImport(json: string): Workout[] {
  let file: unknown
  try { file = JSON.parse(json) } catch { /* file förblir undefined och avvisas nedan */ }
  // Bara ett JSON-objekt kan ha fältet workouts; tal, text, null och listor ger undefined här.
  const workouts = (file as { workouts?: unknown } | null | undefined)?.workouts
  if (!Array.isArray(workouts)) throw new Error('Filen är inte en giltig passfil')
  return workouts.map((x, i) => {
    const r = validateWorkout(x)
    if (r.ok) return withNewIds(r.workout)
    const label = typeof x?.name === 'string' && x.name.trim() ? x.name : `Pass ${i + 1}`
    throw new Error(`${label}: ${r.error}`)
  })
}

export function createStorage(kv: KV = window.localStorage): Store {
  // Varje anrop läser om nyckeln, så att inget gammalt minne (eller en annan flik) skriver över nyare data.
  // Alla skrivningar går via readWorkouts först: går datan inte att tolka kastas felet innan något skrivs.
  function readWorkouts(): Workout[] {
    let raw = kv.getItem(WORKOUTS)
    if (raw === null) {
      raw = JSON.stringify(EXAMPLES)
      kv.setItem(WORKOUTS, raw)
      kv.setItem(OFFERED, JSON.stringify(EXAMPLES.map(w => w.id)))
    }
    let list: unknown
    try { list = JSON.parse(raw) } catch { /* list förblir undefined och avvisas nedan */ }
    if (!Array.isArray(list) || !list.every(w => typeof w?.id === 'string' && Array.isArray(w?.items)))
      throw new Error('Sparade pass gick inte att läsa')
    // Nya exempelpass läggs till i ett befintligt bibliotek, en gång var: ett exempel man har tagit bort kommer inte tillbaka.
    const offered = readSetting<string[]>(OFFERED, FIRST_EXAMPLES, v => Array.isArray(v) && v.every(x => typeof x === 'string'))
    const workouts = list as Workout[]
    const added = EXAMPLES.filter(e => !offered.includes(e.id) && !workouts.some(w => w.id === e.id))
    if (!added.length) return workouts
    kv.setItem(WORKOUTS, JSON.stringify([...workouts, ...added]))
    kv.setItem(OFFERED, JSON.stringify([...offered, ...added.map(e => e.id)]))
    return [...workouts, ...added]
  }
  const writeWorkouts = (list: Workout[]) => kv.setItem(WORKOUTS, JSON.stringify(list))

  // Inställningar är inte användarens pass: trasig data ger standardvärdet och skrivs inte över förrän användaren sparar.
  function readSetting<T>(key: string, fallback: T, ok: (v: any) => boolean): T {
    const raw = kv.getItem(key)
    if (raw === null) return fallback
    try {
      const v = JSON.parse(raw)
      return ok(v) ? v : fallback
    } catch {
      return fallback
    }
  }

  return {
    kv,
    async listWorkouts() { return readWorkouts() },
    async getWorkout(id) { return readWorkouts().find(w => w.id === id) ?? null },
    async saveWorkout(w) {
      // Samma kontroll som importAll, så att allt som sparas också går att importera från exporten.
      const r = validateWorkout(w)
      if (!r.ok) throw new Error(r.error)
      const list = readWorkouts()
      const saved = { ...r.workout, updatedAt: Date.now() }
      const i = list.findIndex(x => x.id === w.id)
      if (i >= 0) list[i] = saved
      else list.push(saved)
      writeWorkouts(list)
    },
    async deleteWorkout(id) { writeWorkouts(readWorkouts().filter(w => w.id !== id)) },
    async exportAll() { return JSON.stringify({ app: 'spinningskarm', version: 1, workouts: readWorkouts() }) },
    async importAll(json) {
      const added = parseImport(json)
      // Allt kontrolleras innan något skrivs, och allt skrivs i ett enda setItem: allt eller inget.
      writeWorkouts([...readWorkouts(), ...added])
      return added.length
    },
    async getPepWords() {
      return readSetting(PEPWORDS, [...PEP_DEFAULT], v => Array.isArray(v) && v.every(x => typeof x === 'string'))
    },
    async savePepWords(words) { kv.setItem(PEPWORDS, JSON.stringify(words)) },
    async getMicSettings() {
      const s = readSetting(MIC, { ...MIC_DEFAULT }, v => ['sensitivity', 'bassLoHz', 'bassHiHz'].every(k => Number.isFinite(v?.[k])))
      // Inställningar sparade före synkreglaget saknar leadMs och får standardvärdet, utan att resten går förlorat.
      return Number.isFinite(s.leadMs) ? s : { ...s, leadMs: MIC_DEFAULT.leadMs }
    },
    async saveMicSettings(s) { kv.setItem(MIC, JSON.stringify(s)) },
    async getAnimationsOn() { return readSetting(ANIM, true, v => typeof v === 'boolean') },
    async saveAnimationsOn(on) { kv.setItem(ANIM, JSON.stringify(on)) },
    async getLightLimitOn() { return readSetting(LIGHT_LIMIT, false, v => typeof v === 'boolean') },
    async saveLightLimitOn(on) { kv.setItem(LIGHT_LIMIT, JSON.stringify(on)) },
  }
}
