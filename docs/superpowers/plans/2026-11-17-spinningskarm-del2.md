# Spinningskärm del 2: 3D-animationer. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under passet fyller en 3D-animation i technostil bakgrunden, blir vildare ju högre procent av FTP och pulserar i takt med musiken, utan att klockorna blir svårare att läsa och utan att skärmen blinkar farligt.

**Architecture:** Allt som går att räkna ut (intensitet, slagpuls, ljudband, scenval, ljusbegränsning, kvalitetsnivå, kantram, kontrast) är rena funktioner och klasser i `src/anim/` med tester, utan three.js. En scen (`src/anim/stage.ts`) äger three.js: rendering, efterbehandling, ljusmätning och scenbyten. Varje scen är en egen fil i `src/anim/scenes/`. Skärmen (`src/ui/run.ts`) skickar in läget varje bildruta och vet inget om three.js.

**Tech Stack:** Vite, TypeScript, Vitest, three.js 0.187.0 med dess egna tillägg (`three/addons/...`). Inga andra nya beroenden.

**Spec:** `docs/superpowers/specs/2026-11-16-spinningskarm-design.md`, avsnitten "Animationerna", "Ramar" (prestanda), "Anti-mål" och tangenttabellen.

**Omfattning:** Steg 3 i designens byggordning. Animationerna drivs av `BeatSource` som den är i dag: mikrofonen när den hörs, annars den interna takten. Justering av ljudet efter provet i salen ingår inte. Den görs som en egen liten ändring när Elias har provat, och påverkar bara konstanter i `src/anim/drive.ts` och `src/audio/`.

## Global Constraints

- All text i gränssnittet är på svenska.
- Endast mörkt läge. Bakgrund `#0b0b0b`, text `#f1efe8`, dämpad text `#b4b2a9`.
- Chrome och Edge. Safari och Firefox är inte krav.
- Inga resurser hämtas från nätet vid körning. three.js byggs in av Vite.
- Beroenden: `three` exakt `0.187.0` som dependency och `@types/three` exakt `0.187.0` som devDependency. Inga andra nya paket. Efterbehandling tas från `three/addons/postprocessing/` och egna shaders.
- Ingen fil i `src/anim/` utom `stage.ts` och `scenes/` importerar `three`. Testerna körs i Node utan DOM och WebGL.
- 3D-bilden ritas aldrig i högre upplösning än 1920×1080.
- Pulser kommer högst 2,5 gånger per sekund. Det garanteras redan av `BeatSource` (400 ms mellan slag) och får inte kringgås: ingen scen skapar egna ljusblixtar utanför slagpulsen.
- Ljuset: bildens medelljusstyrka (relativ luminans enligt WCAG, 0 till 1) får stiga högst 0,08 per 400 ms och aldrig överstiga 0,20. Sänkningar är fria. Inga hårda växlingar mellan svart och vitt över hela bilden och inga mättat röda helskärmsblink.
- Text under passet ligger på plattor med bakgrunden `#0b0b0beb` (92 % täckning). Kontrasten mot plattan ska vara minst 7:1 även när det bakom plattan är helvitt.
- Tangenten A stänger av allt utom en stilla mörk bakgrund. Valet sparas.
- Ingen kod utanför `src/storage/` rör `localStorage`.
- Testfiler ligger bredvid koden som `*.test.ts`. Kör alla med `npm test`, typkontroll och bygge med `npm run build`.
- Varje uppgift avslutas med en commit. Commit-meddelanden slutar med raden `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Kommandon: aldrig `cd`, exakta sökvägar, ett enkelt kommando per anrop utan `&&`, rör eller variabler. Filer läses och skrivs med verktygen, inte med `cat`, `sed` eller `echo`.

## Review Focus

1. **WebGL saknas eller tappas mitt i passet.** Skärmen ska fungera som i del 1, utan animationer och utan fel i bildrutsloopen. (Uppgift 3 och 4.)
2. **Upprepade pass i samma flik.** Att gå bibliotek → skärm → bibliotek tjugo gånger får inte ta slut på webbläsarens WebGL-kontexter (gränsen är cirka 16). Allt släpps när vyn städas. (Uppgift 3 och 4.)
3. **Dold flik eller sovande laptop.** Ett glapp på flera sekunder mellan bildrutor ska inte ge ett ryck i ljus, intensitet eller kvalitetsnivå. (Tester i uppgift 1 och 2.)
4. **Korta block och pil höger i följd.** Scenen byts högst var 20:e sekund, och bytet tonar genom mörker utan blixt. (Test i uppgift 1.)
5. **Ljusaste tänkbara läget:** VO2max, full glöd och slag 2,5 gånger per sekund. Medelljusstyrkan ska ändå hålla sig inom reglerna, kontrollerat med mätrutan `?ljus=1`. (Test i uppgift 2, kontroll i uppgift 4 till 7.)

---

## Filstruktur

```
src/
  anim/
    types.ts            Bands, SceneInput
    drive.ts            intensityFor, follow, BeatPulse, BandLevels, SceneDirector, calmFor, edgeOpacity, shakeAmount
    governor.ts         LightGovernor, RISE_PER_400MS, MAX_MEAN
    quality.ts          QUALITY_LEVELS, QualityController
    stage.ts            createStage: three.js, efterbehandling, ljusmätning, scenbyten, kantram, mätruta
    scenes/
      scene.ts          Scene, SceneFactory
      index.ts          SCENES (listan med fabriker)
      tunnel.ts         Tunneln
      grid.ts           Nätlandskapet
      swarm.ts          Partikelsvärmen
      ring.ts           Spektrumringen
  ui/
    contrast.ts         PLATE_ALPHA, contrastOnPlate
    run.ts              kopplar skärmen till scenen (ändras)
  storage/storage.ts    getAnimationsOn, saveAnimationsOn (ändras)
  styles.css            plattor, .stage, .edge, mätrutan (ändras)
README.md               tangenten A, ?ljus=1, ?scen=N, checklista (ändras)
```

---

### Task 1: Animationernas indata

Rena funktioner som gör om passets läge och ljudet till det scenerna läser. Inget three.js.

**Files:**
- Create: `src/anim/types.ts`, `src/anim/drive.ts`
- Test: `src/anim/drive.test.ts`

**Interfaces:**
- Consumes: `BeatFrame` från `src/audio/beatSource.ts` (`mode: 'mic' | 'intern'`, `bass`, `mid`, `treble` som linjär amplitud ungefär 0,0001 till 0,05).
- Produces:
  - `interface Bands { bass: number; mid: number; treble: number }` (0 till 1, utjämnade)
  - `interface SceneInput { intensity: number; pulse: number; bands: Bands; color: string; calm: boolean; timeSec: number; dtSec: number }`
  - `intensityFor(pctNow: number): number`
  - `follow(current: number, target: number, dtMs: number, tauMs: number): number`
  - `class BeatPulse { beat(nowMs: number): void; value(nowMs: number): number }`
  - `class BandLevels { update(frame: BeatFrame, nowMs: number, dtMs: number): Bands }`
  - `class SceneDirector { constructor(count: number, random?: () => number, forced?: number | null); pick(blockIndex: number, nowMs: number): number }`
  - `calmFor(pctNow: number, running: boolean): boolean`
  - `edgeOpacity(pctNow: number, pulse: number): number`
  - `shakeAmount(intensity: number): number`

- [ ] **Step 1: Skriv de fallerande testerna i `src/anim/drive.test.ts`**

```ts
it('intensitet: 50 % ger 0, 120 % ger 1, rakt emellan', () => {
  expect(intensityFor(50)).toBe(0)
  expect(intensityFor(40)).toBe(0)
  expect(intensityFor(85)).toBeCloseTo(0.5)
  expect(intensityFor(120)).toBe(1)
  expect(intensityFor(150)).toBe(1)
})
it('follow når 63 % av vägen på en tidskonstant och hoppar inte efter ett långt glapp', () => {
  expect(follow(0, 1, 100, 100)).toBeCloseTo(0.632, 3)
  expect(follow(0.2, 1, 0, 1500)).toBe(0.2)
  expect(follow(0, 1, 10000, 1500)).toBe(follow(0, 1, 100, 1500)) // glappet räknas som högst 100 ms
})
it('slagpulsen stiger mjukt på 80 ms och klingar av', () => {
  const p = new BeatPulse()
  expect(p.value(0)).toBe(0)
  p.beat(1000)
  expect(p.value(1000)).toBe(0)           // inget hopp i samma ögonblick
  expect(p.value(1040)).toBeGreaterThan(0)
  expect(p.value(1040)).toBeLessThan(1)
  expect(p.value(1080)).toBeCloseTo(1)
  expect(p.value(1330)).toBeCloseTo(Math.exp(-1), 2) // 250 ms efter toppen
  expect(p.value(3000)).toBeLessThan(0.01)
})
it('ett nytt slag mitt i avklingningen börjar från nuvarande värde', () => {
  const p = new BeatPulse()
  p.beat(0)
  const before = p.value(400)
  p.beat(400)
  expect(p.value(400)).toBeCloseTo(before)
  expect(p.value(480)).toBeCloseTo(1)
})
it('ljudbanden: jämn nivå från mikrofonen närmar sig 1 och ett plötsligt hopp jämnas ut', () => {
  const b = new BandLevels()
  const mic = (bass: number) => ({ level: 0.1, bass, mid: bass, treble: bass, beat: false, mode: 'mic' as const })
  let out = b.update(mic(0.01), 0, 16)
  for (let t = 16; t < 3000; t += 16) out = b.update(mic(0.01), t, 16)
  expect(out.bass).toBeGreaterThan(0.95)
  const quiet = new BandLevels()
  for (let t = 0; t < 3000; t += 16) quiet.update(mic(0.001), t, 16)
  const prev = quiet.update(mic(0.001), 3000, 16).bass
  const next = quiet.update(mic(0.05), 3016, 16).bass
  expect(next - prev).toBeLessThanOrEqual(1 - Math.exp(-16 / 150) + 1e-9) // tidskonstant 150 ms
})
it('ljudbanden: tystnad ger inga NaN, och den interna takten ger lugna värden mellan 0 och 1', () => {
  const b = new BandLevels()
  const zero = { level: 0, bass: 0, mid: 0, treble: 0, beat: false, mode: 'mic' as const }
  expect(Object.values(b.update(zero, 0, 16)).every(Number.isFinite)).toBe(true)
  const i = new BandLevels()
  const intern = { ...zero, mode: 'intern' as const }
  let prev = i.update(intern, 0, 16)
  for (let t = 16; t < 20000; t += 16) {
    const out = i.update(intern, t, 16)
    for (const k of ['bass', 'mid', 'treble'] as const) {
      expect(out[k]).toBeGreaterThanOrEqual(0)
      expect(out[k]).toBeLessThanOrEqual(1)
      expect(Math.abs(out[k] - prev[k])).toBeLessThan(0.05)
    }
    prev = out
  }
})
it('scenvalet: ny scen vid nytt block, aldrig samma som nyss, högst var 20:e sekund', () => {
  const d = new SceneDirector(4, () => 0)
  const first = d.pick(0, 0)
  expect(d.pick(0, 30000)).toBe(first)        // samma block: inget byte
  const second = d.pick(1, 30000)
  expect(second).not.toBe(first)
  expect(d.pick(2, 40000)).toBe(second)       // bara 10 s sedan bytet
  expect(d.pick(3, 50000)).not.toBe(second)   // 20 s sedan bytet
})
it('scenvalet: en tvingad scen gäller alltid, och med en enda scen blir det den', () => {
  expect(new SceneDirector(4, Math.random, 2).pick(5, 99999)).toBe(2)
  const one = new SceneDirector(1)
  expect(one.pick(0, 0)).toBe(0)
  expect(one.pick(1, 30000)).toBe(0)
})
it('lugnt läge under vila och paus', () => {
  expect(calmFor(55, true)).toBe(true)
  expect(calmFor(60, true)).toBe(false)
  expect(calmFor(100, false)).toBe(true)
})
it('kantramen tänds från 95 % och är som starkast vid 120 % på ett slag', () => {
  expect(edgeOpacity(94, 1)).toBe(0)
  expect(edgeOpacity(120, 1)).toBe(1)
  expect(edgeOpacity(120, 0)).toBeCloseTo(0.4)
  expect(edgeOpacity(107.5, 1)).toBeCloseTo(0.5)
  expect(edgeOpacity(140, 1)).toBe(1)
})
it('kameraskak från intensitet 0,8', () => {
  expect(shakeAmount(0.8)).toBe(0)
  expect(shakeAmount(0.9)).toBeCloseTo(0.5)
  expect(shakeAmount(1)).toBe(1)
})
```

- [ ] **Step 2: Kör `npx vitest run src/anim/drive.test.ts`.** Väntat: fel, funktionerna finns inte.

- [ ] **Step 3: Skriv `src/anim/types.ts` och `src/anim/drive.ts`** med signaturerna ovan. Värden som testerna inte låser:
  - `intensityFor`: `clamp((pct − 50) / 70, 0, 1)`.
  - `follow`: `current + (target − current) × (1 − e^(−min(dt, 100) / tau))`.
  - `BeatPulse`: från värdet vid slaget upp till 1 med smoothstep på 80 ms, sedan `e^(−t / 250 ms)`. Värdet håller sig mellan 0 och 1.
  - `BandLevels`, mikrofon: per band en topp som följer `max(x, topp × e^(−dt / 4000 ms))` men aldrig under 0,002, nivån `min(1, x / topp)`, sedan `follow` med tau 150 ms. Intern takt: långsamma sinusvågor med perioderna 1,8 s, 2,9 s och 4,1 s, mellan 0,15 och 0,75, också genom `follow`, så att bytet mellan lägena inte hoppar. Första anropet sätter värdena direkt utan utjämning, annars stiger de från 0 snabbare än testet tillåter.
  - `SceneDirector`: första anropet slumpar. Nytt `blockIndex` och minst 20 000 ms sedan senaste bytet ger en slumpad scen bland de andra. `forced` (0-baserat) vinner alltid.
  - `calmFor`: `!running || pctNow < 60` (zonen Vila).
  - `edgeOpacity`: `k × (0,4 + 0,6 × pulse)` där `k = clamp((pct − 95) / 25, 0, 1)`.
  - `shakeAmount`: `clamp(intensity × 5 − 4, 0, 1)`, det vill säga 0 vid 0,8 och 1 vid 1. Skriv den så, eftersom `(1 − 0,8) / 0,2` blir 0,9999… i flyttal.

- [ ] **Step 4: Kör `npx vitest run src/anim/drive.test.ts`.** Väntat: alla gröna.

- [ ] **Step 5: Commit** `feat: indata för animationerna (intensitet, slagpuls, ljudband, scenval)`.

---

### Task 2: Ljusbegränsning och kvalitetsnivå

Två rena klasser som scenen använder varje bildruta: den ena håller ljuset inom säkerhetsreglerna, den andra sänker kvaliteten när bildfrekvensen faller.

**Files:**
- Create: `src/anim/governor.ts`, `src/anim/quality.ts`
- Test: `src/anim/governor.test.ts`, `src/anim/quality.test.ts`

**Interfaces:**
- Produces:
  - `RISE_PER_400MS = 0.08`, `MAX_MEAN = 0.2`
  - `class LightGovernor { update(measured: number, dtMs: number): number }`: tar bildens uppmätta medelljusstyrka före dämpning och ger en förstärkning mellan 0 och 1.
  - `QUALITY_LEVELS: readonly { scale: number; particles: number }[]` = `[{ scale: 1, particles: 1 }, { scale: 0.75, particles: 0.6 }, { scale: 0.5, particles: 0.35 }]`
  - `class QualityController { level: number; frame(dtMs: number): number }`: ger aktuell nivå, 0 är bäst.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
// governor.test.ts
it('jämnt ljus lämnas orört', () => {
  const g = new LightGovernor()
  let gain = 1
  for (let t = 0; t < 2000; t += 16) gain = g.update(0.1, 16)
  expect(gain).toBeCloseTo(1)
})
it('ett plötsligt ljust ögonblick dämpas så att ljuset stiger högst 0,08 per 400 ms', () => {
  const g = new LightGovernor()
  for (let t = 0; t < 2000; t += 16) g.update(0.05, 16)
  let shown = 0.05
  for (let t = 0; t < 400; t += 16) shown = 0.15 * g.update(0.15, 16)
  expect(shown - 0.05).toBeLessThanOrEqual(RISE_PER_400MS + 1e-9)
})
it('medelljuset hålls under taket även när bilden är ljus länge', () => {
  const g = new LightGovernor()
  let gain = 1
  for (let t = 0; t < 20000; t += 16) gain = g.update(0.6, 16)
  expect(0.6 * gain).toBeCloseTo(MAX_MEAN)
})
it('ljuset får sjunka direkt, och svart bild ger förstärkning 1', () => {
  const g = new LightGovernor()
  for (let t = 0; t < 5000; t += 16) g.update(0.15, 16)
  expect(g.update(0.01, 16)).toBe(1)
  expect(g.update(0, 16)).toBe(1)
})
it('ett glapp på tio sekunder ger inget hopp i ljus', () => {
  const g = new LightGovernor()
  for (let t = 0; t < 2000; t += 16) g.update(0.02, 16)
  expect(0.5 * g.update(0.5, 10000) - 0.02).toBeLessThanOrEqual(RISE_PER_400MS * 100 / 400 + 1e-9)
})
// quality.test.ts
const run = (q: QualityController, fps: number, ms: number) => { for (let t = 0; t < ms; t += 1000 / fps) q.frame(1000 / fps) }
it('stannar på bästa nivån vid 60 bilder per sekund', () => {
  const q = new QualityController(); run(q, 60, 10000); expect(q.level).toBe(0)
})
it('går ned en nivå per två sekunder under 50 bilder per sekund, högst till nivå 2', () => {
  const q = new QualityController()
  run(q, 40, 2100); expect(q.level).toBe(1)
  run(q, 40, 2100); expect(q.level).toBe(2)
  run(q, 40, 6000); expect(q.level).toBe(2)
})
it('går upp en nivå efter sex sekunder med marginal', () => {
  const q = new QualityController(); q.level = 2
  run(q, 60, 6100); expect(q.level).toBe(1)
})
it('räknar inte bildrutor efter en dold flik', () => {
  const q = new QualityController(); run(q, 60, 1000)
  q.frame(5000)
  run(q, 60, 1500)
  expect(q.level).toBe(0)
})
```

- [ ] **Step 2: Kör `npx vitest run src/anim`.** Väntat: de nya testerna fallerar.

- [ ] **Step 3: Skriv klasserna.**
  - `LightGovernor`: håller det senast visade ljuset `shown`. Varje anrop: `target = min(measured, shown + RISE_PER_400MS × min(dt, 100) / 400, MAX_MEAN)`, `gain = measured > 0 ? target / measured : 1`, `shown = target`. Kommentera att mätningen kommer en eller två bildrutor efter bilden (se uppgift 3) och att slagpulsens stigtid på 80 ms gör eftersläpningen liten.
  - `QualityController`: samlar bildrutor i fönster om 2 000 ms och hoppar över bildrutor längre än 250 ms. Snitt under 50 bilder per sekund ger nivå +1 (högst 2). Tre fönster i följd med minst 58 ger nivå −1 (lägst 0). Varje nivåbyte börjar räkningen om.

- [ ] **Step 4: Kör `npm test`.** Väntat: alla gröna.

- [ ] **Step 5: Commit** `feat: ljusbegränsning och automatisk kvalitetsnivå för animationerna`.

---

### Task 3: Scenen med three.js och Tunneln

Lägger till three.js, bygger scenen som ritar, efterbehandlar, mäter och dämpar ljuset, och den första 3D-scenen. Efter den här uppgiften går det att se Tunneln genom en tillfällig sida (se steg 5). Skärmen kopplas in i uppgift 4.

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)
- Create: `src/anim/stage.ts`, `src/anim/scenes/scene.ts`, `src/anim/scenes/index.ts`, `src/anim/scenes/tunnel.ts`
- Modify: `src/styles.css` (`.stage`, `.edge`, `.light-meter`)

**Interfaces:**
- Consumes: allt från uppgift 1 och 2, `BeatFrame`, `zoneFor` från `src/model/zones.ts`.
- Produces:
  - `scenes/scene.ts`: `interface Scene { scene: THREE.Scene; camera: THREE.PerspectiveCamera; update(input: SceneInput): void; setParticles(fraction: number): void; dispose(): void }` och `type SceneFactory = () => Scene`.
  - `scenes/index.ts`: `export const SCENES: SceneFactory[]` (här bara `[tunnel]`; uppgift 5 till 7 lägger till).
  - `stage.ts`:
    ```ts
    export interface StageFrame { pctNow: number; running: boolean; blockIndex: number; beat: BeatFrame; nowMs: number }
    export interface StageOptions { forcedScene: number | null; lightMeter: boolean }
    export interface Stage { frame(f: StageFrame): void; setVisible(on: boolean): void; dispose(): void }
    export function createStage(options: StageOptions): Stage | null
    ```
    `createStage` ger `null` om WebGL inte går att starta. `nowMs` är `performance.now()`, inte passets klocka, så att animationen går i verklig tid även med `?fart`.

- [ ] **Step 1: Installera** `npm install three@0.187.0 --save-exact` och `npm install @types/three@0.187.0 --save-dev --save-exact`. Kontrollera att `package.json` har exakt de versionerna.

- [ ] **Step 2: Skriv `src/anim/stage.ts`.** Krav:
  - Lägger en `div.stage` (fast, hela fönstret, `z-index: 0`, `pointer-events: none`) med canvasen och en `div.edge` (fast, hela fönstret, `z-index: 2`, `pointer-events: none`, ram med `box-shadow: inset 0 0 0 1.2vh <zonens färg>`) i `document.body`. `dispose` tar bort båda.
  - Bufferten är högst 1920×1080: storleken räknas som `min(devicePixelRatio, 1920 / innerWidth, 1080 / innerHeight) × QUALITY_LEVELS[nivå].scale`. Följer fönstrets storlek.
  - Kedjan: scenens bild → `UnrealBloomPass` (styrka `0,3 + 1,2 × intensitet`, halverad i lugnt läge) → egen störningspass → `OutputPass` → ljusmätning → slutpass till skärmen.
  - Störningspassen är aktiv när `zoneFor(pctNow).name === 'VO2max'`: färgsplittring med förskjutning `0,002 + 0,006 × puls` och, när pulsen är över 0,6, några vågräta remsor som förskjuts i sidled. Den flyttar bara bildpunkter och ändrar inte ljusstyrkan.
  - Ljusmätningen ritar bilden efter `OutputPass` till ett mål på 16×9, avkodar sRGB till linjärt ljus och räknar relativ luminans enligt WCAG. Läs målet med `renderer.readRenderTargetPixelsAsync` (finns i 0.187; saknas den, läs med `readRenderTargetPixels` var fjärde bildruta). Medelvärdet går in i `LightGovernor`, och slutpasset multiplicerar det linjära ljuset med förstärkningen gånger toningen (nedan).
  - Scenbyte: `SceneDirector.pick` med `blockIndex`. Vid byte tonar bilden till mörkt på 600 ms, nästa scen skapas och den gamla släpps (`dispose`), och bilden tonar upp på 600 ms. Bara en scen finns åt gången.
  - Kameraskak: kamerans läge förskjuts med `shakeAmount(intensitet) × 0,05 × puls` i slumpad riktning efter `scene.update`.
  - Kantramen: `opacity = edgeOpacity(pctNow, puls)`, färg `zoneFor(pctNow).color`, satt varje bildruta. 0 när scenen är dold.
  - `SceneInput` byggs varje bildruta: `intensity` = `follow` mot `intensityFor(pctNow)` med tau 1 500 ms (mål 0 i lugnt läge), `pulse` från `BeatPulse` (som får `beat` när `f.beat.beat`), `bands` från `BandLevels`, `color` = `zoneFor(pctNow).color`, `calm` = `calmFor`, `timeSec` och `dtSec` ur `nowMs`.
  - `QualityController.frame(dt)` varje bildruta. Ny nivå sätter buffertens storlek och `scene.setParticles(QUALITY_LEVELS[nivå].particles)`.
  - `webglcontextlost` gör scenen dold för resten av vyn. Inga fel kastas ut ur `frame`.
  - `setVisible(false)` döljer canvasen och kantramen och slutar rita. `true` tar upp det igen.
  - `dispose` släpper scenen, alla mål och pass, anropar `renderer.dispose()` och `renderer.forceContextLoss()`.
  - Med `lightMeter: true` visas en liten ruta nere till vänster (`div.light-meter`) med visat medelljus, största stigningen under de senaste 400 ms, bilder per sekund och kvalitetsnivå.

- [ ] **Step 3: Skriv `scenes/scene.ts`, `scenes/index.ts` och `scenes/tunnel.ts`.** Tunneln: kameran flyger genom lysande ringar. Farten och vridningen följer intensiteten, ringarna tänds på pulsen, färgen följer zonen och lugnt läge ger låg fart och dämpat ljus. Antalet ringar följer `setParticles`. Allt annat i utseendet är byggarens val.

- [ ] **Step 4: Kör `npm test` och `npm run build`.** Väntat: gröna. Bygget får inte varna för cirkulära beroenden.

- [ ] **Step 5: Kontrollera i webbläsaren.** Skapa tillfälligt `scratch.html` i projektroten med ett skript som anropar `createStage({ forcedScene: null, lightMeter: true })` och matar `frame` med en procent som går från 50 till 130 på 30 sekunder och den interna takten (`new BeatSource(new BeatDetector()).update(null, nu)`). Öppna `http://localhost:5173/scratch.html` (devservern på 5173 enligt reglerna om portar). Kontrollera: tunneln syns och snabbar upp, kantramen tänds över 95 %, störningen syns över 106 %, mätrutan visar högst 0,20 och stigningen högst 0,08. **Ta bort `scratch.html` innan commit.**

- [ ] **Step 6: Commit** `feat: 3D-scen med three.js, ljusbegränsning och Tunneln`.

---

### Task 4: Animationerna på skärmen

Kopplar in scenen under passet, lägger texten på plattor, gör tangenten A och sparar valet.

**Files:**
- Create: `src/ui/contrast.ts`, `src/ui/contrast.test.ts`
- Modify: `src/ui/run.ts`, `src/storage/storage.ts`, `src/storage/storage.test.ts`, `src/styles.css`, `README.md`

**Interfaces:**
- Consumes: `createStage`, `Stage`, `StageFrame` från uppgift 3. `ZONES` från `src/model/zones.ts`.
- Produces:
  - `PLATE_ALPHA = 0.92`, `contrastOnPlate(textHex: string, plateAlpha: number): number`
  - `Store.getAnimationsOn(): Promise<boolean>` (standard `true`) och `Store.saveAnimationsOn(on: boolean): Promise<void>`, nyckel `spinning.anim.v1`.

- [ ] **Step 1: Skriv de fallerande testerna**

```ts
// contrast.test.ts
const texts = ['#f1efe8', '#b4b2a9', ...ZONES.map(z => z.textColor)]
it.each(texts)('%s går att läsa på plattan även när det bakom är helvitt', hex => {
  expect(contrastOnPlate(hex, PLATE_ALPHA)).toBeGreaterThanOrEqual(7)
})
it('85 % täckning räcker inte för den dämpade texten', () => {
  expect(contrastOnPlate('#b4b2a9', 0.85)).toBeLessThan(7)
})
// storage.test.ts (tillägg)
it('animationer är på från början, och valet sparas', async () => {
  const s = createStorage(fakeKV())
  expect(await s.getAnimationsOn()).toBe(true)
  await s.saveAnimationsOn(false)
  expect(await s.getAnimationsOn()).toBe(false)
})
```

- [ ] **Step 2: Kör `npm test`.** Väntat: de nya testerna fallerar.

- [ ] **Step 3: Skriv `src/ui/contrast.ts`.** Plattans färg är `#0b0b0b` blandad med vitt i sRGB efter `PLATE_ALPHA`. Kontrast och relativ luminans enligt WCAG 2.

- [ ] **Step 4: Lägg till `getAnimationsOn` och `saveAnimationsOn` i `src/storage/storage.ts`.** Ett värde som inte går att tolka ger `true`.

- [ ] **Step 5: Koppla in i `src/ui/run.ts`.**
  - Läs `?scen=N` (1 till `SCENES.length`, annars ingen) och `?ljus=1`. Skapa scenen när skärmen öppnas med `createStage({ forcedScene: N − 1 eller null, lightMeter })`. Den syns bara i läget `live`; i överblicken och efter passet är bakgrunden mörk som i dag.
  - I bildrutsloopen, efter `sound()` och bara i läget `live`: `stage.frame({ pctNow, running: clock.running, blockIndex, beat: source.frame, nowMs: performance.now() })`, där `pctNow` och `blockIndex` kommer från samma `locate` som `draw` använde.
  - Tangenten A under passet växlar animationerna och sparar valet. Läget visas i rutan nere till höger efter takten: "· Animationer av". Utan WebGL gör A ingenting.
  - Städningen anropar `stage.dispose()`.
- [ ] **Step 6: Plattor i `src/styles.css`.** I läget `live` får `.top`, `.current`, `.chart` och `.beat` bakgrunden `#0b0b0beb` med rundade hörn och luft runt texten. Skärmens innehåll (`.run`) ligger över `.stage` (`z-index: 1`). Kontrollera att skärmen fortfarande ryms utan rullning och klippning i 1024×768, 1280×1024 och 1920×1080, och att animationen syns mellan plattorna.

- [ ] **Step 7: Uppdatera `README.md`.** Tangenten A i tabellen (sparas, till skillnad från M). Ett avsnitt om animationerna: vad de gör, att A stänger av dem om någon i salen är ljuskänslig, och utvecklingslägena `?scen=N` och `?ljus=1`. Lägg till i checklistan för salen: animationerna bländar inte, klockorna går att läsa från bakersta cykeln, A stänger av.

- [ ] **Step 8: Kör `npm test` och `npm run build`.** Väntat: gröna.

- [ ] **Step 9: Kontrollera i webbläsaren** med `http://localhost:5173/?fart=30&ljus=1#/run/exempel-vo2max`:
  - Tunneln syns under passet och blir vildare i intervallerna, lugn i vilan och vid paus.
  - A stänger av och sätter på; valet står kvar efter omladdning.
  - Mätrutan: medelljuset högst 0,20 och stigningen högst 0,08 under hela passet.
  - Bibliotek → passet → bibliotek tio gånger: inga varningar om WebGL-kontexter i konsolen.
  - Lämna lagringen som den var (animationer på).

- [ ] **Step 10: Commit** `feat: animationerna på skärmen, plattor bakom texten och tangenten A`.

---

### Task 5: Nätlandskapet

**Files:**
- Create: `src/anim/scenes/grid.ts`
- Modify: `src/anim/scenes/index.ts`

**Interfaces:**
- Consumes: `Scene`, `SceneFactory`, `SceneInput`.
- Produces: `export const grid: SceneFactory`, tillagd sist i `SCENES`.

- [ ] **Step 1: Skriv `grid.ts`.** Ett lysande rutnät rullar mot kameran, och bergens höjd formas av ljudbanden (bas längst bort eller i mitten, diskant ytterst; byggarens val). Farten följer intensiteten, linjerna lyser upp på pulsen, färgen följer zonen, lugnt läge ger låg fart och dämpat ljus. Rutnätets täthet följer `setParticles`. `dispose` släpper geometri och material.
- [ ] **Step 2: Kör `npm test` och `npm run build`.** Väntat: gröna.
- [ ] **Step 3: Kontrollera** med `http://localhost:5173/?fart=30&ljus=1&scen=2#/run/exempel-vo2max`: scenen syns, reagerar på intensitet och puls, mätrutan inom reglerna, minst 50 bilder per sekund på nivå 0 i 1920×1080 i webbläsarrutan.
- [ ] **Step 4: Commit** `feat: scenen Nätlandskapet`.

### Task 6: Partikelsvärmen

Som uppgift 5 med `src/anim/scenes/swarm.ts` och `export const swarm: SceneFactory`.

- [ ] **Step 1: Skriv `swarm.ts`.** Upp till 6 000 partiklar (gånger `setParticles`) som trycks utåt på varje puls och dras tillbaka. Antalet synliga följer intensiteten: `0,3 + 0,7 × intensitet` av det tillgängliga. En `Points` med egen enkel shader eller `PointsMaterial` med additiv blandning. Färgen följer zonen, lugnt läge ger långsam drift och dämpat ljus.
- [ ] **Step 2 till 4:** som uppgift 5, med `scen=3`. Commit `feat: scenen Partikelsvärmen`.

### Task 7: Spektrumringen

Som uppgift 5 med `src/anim/scenes/ring.ts` och `export const ring: SceneFactory`.

- [ ] **Step 1: Skriv `ring.ts`.** 3D-staplar i en ring runt kameran, i stil med Windows Media Player. Mikrofonen ger bara tre band, så staplarnas höjd formas av banden fördelade runt ringen (bas på ena sidan, diskant på andra, mjukt emellan) plus en långsam variation per stapel, så att ringen inte ser stel ut. Staplarna studsar på pulsen, ringen roterar med intensiteten. Antalet staplar (högst 96) följer `setParticles`. En `InstancedMesh`.
- [ ] **Step 2 till 4:** som uppgift 5, med `scen=4`. Commit `feat: scenen Spektrumringen`.

- [ ] **Avslutande kontroll (efter uppgift 7):** ett helt VO2max-pass med `?fart=30&ljus=1` utan tvingad scen. Scenerna byts vid nya block, aldrig oftare än var 20:e sekund i verklig tid och aldrig till samma som nyss, och bytet tonar genom mörker.
