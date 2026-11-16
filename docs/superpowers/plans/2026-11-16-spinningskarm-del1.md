# Spinningskärm del 1: pass, klocka, skärm och mikrofonpanel. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En webbapp där instruktören bygger och sparar spinningpass och kör dem på storskärm med staplar, markörlinje, klockor, textsignaler och en mikrofonpanel som visar om takten fångas.

**Architecture:** Statisk ensidesapp med tre vyer bakom hash-adresser. All logik som går att räkna ut (utplattning av pass, klocka, uppslagning, signaler, taktdetektering) är rena funktioner med tester. Vyerna är tunna och läser bara från dem. Lagring går genom en enda modul.

**Tech Stack:** Vite, TypeScript, Vitest. Inget gränssnittsramverk. three.js läggs till först i del 2.

**Spec:** `docs/superpowers/specs/2026-11-16-spinningskarm-design.md`

**Omfattning:** Den här planen täcker steg 1 och 2 i designens byggordning. Steg 3 (3D-animationer, tangenten A, de mörka plattorna bakom text, säkerhetsreglerna för ljus och den automatiska nedskalningen) får en egen plan efter att mikrofonpanelen har provats i salen.

## Global Constraints

- All text i gränssnittet är på svenska.
- Endast mörkt läge. Bakgrund `#0b0b0b`, text `#f1efe8`, dämpad text `#b4b2a9`.
- Måste fungera i Chrome och Edge. Safari och Firefox är inte krav.
- Inga resurser hämtas från nätet vid körning: inga CDN-skript, inga webbtypsnitt.
- Fast port 5173 med `strictPort: true` för både `dev` och `preview`.
- Beroenden: endast `vite`, `typescript` och `vitest`, alla som devDependencies.
- Gränser: procent 20 till 200, längd per block 5 sekunder till 3 timmar (10 800 s), upprepningar 1 till 50. Grupper kan inte innehålla grupper.
- Siffror i klockor och procent har fast bredd (`font-variant-numeric: tabular-nums`).
- Ingen kod utanför `src/storage/` rör `localStorage`.
- Testfiler ligger bredvid koden som `*.test.ts`. Kör alla med `npm test`.
- Varje uppgift avslutas med en commit. Commit-meddelanden slutar med raden `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. **Trasig data i lagringen.** Om nyckeln med pass innehåller något som inte går att tolka ska biblioteket visa ett felmeddelande och lämna datan orörd. Exempelpassen får inte skrivas över den. (Test i uppgift 4.)
2. **Tomt pass.** Ett pass utan block ska inte kunna startas, och uppslagning och staplar ska klara en tom lista utan division med noll. (Test i uppgift 5 och 6.)
3. **Laptopen har sovit eller fliken varit dold.** När klockan läses efter ett långt uppehåll ska positionen stämma mot väggklockan, och en position bortom passets slut ska ge läget "klart" utan att gamla banderoller eller peppord spelas upp i efterhand. (Test i uppgift 5 och 9.)
4. **Okänt pass i adressen.** `#/edit/<id>` och `#/run/<id>` med ett id som inte finns ska visa "Passet finns inte" med en länk till biblioteket. (Test i uppgift 1, kontroll i uppgift 8 och 9.)
5. **Mikrofonen försvinner mitt i passet.** Nekad åtkomst, urkopplad enhet eller avslutat ljudspår ska ge intern takt utan fel, och klockan ska inte påverkas. (Test i uppgift 10.)

---

## Filstruktur

```
index.html
package.json, tsconfig.json, vite.config.ts, .gitignore, README.md
src/
  main.ts              startar appen, kopplar adress till vy
  router.ts            parseRoute
  styles.css           färger, typografi, layout för alla vyer
  model/
    types.ts           Block, Group, Item, Workout, Segment, MicSettings
    zones.ts           zongränser, namn och färger
    format.ts          mmss, pctText
    flatten.ts         flatten, totalDuration (inklusive namnregler)
    validate.ts        LIMITS, validateWorkout
    edit.ts            moveItem, duplicateAt, removeAt, newBlock, newGroup
    examples.ts        tre exempelpass
  clock/
    clock.ts           ClockState, position, start, pause, seek
    lookup.ts          locate, nextStartMs, prevStartMs
    runState.ts        saveRun, loadRun, clearRun
  storage/
    storage.ts         createStorage (enda stället som rör localStorage)
  audio/
    bands.ts           bandEnergy
    beat.ts            BeatDetector
    beatSource.ts      BeatSource (mikrofon eller intern takt)
    mic.ts             openMic (webbläsarens ljud-API)
  ui/
    chart.ts           chartShapes, renderChart
    cues.ts            countdownNumber, bannerVisible, pepIntervalSec, pepAllowed
    library.ts         biblioteksvyn
    editor.ts          redigeraren
    run.ts             skärmen
    micPanel.ts        mikrofonpanelen
```

---

### Task 1: Projektgrund och adresser

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.ts`, `src/router.ts`, `src/styles.css`
- Test: `src/router.test.ts`

**Interfaces:**
- Produces:
  - `type Route = { view: 'library' } | { view: 'edit'; id: string } | { view: 'run'; id: string }`
  - `parseRoute(hash: string): Route`
  - `type View = (root: HTMLElement, id?: string) => (() => void) | void`. Returvärdet är en städfunktion som `main.ts` anropar innan nästa vy monteras.
  - CSS-variabler i `:root`: `--bg`, `--text`, `--muted`.

- [ ] **Step 1: Skapa projektet**

Kör `git init`. Skriv `package.json` med skripten `dev` (`vite`), `build` (`tsc --noEmit && vite build`), `preview` (`vite preview`) och `test` (`vitest run`). Kör `npm install -D vite typescript vitest`. `vite.config.ts` importerar `defineConfig` från `vitest/config` och sätter `server` och `preview` till `{ port: 5173, strictPort: true }` samt `test: { environment: 'node' }`. `tsconfig.json` har `strict: true`. `.gitignore` innehåller `node_modules` och `dist`.

- [ ] **Step 2: Skriv det fallerande testet**

```ts
import { expect, it } from 'vitest'
import { parseRoute } from './router'

it('tolkar adresser', () => {
  expect(parseRoute('')).toEqual({ view: 'library' })
  expect(parseRoute('#/')).toEqual({ view: 'library' })
  expect(parseRoute('#/edit/abc')).toEqual({ view: 'edit', id: 'abc' })
  expect(parseRoute('#/run/abc')).toEqual({ view: 'run', id: 'abc' })
  expect(parseRoute('#/run/')).toEqual({ view: 'library' })
  expect(parseRoute('#/okänt/x')).toEqual({ view: 'library' })
})
```

- [ ] **Step 3: Kör testet och se att det fallerar**

Run: `npm test`
Expected: FAIL, `parseRoute` finns inte.

- [ ] **Step 4: Implementera `parseRoute` i `src/router.ts`, och `src/main.ts` som monterar en vy per adress**

`main.ts` lyssnar på `hashchange`, anropar föregående vys städfunktion och monterar nästa i `#app`. Vyerna är tills vidare platshållare som skriver sitt namn. `styles.css` sätter färgerna ovan på `body`, systemtypsnitt och `color-scheme: dark`. `index.html` har `lang="sv"`.

- [ ] **Step 5: Kör testet och kontrollera i webbläsaren**

Run: `npm test` ger PASS. `npm run dev` och öppna `http://localhost:5173/`: svart sida med texten för biblioteket, och `#/edit/x` respektive `#/run/x` byter text.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: projektgrund med adresser"
```

---

### Task 2: Passmodell, zoner och utplattning

**Files:**
- Create: `src/model/types.ts`, `src/model/zones.ts`, `src/model/format.ts`, `src/model/flatten.ts`
- Test: `src/model/zones.test.ts`, `src/model/format.test.ts`, `src/model/flatten.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export interface Block { kind: 'block'; id: string; name: string; durationSec: number; fromPct: number; toPct: number }
export interface Group { kind: 'group'; id: string; repeat: number; blocks: Block[] }
export type Item = Block | Group
export interface Workout { id: string; name: string; items: Item[]; updatedAt: number }
export interface Segment { name: string; startSec: number; durationSec: number; fromPct: number; toPct: number }
export interface MicSettings { sensitivity: number; bassLoHz: number; bassHiHz: number }

// zones.ts
export interface Zone { id: 'vila' | 'lugnt' | 'tempo' | 'sweetspot' | 'troskel' | 'vo2max'; name: string; from: number; color: string; textColor: string }
export const ZONES: Zone[]
export function zoneFor(pct: number): Zone

// format.ts
export function mmss(totalSec: number): string          // heltal sekunder in, "MM:SS" ut, minuter kan överstiga 59
export function pctText(fromPct: number, toPct: number): string

// flatten.ts
export function flatten(workout: Workout): Segment[]
export function totalDuration(segments: Segment[]): number
```

Zonerna, i ordning, med undre gräns, stapelfärg och ljus textfärg:

| id | name | from | color | textColor |
|----|------|------|-------|-----------|
| vila | Vila | 0 | `#5F5E5A` | `#D3D1C7` |
| lugnt | Lugnt | 60 | `#378ADD` | `#85B7EB` |
| tempo | Tempo | 76 | `#1D9E75` | `#5DCAA5` |
| sweetspot | Sweetspot | 88 | `#EF9F27` | `#FAC775` |
| troskel | Tröskel | 95 | `#D85A30` | `#F0997B` |
| vo2max | VO2max | 106 | `#E24B4A` | `#F09595` |

Namnregler i `flatten`, i den här ordningen:
1. Grundnamn: blockets eget namn om det inte är tomt. Annars "Uppvärmning" om segmentet är passets första och stigande, "Nedvarvning" om det är passets sista och fallande, annars zonens namn för medelvärdet av `fromPct` och `toPct`.
2. Om ett namnlöst segment har samma grundnamn som segmentet före eller efter, och de två har olika `pctText`, läggs `pctText` till efter grundnamnet.
3. Block i en grupp med `repeat` större än 1 får tillägget ` i av n`.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
// zones.test.ts
it('väljer zon efter undre gräns', () => {
  const id = (p: number) => zoneFor(p).id
  expect([id(0), id(59.9), id(60), id(75.5), id(76), id(88), id(95), id(105.9), id(106), id(200)])
    .toEqual(['vila', 'vila', 'lugnt', 'lugnt', 'tempo', 'sweetspot', 'troskel', 'troskel', 'vo2max', 'vo2max'])
})

// format.test.ts
it('formaterar tid och procent', () => {
  expect([mmss(0), mmss(312), mmss(4110)]).toEqual(['00:00', '05:12', '68:30'])
  expect(pctText(105, 105)).toBe('105 %')
  expect(pctText(50, 75)).toBe('50 → 75 %')
})

// flatten.test.ts
const b = (durationSec: number, fromPct: number, toPct = fromPct, name = ''): Block =>
  ({ kind: 'block', id: crypto.randomUUID(), name, durationSec, fromPct, toPct })
const g = (repeat: number, ...blocks: Block[]): Group => ({ kind: 'group', id: crypto.randomUUID(), repeat, blocks })
const w = (...items: Item[]): Workout => ({ id: 'w', name: 'Test', items, updatedAt: 0 })
const names = (wk: Workout) => flatten(wk).map(s => s.name)

it('plattar ut grupper med starttider och numrering', () => {
  const segs = flatten(w(g(4, b(480, 100), b(180, 55))))
  expect(segs).toHaveLength(8)
  expect(segs[2]).toMatchObject({ name: 'Tröskel 2 av 4', startSec: 660, durationSec: 480 })
  expect(segs[3].name).toBe('Vila 2 av 4')
  expect(totalDuration(segs)).toBe(2640)
})
it('namnger uppvärmning, nedvarvning och sneda block', () => {
  expect(names(w(b(600, 45, 70), b(300, 80, 100), b(600, 60, 40)))).toEqual(['Uppvärmning', 'Sweetspot', 'Nedvarvning'])
})
it('lägger till procent när grannar har samma zon', () => {
  expect(names(w(g(2, b(120, 105), b(60, 95))))).toEqual(
    ['Tröskel 105 % 1 av 2', 'Tröskel 95 % 1 av 2', 'Tröskel 105 % 2 av 2', 'Tröskel 95 % 2 av 2'])
})
it('behåller egna namn och hoppar över numrering vid en upprepning', () => {
  expect(names(w(g(2, b(60, 110, 110, 'Över'))))).toEqual(['Över 1 av 2', 'Över 2 av 2'])
  expect(names(w(g(1, b(60, 100))))).toEqual(['Tröskel'])
})
it('klarar ett tomt pass', () => {
  expect(flatten(w())).toEqual([])
  expect(totalDuration([])).toBe(0)
})
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, modulerna finns inte.

- [ ] **Step 3: Implementera `types.ts`, `zones.ts`, `format.ts` och `flatten.ts` enligt gränssnitten och namnreglerna ovan**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: passmodell, zoner och utplattning"
```

---

### Task 3: Gränser och kontroll av pass

**Files:**
- Create: `src/model/validate.ts`
- Test: `src/model/validate.test.ts`

**Interfaces:**
- Consumes: `Workout`, `Block`, `Group` från uppgift 2.
- Produces:

```ts
export const LIMITS = { pctMin: 20, pctMax: 200, durMinSec: 5, durMaxSec: 10800, repeatMin: 1, repeatMax: 50, nameMax: 80 }
export type Validation = { ok: true; workout: Workout } | { ok: false; error: string }
export function validateWorkout(input: unknown): Validation
```

`validateWorkout` tar emot vad som helst (även data från en importerad fil) och godkänner bara exakt formen i `types.ts`. Tal måste vara ändliga tal av typen `number`. Passets namn måste vara en icke-tom sträng på högst 80 tecken, blocknamn en sträng på högst 80 tecken. `updatedAt` som saknas sätts till 0. Felmeddelanden är på svenska och pekar ut var felet är, till exempel `Block 3: procent måste vara mellan 20 och 200`. Numret räknar posterna på passets översta nivå från 1. Inuti en grupp skrivs `Grupp 2, block 1: ...`.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
const block = (over: object = {}) => ({ kind: 'block', id: 'b', name: '', durationSec: 60, fromPct: 100, toPct: 100, ...over })
const workout = (items: unknown[]) => ({ id: 'w', name: 'Pass', items, updatedAt: 1 })
const err = (input: unknown) => { const r = validateWorkout(input); return r.ok ? '' : r.error }

it('godkänner ett giltigt pass', () => {
  expect(validateWorkout(workout([block(), { kind: 'group', id: 'g', repeat: 4, blocks: [block()] }])).ok).toBe(true)
  expect(validateWorkout(workout([])).ok).toBe(true)
})
it('avvisar värden utanför gränserna', () => {
  expect(err(workout([block({ fromPct: 19 })]))).toContain('20 och 200')
  expect(err(workout([block({ toPct: 201 })]))).toContain('20 och 200')
  expect(err(workout([block({ durationSec: 4 })]))).toContain('5 sekunder')
  expect(err(workout([block({ durationSec: 10801 })]))).toContain('3 timmar')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 0, blocks: [block()] }]))).toContain('1 och 50')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 51, blocks: [block()] }]))).toContain('1 och 50')
})
it('avvisar fel form', () => {
  expect(err(null)).not.toBe('')
  expect(err('text')).not.toBe('')
  expect(err({ ...workout([]), name: '' })).toContain('namn')
  expect(err(workout([block({ durationSec: '300' })]))).not.toBe('')
  expect(err(workout([block({ fromPct: NaN })]))).not.toBe('')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 2, blocks: [{ kind: 'group', id: 'h', repeat: 2, blocks: [] }] }]))).not.toBe('')
})
it('pekar ut vilket block som är fel', () => {
  expect(err(workout([block(), block(), block({ fromPct: 5 })]))).toContain('Block 3')
})
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, `validateWorkout` finns inte.

- [ ] **Step 3: Implementera `LIMITS` och `validateWorkout` i `src/model/validate.ts`**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: gränser och kontroll av pass"
```

---

### Task 4: Lagring, exempelpass, export och import

**Files:**
- Create: `src/storage/storage.ts`, `src/model/examples.ts`
- Test: `src/storage/storage.test.ts`

**Interfaces:**
- Consumes: `Workout`, `MicSettings` (uppgift 2), `validateWorkout` (uppgift 3).
- Produces:

```ts
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
}
export function createStorage(kv?: KV): Store      // standard: window.localStorage
export const EXAMPLES: Workout[]                   // i examples.ts
```

Nycklar: `spinning.workouts.v1`, `spinning.pepwords.v1`, `spinning.mic.v1`. (`spinning.run.v1` tillhör uppgift 5.)

Regler:
- Saknas nyckeln med pass skrivs `EXAMPLES` dit vid första läsningen.
- Går nyckeln inte att tolka kastar `listWorkouts` `Error('Sparade pass gick inte att läsa')` och rör inte datan.
- Exportformat: `{ "app": "spinningskarm", "version": 1, "workouts": [...] }`.
- Import: allt eller inget. Filen måste vara ett JSON-objekt med fältet `workouts` som en lista; övriga fält läses inte. Varje pass går genom `validateWorkout`. Godkända pass får nya id:n (pass, grupper och block) och läggs till sist. Fel kastas som `Error` med svenskt meddelande: `Filen är inte en giltig passfil` för fel form, annars meddelandet från `validateWorkout` med passets namn framför.
- Standardlista med peppord: `Kom igen!`, `Håll i!`, `Starkt!`, `Tryck på!`, `Ni äger det här!`, `Snart där!`, `Ge allt!`, `Bra jobbat!`.
- Standard för mikrofonen: `{ sensitivity: 5, bassLoHz: 40, bassHiHz: 150 }`.

Exempelpassen (alla med uppvärmning 600 s 45 → 70 %, tre höjningar som grupp 3 × (30 s 110 % + 90 s 55 %), och nedvarvning 600 s 60 → 40 %):
- "Sweetspot 3 × 12 min": huvuddel 3 × (720 s 90 % + 240 s 55 %).
- "Tröskel 4 × 8 min": huvuddel 4 × (480 s 100 % + 180 s 55 %).
- "VO2max 5 × 4 min": huvuddel 5 × (240 s 115 % + 240 s 50 %).

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
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
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, `createStorage` finns inte.

- [ ] **Step 3: Implementera `examples.ts` och `createStorage` i `src/storage/storage.ts` enligt reglerna ovan**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: lagring med exempelpass, export och import"
```

---

### Task 5: Klocka, uppslagning och sparat passläge

**Files:**
- Create: `src/clock/clock.ts`, `src/clock/lookup.ts`, `src/clock/runState.ts`
- Test: `src/clock/clock.test.ts`, `src/clock/lookup.test.ts`, `src/clock/runState.test.ts`

**Interfaces:**
- Consumes: `Segment`, `Workout` (uppgift 2), `KV` (uppgift 4).
- Produces:

```ts
// clock.ts  (alla tider i millisekunder, nowMs är väggklocka)
export interface ClockState { running: boolean; anchorMs: number; posAtAnchorMs: number }
export const IDLE: ClockState                                  // { running: false, anchorMs: 0, posAtAnchorMs: 0 }
export function position(s: ClockState, nowMs: number): number  // aldrig negativ
export function start(s: ClockState, nowMs: number): ClockState
export function pause(s: ClockState, nowMs: number): ClockState
export function seek(s: ClockState, posMs: number, nowMs: number): ClockState   // behåller running

// lookup.ts
export interface Located { done: boolean; index: number; segment: Segment | null; elapsedMs: number; remainingMs: number; pctNow: number }
export function locate(segments: Segment[], posMs: number): Located
export function nextStartMs(segments: Segment[], posMs: number): number   // nästa blocks start, eller passets slut
export function prevStartMs(segments: Segment[], posMs: number): number   // blockets start; inom 3000 ms från starten: föregående blocks start

// runState.ts
export function saveRun(kv: KV, workout: Workout, clock: ClockState, nowMs: number): void
export function loadRun(kv: KV, workout: Workout, nowMs: number): ClockState | null
export function clearRun(kv: KV): void
```

`locate`: en position exakt på en gräns hör till det senare blocket. Vid passets slut eller senare, och för en tom lista, är `done` sant, `segment` null och `index` lika med antalet segment. `pctNow` är rak interpolation mellan `fromPct` och `toPct`.

`loadRun` ger bara tillbaka klockan om det sparade läget gäller samma `workout.id`, har samma `workout.updatedAt` och är yngre än fyra timmar (14 400 000 ms). Nyckel: `spinning.run.v1`. Trasig data ger `null`.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
// clock.test.ts
it('räknar position ur väggklockan', () => {
  const paused: ClockState = { running: false, anchorMs: 1000, posAtAnchorMs: 5000 }
  expect(position(paused, 99999)).toBe(5000)
  const running = start(paused, 2000)
  expect(position(running, 3000)).toBe(6000)
  expect(position(running, 3_600_000 + 2000)).toBe(3_605_000)
  const again = pause(running, 3000)
  expect(again).toEqual({ running: false, anchorMs: 3000, posAtAnchorMs: 6000 })
  expect(position(seek(running, 0, 4000), 4500)).toBe(500)
  expect(seek(paused, 9000, 4000).running).toBe(false)
  expect(position({ running: true, anchorMs: 5000, posAtAnchorMs: 0 }, 1000)).toBe(0)
})

// lookup.test.ts
const segs: Segment[] = [
  { name: 'A', startSec: 0, durationSec: 60, fromPct: 50, toPct: 70 },
  { name: 'B', startSec: 60, durationSec: 30, fromPct: 100, toPct: 100 },
  { name: 'C', startSec: 90, durationSec: 60, fromPct: 55, toPct: 55 },
]
it('hittar aktuellt block', () => {
  expect(locate(segs, 0)).toMatchObject({ done: false, index: 0, remainingMs: 60000, pctNow: 50 })
  expect(locate(segs, 30000).pctNow).toBe(60)
  expect(locate(segs, 60000)).toMatchObject({ index: 1, elapsedMs: 0, remainingMs: 30000 })
})
it('ger klart efter slutet och för tomt pass', () => {
  expect(locate(segs, 150000)).toMatchObject({ done: true, index: 3, segment: null })
  expect(locate(segs, 9e9).done).toBe(true)
  expect(locate([], 0).done).toBe(true)
})
it('hoppar framåt och bakåt', () => {
  expect(nextStartMs(segs, 10000)).toBe(60000)
  expect(nextStartMs(segs, 100000)).toBe(150000)
  expect(prevStartMs(segs, 70000)).toBe(60000)
  expect(prevStartMs(segs, 62000)).toBe(0)
  expect(prevStartMs(segs, 1000)).toBe(0)
})

// runState.test.ts  (fakeKV som i uppgift 4)
const wk: Workout = { id: 'w', name: 'P', items: [], updatedAt: 7 }
const clock: ClockState = { running: true, anchorMs: 1000, posAtAnchorMs: 0 }
const H4 = 4 * 3600 * 1000
it('återupptar bara samma oförändrade pass inom fyra timmar', () => {
  const kv = fakeKV()
  saveRun(kv, wk, clock, 1000)
  expect(loadRun(kv, wk, 1000 + H4 - 1)).toEqual(clock)
  expect(loadRun(kv, wk, 1000 + H4)).toBeNull()
  expect(loadRun(kv, { ...wk, updatedAt: 8 }, 2000)).toBeNull()
  expect(loadRun(kv, { ...wk, id: 'annat' }, 2000)).toBeNull()
  clearRun(kv)
  expect(loadRun(kv, wk, 2000)).toBeNull()
})
it('tål trasig data', () => {
  expect(loadRun(fakeKV({ 'spinning.run.v1': '{' }), wk, 0)).toBeNull()
})
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, modulerna finns inte.

- [ ] **Step 3: Implementera `clock.ts`, `lookup.ts` och `runState.ts` enligt gränssnitten**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: klocka, uppslagning och sparat passläge"
```

---

### Task 6: Staplarna

**Files:**
- Create: `src/ui/chart.ts`
- Test: `src/ui/chart.test.ts`

**Interfaces:**
- Consumes: `Segment`, `zoneFor`, `totalDuration` (uppgift 2).
- Produces:

```ts
export interface Shape { points: string; fromColor: string; toColor: string }
export function chartShapes(segments: Segment[], width: number, height: number): Shape[]
export interface Chart { setPlayhead(posSec: number | null): void }
export function renderChart(svg: SVGSVGElement, segments: Segment[]): Chart
```

Geometri i `chartShapes`: skalans topp är det största av 120 och passets högsta procent. Varje segment blir en fyrhörning med 1 enhets luft på var sida: `x0 = start/total·width + 1`, `x1 = slut/total·width − 1`, och punkterna skrivs `x0,height x0,yFrom x1,yTo x1,height` där `y = height − pct/topp·height`. Färgerna är zonens `color` för `fromPct` respektive `toPct`.

`renderChart` sätter `viewBox="0 0 1000 200"` och `preserveAspectRatio="none"`, ritar en polygon per form (med en vågrät `linearGradient` när de två färgerna skiljer sig), en nedtonande rektangel (`#0b0b0b`, opacitet 0,6) över det som har passerats och en ljus markörlinje, 4 enheter bred. `setPlayhead(null)` gömmer linje och nedtoning.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
it('räknar ut formerna', () => {
  const one: Segment[] = [{ name: 'A', startSec: 0, durationSec: 60, fromPct: 60, toPct: 120 }]
  expect(chartShapes(one, 1000, 200)).toEqual([{ points: '1,200 1,100 999,0 999,200', fromColor: '#378ADD', toColor: '#E24B4A' }])
})
it('delar bredden efter tid och höjer skalan över 120', () => {
  const two: Segment[] = [
    { name: 'A', startSec: 0, durationSec: 30, fromPct: 150, toPct: 150 },
    { name: 'B', startSec: 30, durationSec: 90, fromPct: 75, toPct: 75 },
  ]
  expect(chartShapes(two, 1000, 200).map(s => s.points)).toEqual(['1,200 1,0 249,0 249,200', '251,200 251,100 999,100 999,200'])
})
it('klarar ett tomt pass', () => {
  expect(chartShapes([], 1000, 200)).toEqual([])
})
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, `chartShapes` finns inte.

- [ ] **Step 3: Implementera `chartShapes` och `renderChart` i `src/ui/chart.ts`**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: staplar med markörlinje"
```

---

### Task 7: Biblioteket

**Files:**
- Create: `src/ui/library.ts`
- Modify: `src/main.ts` (byt platshållaren mot vyn, skapa en gemensam `Store`), `src/styles.css`

**Interfaces:**
- Consumes: `Store` (uppgift 4), `flatten`, `totalDuration`, `mmss` (uppgift 2), `renderChart` (uppgift 6), `View` (uppgift 1).
- Produces: `libraryView(store: Store): View`

Vad vyn gör:
- Rubrik "Dina pass". En rad per pass med namn, total tid (`mmss`), en liten stapelbild utan markörlinje och knapparna "Starta", "Redigera", "Duplicera" och "Ta bort".
- "Starta" leder till `#/run/<id>` och är avstängd med förklaringen "Passet är tomt" om passet saknar block.
- "Ta bort" frågar "Ta bort passet <namn>?" innan något tas bort.
- "Duplicera" skapar en kopia med nya id:n och namnet "<namn> (kopia)".
- "Nytt pass" skapar ett pass med namnet "Nytt pass" och ett block (300 s, 55 %) och går till redigeraren.
- "Exportera pass" laddar ned `spinningpass-ÅÅÅÅ-MM-DD.json` med innehållet från `exportAll`.
- "Importera pass" öppnar en filväljare för `.json`. Lyckad import visar "N pass importerade", misslyckad visar felets meddelande. Inget av dem med `alert`.
- "Peppord": en textruta med ett ord eller en fras per rad och knappen "Spara". Tomma rader tas bort. En tom lista sparas som tom.
- Om `listWorkouts` kastar visas felets meddelande i stället för listan, och knapparna för nytt pass och import är avstängda så att den trasiga datan inte skrivs över.

- [ ] **Step 1: Implementera `libraryView` enligt listan ovan och koppla in den i `main.ts`**

- [ ] **Step 2: Kontrollera i webbläsaren**

Run: `npm run dev`, öppna `http://localhost:5173/`.
Expected:
- Tre exempelpass syns med rätt total tid: 74:00, 70:00 och 66:00.
- Duplicera, ta bort (med fråga) och nytt pass fungerar och finns kvar efter omladdning.
- Export ger en fil, och import av samma fil ger sex pass.
- Import av en textfil som inte är JSON visar "Filen är inte en giltig passfil" och lägger inte till något.
- Sätt `localStorage['spinning.workouts.v1'] = '{'` i konsolen och ladda om: felmeddelandet visas, och värdet är oförändrat efteråt.

- [ ] **Step 3: Kör byggkontrollen**

Run: `npm run build`
Expected: inga typfel.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: bibliotek med export, import och peppord"
```

---

### Task 8: Redigeraren

**Files:**
- Create: `src/model/edit.ts`, `src/ui/editor.ts`
- Modify: `src/main.ts`, `src/styles.css`
- Test: `src/model/edit.test.ts`

**Interfaces:**
- Consumes: `Store`, `validateWorkout`, `LIMITS`, `flatten`, `totalDuration`, `mmss`, `renderChart`, `View`.
- Produces:

```ts
// edit.ts  (alla ger en ny lista och ändrar inte den gamla)
export function newBlock(): Block                       // 300 s, 55 %, tomt namn, nytt id
export function newGroup(): Group                       // repeat 4, blocken 240 s 100 % och 120 s 55 %
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[]
export function duplicateAt<T extends Item>(list: T[], index: number): T[]   // kopian hamnar direkt efter, med nya id:n på alla nivåer
export function removeAt<T>(list: T[], index: number): T[]

// editor.ts
export function editorView(store: Store): View
```

Vad vyn gör:
- Okänt id visar "Passet finns inte" och en länk "Till biblioteket".
- Fält för passets namn. Under det total tid och stapelbilden, som ritas om vid varje ändring.
- En rad per block med fälten namn (platshållare är zonens namn), minuter, sekunder, från % och till %, samt knapparna upp, ned, duplicera och ta bort. Knapparna har `aria-label` med blockets nummer.
- En grupp visas som en inramad ruta med fältet "Upprepa" och sina block som rader, plus "Lägg till block i gruppen" och gruppens egna knappar för upp, ned, duplicera och ta bort.
- "Lägg till block" och "Lägg till grupp" sist i listan.
- Varje ändring körs genom `validateWorkout`. Giltigt pass sparas automatiskt inom 300 ms och texten "Sparat" visas. Ogiltigt pass sparas inte, och felmeddelandet visas vid listan tills det är åtgärdat.
- "Starta passet" leder till `#/run/<id>` och "Till biblioteket" till `#/`.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
it('flyttar inom listan och stannar vid kanterna', () => {
  expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
})
it('duplicerar med nya id:n på alla nivåer', () => {
  const g = newGroup()
  const [first, copy] = duplicateAt<Item>([g], 0) as Group[]
  expect(first).toBe(g)
  expect(copy.id).not.toBe(g.id)
  expect(copy.blocks.map(b => b.id)).not.toEqual(g.blocks.map(b => b.id))
  expect(copy.blocks.map(b => b.durationSec)).toEqual([240, 120])
})
it('tar bort utan att ändra originalet', () => {
  const list = ['a', 'b']
  expect(removeAt(list, 0)).toEqual(['b'])
  expect(list).toEqual(['a', 'b'])
})
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, `edit.ts` finns inte.

- [ ] **Step 3: Implementera `src/model/edit.ts`**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Implementera `editorView` enligt listan ovan och koppla in den i `main.ts`**

- [ ] **Step 6: Kontrollera i webbläsaren**

Run: `npm run dev`.
Expected:
- Bygg passet i designens exempelbild: sned uppvärmning, grupp 4 × (2 min 105 % + 1 min 95 %), vila 5 min, gruppen duplicerad, sned nedvarvning. Stapelbilden visar två set med vila emellan, och total tid är summan.
- Skriv 300 i ett procentfält: felmeddelandet nämner "20 och 200", och efter omladdning finns det gamla värdet kvar.
- Rätta värdet: "Sparat" visas och ändringen finns kvar efter omladdning.
- `#/edit/finns-inte` visar "Passet finns inte".

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: redigerare för pass"
```

---

### Task 9: Skärmen

**Files:**
- Create: `src/ui/cues.ts`, `src/ui/run.ts`
- Modify: `src/main.ts`, `src/styles.css`
- Test: `src/ui/cues.test.ts`

**Interfaces:**
- Consumes: `Store` (inklusive `store.kv`), `flatten`, `totalDuration`, `mmss`, `pctText`, `zoneFor`, `renderChart`, klockan och uppslagningen från uppgift 5, `View`.
- Produces:

```ts
// cues.ts
export function countdownNumber(durationSec: number, remainingMs: number): number | null
export function bannerVisible(elapsedMs: number): boolean
export function pepIntervalSec(pctNow: number): number | null
export function pepAllowed(pctNow: number, elapsedMs: number, remainingMs: number): boolean
export function jumped(prevPosMs: number, posMs: number): boolean

// run.ts
export function runView(store: Store): View
```

Regler i `cues.ts`:
- `countdownNumber`: `null` om blocket är kortare än 15 s eller om mer än 5000 ms återstår eller inget återstår. Annars återstående tid i hela sekunder, avrundat uppåt (5, 4, 3, 2, 1).
- `bannerVisible`: sant under blockets första 3000 ms.
- `pepIntervalSec`: `null` under 88 %. 90 s vid 88 %, rak linje ned till 25 s vid 120 %, och 25 s över det.
- `pepAllowed`: sant bara om procenten är minst 88, banderollen inte visas och mer än 10 000 ms återstår.
- `jumped`: sant om positionen har gått bakåt eller mer än 2000 ms framåt sedan förra bildrutan.

Vad vyn gör:
- **Tid.** Vyn har en egen funktion för "nu": `Date.now()`, eller om adressen har `?fart=N` (till exempel `http://localhost:5173/?fart=30#/run/<id>`) en klocka som går N gånger fortare från att vyn öppnades. All tid i vyn går genom den. Skärmen ritas om med `requestAnimationFrame` och läser alltid positionen ur `position(...)`.
- **Okänt id** visar "Passet finns inte" och en länk till biblioteket. **Tomt pass** visar "Passet är tomt" och en länk till redigeraren.
- **Start av vyn.** Om `loadRun` ger en klocka går vyn direkt till läget under passet och visar "Tryck F för fullskärm" tills fullskärm är på. Annars visas överblicken.
- **Överblick.** Passets namn, total tid, stora staplar utan markörlinje, och en hopfälld lista över passets innehåll där en grupp skrivs som `4 × (2 min 105 % + 1 min 95 %)` och ett block som `10 min 45 → 70 %`. Längder skrivs `N s` under en minut, `N min` för hela minuter och annars `N min S s`. Texten "Mellanslag startar passet". En tom yta med id `mic-panel` lämnas för uppgift 10.
- **Under passet.** Upplägget i designens skiss: passets namn och "Total tid MM:SS av MM:SS" överst, blockets namn, aktuell procent i zonens `textColor`, raden "Nästa: <namn> · <MM:SS> · <pctText>" (eller "Sista blocket"), nedräkningen för blocket med texten "kvar av intervallet", och staplarna med markörlinje nederst. Total tid avrundas nedåt och blockets nedräkning uppåt.
- **Signaler.** Nedräkningens siffra visas stort mitt på skärmen när `countdownNumber` ger ett tal. Banderollen visas när `bannerVisible` är sant, med blockets namn, `pctText` och längd. Ett peppord visas i 4 sekunder när det har gått `pepIntervalSec` (med slumpad avvikelse på upp till 30 %) sedan förra ordet och `pepAllowed` är sant. Ordet väljs slumpvis ur `getPepWords()` och aldrig samma två gånger i rad. Tom lista ger inga ord.
- **Efter uppehåll.** När `jumped` är sant (fliken har varit dold, datorn har sovit eller instruktören har hoppat) nollställs tiden för nästa peppord, så att inget spelas upp i efterhand.
- **Klart.** När `locate` ger `done` visas "Bra jobbat", total tid och länken "Till biblioteket", och det sparade läget rensas.
- **Tangenter.** Mellanslag startar, pausar och fortsätter. Pil höger går till `nextStartMs`, pil vänster till `prevStartMs`. F växlar fullskärm på `document.documentElement`. Q öppnar en ruta i sidan med "Avsluta passet? Enter avslutar, valfri annan tangent fortsätter" (inte `confirm()`, som kastar ut webbläsaren ur fullskärm). Enter där rensar det sparade läget och går till biblioteket. Mellanslag får inte rulla sidan.
- **Paus** visar "Pausad" tydligt.
- **Sparat läge.** `saveRun` anropas vid start, paus, fortsättning och hopp.
- **Vaken skärm.** `navigator.wakeLock.request('screen')` begärs när passet startar och igen när `visibilitychange` gör fliken synlig. Saknas stödet eller nekas begäran fortsätter passet utan fel.
- **Muspekaren** göms efter 3 sekunder utan rörelse och visas igen vid rörelse.
- **Städning.** Vyns städfunktion tar bort lyssnare, avbryter bildrutorna och släpper vakenlåset.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
it('räknar ned de sista fem sekunderna på block från 15 sekunder', () => {
  expect(countdownNumber(15, 5001)).toBeNull()
  expect(countdownNumber(15, 5000)).toBe(5)
  expect(countdownNumber(15, 4200)).toBe(5)
  expect(countdownNumber(15, 800)).toBe(1)
  expect(countdownNumber(15, 0)).toBeNull()
  expect(countdownNumber(14, 3000)).toBeNull()
})
it('visar banderollen i tre sekunder', () => {
  expect(bannerVisible(0)).toBe(true)
  expect(bannerVisible(2999)).toBe(true)
  expect(bannerVisible(3000)).toBe(false)
})
it('ger tätare peppord ju högre procent', () => {
  expect(pepIntervalSec(87.9)).toBeNull()
  expect(pepIntervalSec(88)).toBe(90)
  expect(pepIntervalSec(104)).toBe(57.5)
  expect(pepIntervalSec(120)).toBe(25)
  expect(pepIntervalSec(150)).toBe(25)
})
it('håller peppord borta från banderoll och blockets slut', () => {
  expect(pepAllowed(100, 3000, 10001)).toBe(true)
  expect(pepAllowed(100, 2999, 60000)).toBe(false)
  expect(pepAllowed(100, 30000, 10000)).toBe(false)
  expect(pepAllowed(80, 30000, 60000)).toBe(false)
})
it('märker när positionen har hoppat', () => {
  expect(jumped(1000, 1016)).toBe(false)
  expect(jumped(1000, 3000)).toBe(false)
  expect(jumped(1000, 3001)).toBe(true)
  expect(jumped(600000, 9e9)).toBe(true)
  expect(jumped(5000, 4000)).toBe(true)
})
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, `cues.ts` finns inte.

- [ ] **Step 3: Implementera `src/ui/cues.ts`**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Implementera `runView` enligt listan ovan och koppla in den i `main.ts`**

- [ ] **Step 6: Kontrollera i webbläsaren**

Run: `npm run dev`, öppna exempelpasset "Tröskel 4 × 8 min" med `?fart=30`.
Expected:
- Överblicken visar staplar, total tid 70:00 och bland raderna `3 × (30 s 110 % + 1 min 30 s 55 %)` och `4 × (8 min 100 % + 3 min 55 %)`.
- Mellanslag startar. Markörlinjen rör sig, passerade staplar tonas ned, och "Nästa:" stämmer med nästa stapel.
- Vid varje byte syns nedräkningen 5 till 1 och sedan banderollen. På höjningarna (30 s) syns båda, och inget överlappar.
- Peppord dyker upp under tröskelblocken och aldrig under vilan.
- Pil höger och vänster hoppar rätt, även från första och sista blocket.
- Ladda om mitt i passet: klockan fortsätter där den var, och "Tryck F för fullskärm" visas.
- Utan `?fart`: starta, vänta 60 sekunder mot en annan klocka, och total tid visar 01:00 inom en sekund. Byt flik i 30 sekunder och kom tillbaka: tiden stämmer fortfarande.
- F ger fullskärm, Q följt av Enter avslutar, och ett nytt försök visar överblicken igen.
- När passet går klart visas "Bra jobbat", och omladdning visar överblicken.
- `#/run/finns-inte` visar "Passet finns inte".

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: skärmen med klockor, signaler och tangenter"
```

---

### Task 10: Ljud, mikrofonpanel och bruksanvisning

**Files:**
- Create: `src/audio/bands.ts`, `src/audio/beat.ts`, `src/audio/beatSource.ts`, `src/audio/mic.ts`, `src/ui/micPanel.ts`, `README.md`
- Modify: `src/ui/run.ts` (panelen i överblicken, tangenterna pil upp, pil ned och M, lägesikonen), `src/styles.css`
- Test: `src/audio/bands.test.ts`, `src/audio/beat.test.ts`, `src/audio/beatSource.test.ts`

**Interfaces:**
- Consumes: `MicSettings`, `Store.getMicSettings`, `Store.saveMicSettings`.
- Produces:

```ts
// bands.ts
export function bandEnergy(freq: Uint8Array, sampleRate: number, fftSize: number, loHz: number, hiHz: number): number
// medelvärdet (0 till 1) av de fack vars mittfrekvens ligger i [loHz, hiHz); 0 om inga fack träffas

// beat.ts
export class BeatDetector {
  sensitivity: number                       // 1 till 10, klipps till intervallet, standard 5
  feed(energy: number, tMs: number): boolean
}

// beatSource.ts
export interface MicReading { level: number; bass: number; mid: number; treble: number }
export interface BeatFrame extends MicReading { beat: boolean; mode: 'mic' | 'intern' }
export class BeatSource {
  constructor(detector: BeatDetector)
  enabled: boolean                          // tangenten M; false tvingar intern takt
  update(reading: MicReading | null, nowMs: number): BeatFrame
}

// mic.ts
export interface Mic { read(): MicReading; setBassBand(loHz: number, hiHz: number): void; close(): void }
export function openMic(settings: MicSettings): Promise<Mic>

// micPanel.ts
export interface MicControl { getMic(): Mic | null; enableMic(): Promise<void> }   // ägs av run.ts
export function mountMicPanel(root: HTMLElement, store: Store, source: BeatSource, ctl: MicControl): () => void
```

`sensitivity` på `BeatDetector` är en egenskap med get och set, där set klipper värdet.

Regler:
- `BeatDetector.feed`: håller ett glidande medelvärde av energin med tidskonstanten 1 sekund, räknat på tiden mellan anropen. Ett slag är när energin är över `medel × (2,2 − 0,12 × sensitivity)`, över golvet 0,02, och minst 400 ms har gått sedan förra slaget. Medelvärdet börjar på första värdet.
- `BeatSource.update`: läget är `'intern'` när `enabled` är falskt, när `reading` är `null`, eller när `level` har legat under 0,01 i mer än 5000 ms. I internt läge kommer ett slag var 60000/130 ms och banden är 0. I mikrofonläge kommer slagen från `detector.feed(reading.bass, nowMs)`. Så fort nivån är över 0,01 igen gäller mikrofonen.
- `openMic`: `getUserMedia` med `echoCancellation`, `noiseSuppression` och `autoGainControl` satta till `false`. `AnalyserNode` med `fftSize` 2048 och `smoothingTimeConstant` 0,5. `level` är RMS av tidssignalen. Banden: bas enligt inställningen, mellan 150 till 2000 Hz, diskant 2000 till 8000 Hz. När ljudspåret avslutas (`ended`) ska `read()` börja ge nivå 0, så att `BeatSource` går över till intern takt. Nekad åtkomst kastar, och anroparen fortsätter utan mikrofon.
- `run.ts` äger mikrofonen. Första gången öppnas den med knappen "Slå på mikrofonen" i panelen, så att webbläsarens fråga kommer när man väntar sig den. Om tillståndet redan är givet (`navigator.permissions.query({ name: 'microphone' })` ger `granted`) öppnas den i stället vid första tangenttryckningen eller klicket i vyn, eftersom webbläsaren kräver en sådan innan ljud får startas. Det gäller även efter en omladdning mitt i passet.
- **Panelen i överblicken:** knappen "Slå på mikrofonen", en nivåmätare, en lampa som blinkar på varje slag, texten "Mikrofon" eller "Intern takt" för läget, ett reglage för känslighet (1 till 10) och två talfält för basbandets gränser (20 till 500 Hz, undre måste vara lägre än övre). Ändringar sparas med `saveMicSettings`. Nekad åtkomst visar "Mikrofonen är inte tillåten. Appen använder intern takt."
- **Under passet:** pil upp och pil ned ändrar känsligheten ett steg och sparar. M växlar `enabled`. En liten ikon med text i hörnet visar "Mikrofon" eller "Intern takt", och en liten prick bredvid blinkar på varje slag.
- **README.md** på svenska: hur appen startas (`npm install` första gången, sedan `npm run dev` och adressen `http://localhost:5173/`), tangenterna, att locket ska vara öppet, hur passen säkerhetskopieras, och en checklista för provet i salen: slå på mikrofonen med musiken igång, se om lampan följer bastrumman, prova känsligheten, prova att höja basbandets övre gräns om lampan missar slag, prova medan instruktören pratar, och anteckna vilken musik det fungerade med.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
// bands.test.ts
it('mäter energin i ett frekvensband', () => {
  const freq = new Uint8Array(1024)
  for (let i = 2; i <= 6; i++) freq[i] = 255        // fack 2 till 6 är 46,9 till 140,6 Hz vid 48 kHz och 2048
  expect(bandEnergy(freq, 48000, 2048, 40, 150)).toBe(1)
  expect(bandEnergy(freq, 48000, 2048, 150, 2000)).toBe(0)
  expect(bandEnergy(freq, 48000, 2048, 1, 2)).toBe(0)
})

// beat.test.ts
const run = (energyAt: (tMs: number) => number, sensitivity = 5) => {
  const d = new BeatDetector(); d.sensitivity = sensitivity
  let beats = 0
  for (let t = 0; t < 10000; t += 1000 / 60) if (d.feed(energyAt(t), t)) beats++
  return beats
}
const pulse = (periodMs: number) => (t: number) => (t % periodMs < 1000 / 60 ? 1 : 0.1)

it('hittar slagen i 130 slag per minut', () => {
  const beats = run(pulse(60000 / 130))
  expect(beats).toBeGreaterThanOrEqual(20)
  expect(beats).toBeLessThanOrEqual(22)
})
it('ger aldrig mer än 2,5 slag per sekund', () => {
  expect(run(pulse(100))).toBeLessThanOrEqual(26)
})
it('ger inga slag på jämnt ljud eller tystnad', () => {
  expect(run(() => 0.5)).toBe(0)
  expect(run(() => 0)).toBe(0)
})
it('klipper känsligheten till 1 till 10', () => {
  const d = new BeatDetector()
  d.sensitivity = 99; expect(d.sensitivity).toBe(10)
  d.sensitivity = -3; expect(d.sensitivity).toBe(1)
})

// beatSource.test.ts
const loud: MicReading = { level: 0.3, bass: 0.1, mid: 0.2, treble: 0.1 }
const quiet: MicReading = { level: 0.001, bass: 0, mid: 0, treble: 0 }
const count = (s: BeatSource, reading: MicReading | null, fromMs: number, toMs: number) => {
  let beats = 0, last: BeatFrame | null = null
  for (let t = fromMs; t < toMs; t += 1000 / 60) { last = s.update(reading, t); if (last.beat) beats++ }
  return { beats, mode: last!.mode }
}

it('går på intern takt utan mikrofon', () => {
  const r = count(new BeatSource(new BeatDetector()), null, 0, 10000)
  expect(r.mode).toBe('intern')
  expect(r.beats).toBeGreaterThanOrEqual(21)
  expect(r.beats).toBeLessThanOrEqual(22)
})
it('byter till intern takt efter fem sekunders tystnad och tillbaka när ljudet kommer', () => {
  const s = new BeatSource(new BeatDetector())
  expect(count(s, loud, 0, 1000).mode).toBe('mic')
  expect(count(s, quiet, 1000, 5900).mode).toBe('mic')
  expect(count(s, quiet, 5900, 7000).mode).toBe('intern')
  expect(count(s, loud, 7000, 7100).mode).toBe('mic')
})
it('klarar att mikrofonen försvinner mitt i passet', () => {
  const s = new BeatSource(new BeatDetector())
  count(s, loud, 0, 1000)
  expect(count(s, null, 1000, 3000)).toMatchObject({ mode: 'intern' })
})
it('tvingar intern takt när mikrofonen är avstängd med M', () => {
  const s = new BeatSource(new BeatDetector()); s.enabled = false
  expect(count(s, loud, 0, 1000).mode).toBe('intern')
})
```

- [ ] **Step 2: Kör testerna och se att de fallerar**

Run: `npm test`
Expected: FAIL, modulerna finns inte.

- [ ] **Step 3: Implementera `bands.ts`, `beat.ts` och `beatSource.ts` enligt reglerna ovan**

- [ ] **Step 4: Kör testerna**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Implementera `mic.ts` och `micPanel.ts`, koppla in dem i `run.ts`, och skriv `README.md`**

- [ ] **Step 6: Kontrollera i webbläsaren**

Run: `npm run dev`, öppna ett pass.
Expected:
- "Slå på mikrofonen" ger webbläsarens fråga. Efter ja rör sig nivåmätaren när man pratar, och läget visar "Mikrofon".
- Spela techno från en högtalare bredvid datorn: lampan blinkar i takt med bastrumman. Högre känslighet ger fler blink, lägre ger färre.
- Tyst i mer än fem sekunder: läget blir "Intern takt" och lampan blinkar jämnt. Musik igen: läget blir "Mikrofon".
- Neka mikrofonen (via webbläsarens inställning för sidan): meddelandet om intern takt visas, och passet går att köra som vanligt.
- Under passet ändrar pil upp och ned känsligheten, M växlar läget, och värdena finns kvar efter omladdning.
- Klockorna påverkas inte av något av ovanstående.

- [ ] **Step 7: Kör alla tester och byggkontrollen**

Run: `npm test && npm run build`
Expected: alla tester PASS, inga typfel.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: taktdetektering, mikrofonpanel och bruksanvisning"
```
