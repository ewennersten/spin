import type { Segment } from '../model/types'

// Regler för skärmens signaler. Alla tider är i millisekunder av passet, utom där namnet säger Sec.

export function countdownNumber(durationSec: number, remainingMs: number): number | null {
  if (durationSec < 15 || remainingMs > 5000 || remainingMs <= 0) return null
  return Math.ceil(remainingMs / 1000)
}

export function bannerVisible(elapsedMs: number): boolean {
  return elapsedMs < 3000
}

// 90 s vid 88 %, rak linje ned till 25 s vid 120 %, och 25 s över det.
export function pepIntervalSec(pctNow: number): number | null {
  if (pctNow < 88) return null
  return Math.max(25, 90 - (pctNow - 88) * 65 / 32)
}

// Peppordets animationer (se docs/ideer/peppord.md och .pepword i styles.css). En slumpas varje gång, aldrig samma
// två gånger i rad.
export const PEP_ANIMS = ['slamtv', 'fall', 'neon', 'fly', 'decode', 'split'] as const
export type PepAnim = (typeof PEP_ANIMS)[number]
export function pickPepAnim(last: PepAnim | null, random: () => number = Math.random): PepAnim {
  const pool = PEP_ANIMS.filter(a => a !== last)
  return pool[Math.floor(random() * pool.length)]
}

// Hur långt avkodningen har kommit: hur många bokstäver från början som visas rätt, när ordet har syntes i ms
// av totalt ms. Bokstäverna landar en i taget under första 0,6 s och blandas sönder bakifrån under sista 0,6 s.
export function decodedLetters(length: number, ms: number, totalMs: number): number {
  const into = Math.min(1, ms / 600)
  const out = Math.min(1, Math.max(0, (ms - (totalMs - 600)) / 600))
  return Math.round(length * into * (1 - out))
}

// Ett ord syns i fyra sekunder, så det får börja först när mer än 14 s är kvar: inget ord under de sista tio.
export function pepAllowed(pctNow: number, elapsedMs: number, remainingMs: number): boolean {
  return pctNow >= 88 && !bannerVisible(elapsedMs) && remainingMs > 14000
}

// Ett block som körts klart firas om det hade nedräkning och nådde zonen Tempo (76 %) eller högre.
export function celebrates(s: Segment): boolean {
  return countdownNumber(s.durationSec, 1000) !== null && Math.max(s.fromPct, s.toPct) >= 76
}

// Hur långt uppbyggnaden har kommit: 0 tio sekunder före blockets slut och 1 vid noll, annars null. Den byggs upp
// inför slutet av ett hårt block och inför starten av ett hårt block (next), samma block som får rave-effekten (celebrates).
export const BUILDUP_MS = 10_000
export function buildupLevel(s: Segment, next: Segment | undefined, remainingMs: number): number | null {
  if (!(celebrates(s) || (next && celebrates(next))) || remainingMs > BUILDUP_MS || remainingMs <= 0) return null
  return 1 - remainingMs / BUILDUP_MS
}

export function jumped(prevPosMs: number, posMs: number): boolean {
  return posMs < prevPosMs || posMs - prevPosMs > 2000
}
