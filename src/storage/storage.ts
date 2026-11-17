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
}

const WORKOUTS = 'spinning.workouts.v1'
const PEPWORDS = 'spinning.pepwords.v1'
const MIC = 'spinning.mic.v1'
const ANIM = 'spinning.anim.v1'
const PEP_DEFAULT = ['Kom igen!', 'Håll i!', 'Starkt!', 'Tryck på!', 'Ni äger det här!', 'Snart där!', 'Ge allt!', 'Bra jobbat!']
const MIC_DEFAULT: MicSettings = { sensitivity: 5, bassLoHz: 40, bassHiHz: 150 }

const newId = () => crypto.randomUUID()
const withNewIds = (w: Workout): Workout => ({
  ...w,
  id: newId(),
  items: w.items.map(i => i.kind === 'block'
    ? { ...i, id: newId() }
    : { ...i, id: newId(), blocks: i.blocks.map(b => ({ ...b, id: newId() })) }),
})

export function createStorage(kv: KV = window.localStorage): Store {
  // Varje anrop läser om nyckeln, så att inget gammalt minne (eller en annan flik) skriver över nyare data.
  // Alla skrivningar går via readWorkouts först: går datan inte att tolka kastas felet innan något skrivs.
  function readWorkouts(): Workout[] {
    let raw = kv.getItem(WORKOUTS)
    if (raw === null) {
      raw = JSON.stringify(EXAMPLES)
      kv.setItem(WORKOUTS, raw)
    }
    let list: unknown
    try { list = JSON.parse(raw) } catch { /* list förblir undefined och avvisas nedan */ }
    if (!Array.isArray(list) || !list.every(w => typeof w?.id === 'string' && Array.isArray(w?.items)))
      throw new Error('Sparade pass gick inte att läsa')
    return list
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
      let file: unknown
      try { file = JSON.parse(json) } catch { /* file förblir undefined och avvisas nedan */ }
      // Bara ett JSON-objekt kan ha fältet workouts; tal, text, null och listor ger undefined här.
      const workouts = (file as { workouts?: unknown } | null | undefined)?.workouts
      if (!Array.isArray(workouts)) throw new Error('Filen är inte en giltig passfil')
      const added = workouts.map((x, i) => {
        const r = validateWorkout(x)
        if (r.ok) return withNewIds(r.workout)
        const label = typeof x?.name === 'string' && x.name.trim() ? x.name : `Pass ${i + 1}`
        throw new Error(`${label}: ${r.error}`)
      })
      // Allt kontrolleras innan något skrivs, och allt skrivs i ett enda setItem: allt eller inget.
      writeWorkouts([...readWorkouts(), ...added])
      return added.length
    },
    async getPepWords() {
      return readSetting(PEPWORDS, [...PEP_DEFAULT], v => Array.isArray(v) && v.every(x => typeof x === 'string'))
    },
    async savePepWords(words) { kv.setItem(PEPWORDS, JSON.stringify(words)) },
    async getMicSettings() {
      return readSetting(MIC, { ...MIC_DEFAULT }, v => ['sensitivity', 'bassLoHz', 'bassHiHz'].every(k => Number.isFinite(v?.[k])))
    },
    async saveMicSettings(s) { kv.setItem(MIC, JSON.stringify(s)) },
    async getAnimationsOn() { return readSetting(ANIM, true, v => typeof v === 'boolean') },
    async saveAnimationsOn(on) { kv.setItem(ANIM, JSON.stringify(on)) },
  }
}
